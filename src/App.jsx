import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Flex, Spinner } from '@chakra-ui/react'
import { useAuth } from './app/contexts/AuthContext.jsx'
import Layout from './app/components/Layout.jsx'
import LoginPage from './app/pages/LoginPage.jsx'
import KatalogPage from './app/pages/KatalogPage.jsx'
import WarenkorbPage from './app/pages/WarenkorbPage.jsx'
import BestellungenPage from './app/pages/BestellungenPage.jsx'
import BedarfPage from './app/pages/BedarfPage.jsx'
import FavoritenPage from './app/pages/FavoritenPage.jsx'
import AdminKatalogPage from './app/pages/AdminKatalogPage.jsx'
import AdminFreigabePage from './app/pages/AdminFreigabePage.jsx'
import AdminImportPage from './app/pages/AdminImportPage.jsx'
import AdminBedarfPage from './app/pages/AdminBedarfPage.jsx'

function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  if (loading) return <Flex minH="60vh" align="center" justify="center"><Spinner size="xl" /></Flex>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { loading } = useAuth()
  if (loading) return <Flex minH="100vh" align="center" justify="center"><Spinner size="xl" /></Flex>

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={<ProtectedRoute><Layout /></ProtectedRoute>}
      >
        <Route index element={<KatalogPage />} />
        <Route path="katalog" element={<KatalogPage />} />
        <Route path="warenkorb" element={<WarenkorbPage />} />
        <Route path="bestellungen" element={<BestellungenPage />} />
        <Route path="bedarf" element={<BedarfPage />} />
        <Route path="favoriten" element={<FavoritenPage />} />
        <Route path="admin/katalog" element={<ProtectedRoute adminOnly><AdminKatalogPage /></ProtectedRoute>} />
        <Route path="admin/freigabe" element={<ProtectedRoute adminOnly><AdminFreigabePage /></ProtectedRoute>} />
        <Route path="admin/import" element={<ProtectedRoute adminOnly><AdminImportPage /></ProtectedRoute>} />
        <Route path="admin/bedarf" element={<ProtectedRoute adminOnly><AdminBedarfPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
