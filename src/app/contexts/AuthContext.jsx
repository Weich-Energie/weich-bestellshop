import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../supabaseClient.js'

const AuthContext = createContext(null)

// Fail-closed App-Access-Check gegen employees.berechtigungen.app_access.bestellshop.
// Pattern uebernommen aus Ressourcenplanung (Phase 11 / AAC-04).
const APP_KEY = 'bestellshop'
const NO_ACCESS_MESSAGE = 'Du hast keinen Zugang zum Bestellshop. Wende dich an Patrick.'
// Anmeldung hat geklappt, aber zur Email gibt es keine Zeile in employees. Ohne
// eigene Meldung landete der Nutzer stumm wieder auf dem leeren Anmelde-Formular
// und versuchte es endlos erneut.
const NO_PROFILE_MESSAGE =
  'Zu dieser Email gibt es keinen Mitarbeiter-Datensatz. Wende dich an Patrick.'
const PROFILE_ERROR_MESSAGE =
  'Dein Profil konnte nicht geladen werden. Bitte spaeter noch einmal versuchen.'

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [currentUser, setCurrentUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accessDeniedMessage, setAccessDeniedMessage] = useState(null)
  const [viewAsUser, setViewAsUser] = useState(false) // Admin-Selbst-Testmodus

  // Mitarbeiter-Profil per Email-Lookup laden (explizite Spaltenliste — CLAUDE.md Regel).
  // Rueckgabe: { profile, meldung } — die Meldung unterscheidet den fehlenden
  // Datensatz von einem Netz-/Serverproblem, damit der Nutzer weiss, woran er ist.
  const loadUserProfile = useCallback(async (authUser) => {
    const { data, error: fetchError } = await supabase
      .from('employees')
      .select('id, name, position, berechtigungen, email')
      .eq('email', authUser.email)
      .single()
    if (fetchError) {
      console.error('Profil laden fehlgeschlagen:', fetchError)
      // PGRST116 = kein (oder mehr als ein) Treffer, alles andere ist ein Fehler
      // auf dem Weg dorthin.
      return {
        profile: null,
        meldung: fetchError.code === 'PGRST116' ? NO_PROFILE_MESSAGE : PROFILE_ERROR_MESSAGE,
      }
    }
    return { profile: data, meldung: null }
  }, [])

  // Fail-closed App-Access-Check.
  const hasShopAccess = useCallback((profile) => {
    if (!profile) return false
    const access = profile.berechtigungen?.app_access
    if (!access || typeof access !== 'object') return false
    return access[APP_KEY] === true
  }, [])

  // "Roher" Admin-Status: unabhaengig vom View-Toggle. Wird gebraucht, um den Toggle-Button
  // im UI zu zeigen (auch wenn der User gerade im "als User anzeigen"-Modus ist).
  const hasAdminRights = useMemo(() => {
    if (!currentUser) return false
    const access = currentUser.berechtigungen?.app_access
    if (access?.bestellshop_admin === true) return true
    return currentUser.berechtigungen?.rolle === 'admin'
  }, [currentUser])

  // Effektiver Admin-Status: rohes Admin-Recht, aber respektiert View-Toggle.
  // Alle Route-Guards und Nav-Sichtbarkeit nutzen diesen Wert.
  const isAdmin = hasAdminRights && !viewAsUser

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session: existingSession } } = await supabase.auth.getSession()
      if (cancelled) return
      setSession(existingSession)
      if (!existingSession?.user) {
        setLoading(false)
        return
      }
      const { profile, meldung } = await loadUserProfile(existingSession.user)
      if (cancelled) return
      if (!profile) {
        setAccessDeniedMessage(meldung)
        setLoading(false)
        return
      }
      if (!hasShopAccess(profile)) {
        // Kein signOut: Unter der gemeinsamen Origin der Dach-App wuerde das den
        // Nutzer auch aus den Apps werfen, fuer die er freigeschaltet ist.
        setAccessDeniedMessage(NO_ACCESS_MESSAGE)
        setLoading(false)
        return
      }
      setCurrentUser({ ...profile, authId: existingSession.user.id })
      setLoading(false)
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession)
      if (newSession?.user) {
        queryClient.invalidateQueries()
        const { profile, meldung } = await loadUserProfile(newSession.user)
        if (!profile) {
          setAccessDeniedMessage(meldung)
          return
        }
        if (!hasShopAccess(profile)) {
          // Kein signOut: Die Session gehoert der ganzen Dach-App.
          setAccessDeniedMessage(NO_ACCESS_MESSAGE)
          return
        }
        setCurrentUser({ ...profile, authId: newSession.user.id })
        setAccessDeniedMessage(null)
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null)
        queryClient.clear()
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [loadUserProfile, hasShopAccess, queryClient])

  const loginWithEmail = useCallback(async (email, password) => {
    setError(null)
    setAccessDeniedMessage(null)
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      throw authError
    }
    if (data.user) {
      const { profile, meldung } = await loadUserProfile(data.user)
      if (!profile) {
        // Session bleibt: das ist ein Datenproblem, keine verweigerte
        // Berechtigung — und unter der gemeinsamen Origin der Dach-App wuerde ein
        // signOut den Nutzer aus den anderen Apps mitwerfen.
        setAccessDeniedMessage(meldung)
        return data
      }
      if (!hasShopAccess(profile)) {
        await supabase.auth.signOut()
        setAccessDeniedMessage(NO_ACCESS_MESSAGE)
        return data
      }
      setCurrentUser({ ...profile, authId: data.user.id })
      queryClient.invalidateQueries()
    }
    return data
  }, [loadUserProfile, hasShopAccess, queryClient])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setCurrentUser(null)
    setError(null)
  }, [])

  // Setzt das Passwort der aktuellen Session — nach dem Klick auf den
  // Reset-Link ist genau die die Recovery-Session aus der Email.
  const updatePassword = useCallback(async (neuesPasswort) => {
    const { error: updateError } = await supabase.auth.updateUser({ password: neuesPasswort })
    if (updateError) throw updateError
  }, [])

  const resetPassword = useCallback(async (email) => {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      // BASE_URL ('/bestellshop/') muss mit rein: unter der Dach-App liegt die Route
      // nicht auf der Origin-Wurzel, sonst landet der Reset-Link bei der Shell.
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}update-password`,
    })
    if (resetError) throw resetError
  }, [])

  const value = useMemo(
    () => ({
      currentUser,
      session,
      loading,
      error,
      accessDeniedMessage,
      isAdmin,
      hasAdminRights,
      viewAsUser,
      setViewAsUser,
      isAuthenticated: !!currentUser,
      loginWithEmail,
      logout,
      resetPassword,
      updatePassword,
    }),
    [currentUser, session, loading, error, accessDeniedMessage, isAdmin, hasAdminRights, viewAsUser, loginWithEmail, logout, resetPassword, updatePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden.')
  return ctx
}
