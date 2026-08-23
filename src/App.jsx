import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Flex, Spinner } from '@chakra-ui/react'
import { useAuth } from './app/contexts/AuthContext.jsx'
import Layout from './app/components/Layout.jsx'
import LoginPage from './app/pages/LoginPage.jsx'
import UpdatePasswordPage from './app/pages/UpdatePasswordPage.jsx'
import KatalogPage from './app/pages/KatalogPage.jsx'

// Alles ausser Login und Katalog wird nachgeladen. Vorher steckten alle 12 Seiten
// in einem Bundle — jeder Monteur lud den Beleg-Import und die Admin-Seiten mit,
// obwohl er sie nie oeffnet. Login + Katalog bleiben statisch, weil sie die
// Einstiegspunkte sind und Nachladen dort nur eine Verzoegerung waere.
const WarenkorbPage = lazy(() => import('./app/pages/WarenkorbPage.jsx'))
const BestellungenPage = lazy(() => import('./app/pages/BestellungenPage.jsx'))
const BedarfPage = lazy(() => import('./app/pages/BedarfPage.jsx'))
const FavoritenPage = lazy(() => import('./app/pages/FavoritenPage.jsx'))
const AdminKatalogPage = lazy(() => import('./app/pages/AdminKatalogPage.jsx'))
const AdminFreigabePage = lazy(() => import('./app/pages/AdminFreigabePage.jsx'))
const AdminImportPage = lazy(() => import('./app/pages/AdminImportPage.jsx'))
const AdminBedarfPage = lazy(() => import('./app/pages/AdminBedarfPage.jsx'))
const AdminBestellungenPage = lazy(() => import('./app/pages/AdminBestellungenPage.jsx'))
const AdminHistoriePage = lazy(() => import('./app/pages/AdminHistoriePage.jsx'))
const AdminLieferantenPage = lazy(() => import('./app/pages/AdminLieferantenPage.jsx'))

function Ladeanzeige() {
  return <Flex minH="60vh" align="center" justify="center"><Spinner size="xl" /></Flex>
}

function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  if (loading) return <Ladeanzeige />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { loading } = useAuth()
  if (loading) return <Flex minH="100vh" align="center" justify="center"><Spinner size="xl" /></Flex>

  return (
    <Suspense fallback={<Ladeanzeige />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Ziel des Reset-Links aus der Email. Nicht im geschuetzten Bereich:
            sonst laeuft der Nutzer erst in den Zugriffs-Check, und die Route lief
            ueber das "*"-Fallback auf den Katalog — der Recovery-Token war damit
            verbraucht, ohne dass je ein Passwort gesetzt werden konnte. */}
        <Route path="/update-password" element={<UpdatePasswordPage />} />
        <Route
          path="/"
          element={<ProtectedRoute><Layout /></ProtectedRoute>}
        >
          {/* Auf /katalog umleiten statt den Katalog auch unter "/" zu rendern:
              sonst ist auf der Startseite kein Navigationspunkt als aktiv markiert. */}
          <Route index element={<Navigate to="/katalog" replace />} />
          <Route path="katalog" element={<KatalogPage />} />
          <Route path="warenkorb" element={<WarenkorbPage />} />
          <Route path="bestellungen" element={<BestellungenPage />} />
          <Route path="bedarf" element={<BedarfPage />} />
          <Route path="favoriten" element={<FavoritenPage />} />
          <Route path="admin/katalog" element={<ProtectedRoute adminOnly><AdminKatalogPage /></ProtectedRoute>} />
          <Route path="admin/freigabe" element={<ProtectedRoute adminOnly><AdminFreigabePage /></ProtectedRoute>} />
          <Route path="admin/bestellungen" element={<ProtectedRoute adminOnly><AdminBestellungenPage /></ProtectedRoute>} />
          <Route path="admin/historie" element={<ProtectedRoute adminOnly><AdminHistoriePage /></ProtectedRoute>} />
          <Route path="admin/import" element={<ProtectedRoute adminOnly><AdminImportPage /></ProtectedRoute>} />
          <Route path="admin/lieferanten" element={<ProtectedRoute adminOnly><AdminLieferantenPage /></ProtectedRoute>} />
          <Route path="admin/bedarf" element={<ProtectedRoute adminOnly><AdminBedarfPage /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
