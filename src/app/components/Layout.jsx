import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Box, Flex, HStack, Text, Button, Spacer, Badge } from '@chakra-ui/react'
import { ShoppingCart, Package, ClipboardList, Heart, Send, LayoutGrid, LogOut, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

function Nav({ to, icon: Icon, children }) {
  return (
    <NavLink to={to} end style={{ textDecoration: 'none' }}>
      {({ isActive }) => (
        <HStack
          gap={2} px={3} py={2} borderRadius="md"
          bg={isActive ? 'blue.50' : 'transparent'}
          color={isActive ? 'blue.700' : 'fg.default'}
          _hover={{ bg: 'gray.100' }}>
          <Icon size={16} />
          <Text fontSize="sm" fontWeight={isActive ? 'bold' : 'medium'}>{children}</Text>
        </HStack>
      )}
    </NavLink>
  )
}

export default function Layout() {
  const { currentUser, isAdmin, hasAdminRights, viewAsUser, setViewAsUser, logout } = useAuth()

  return (
    <Flex minH="100vh" direction="column">
      <Box borderBottomWidth="1px" bg="white" px={4} py={2}>
        <Flex align="center" gap={4} flexWrap="wrap">
          <HStack gap={2}>
            <ShoppingCart size={22} color="#3182CE" />
            <Text fontWeight="bold" fontSize="lg">Bestellshop</Text>
          </HStack>
          <HStack gap={1} ml={4} flexWrap="wrap">
            <Nav to="/katalog" icon={LayoutGrid}>Katalog</Nav>
            <Nav to="/warenkorb" icon={ShoppingCart}>Warenkorb</Nav>
            <Nav to="/bestellungen" icon={ClipboardList}>Meine Bestellungen</Nav>
            <Nav to="/favoriten" icon={Heart}>Favoriten</Nav>
            <Nav to="/bedarf" icon={Send}>Bedarf melden</Nav>
            {isAdmin && (
              <>
                <Box borderLeftWidth="1px" mx={2} h={6} />
                <Nav to="/admin/katalog" icon={Package}>Katalog verwalten</Nav>
                <Nav to="/admin/freigabe" icon={ShieldCheck}>Freigaben</Nav>
                <Nav to="/admin/bedarf" icon={Send}>Bedarfsmeldungen</Nav>
                <Nav to="/admin/import" icon={Package}>Beleg-Import</Nav>
              </>
            )}
          </HStack>
          <Spacer />
          <HStack gap={3}>
            {hasAdminRights && (
              <Button size="sm" variant={viewAsUser ? 'solid' : 'outline'}
                colorPalette={viewAsUser ? 'orange' : 'gray'}
                onClick={() => setViewAsUser((v) => !v)}
                title={viewAsUser ? 'Zurueck zur Admin-Sicht' : 'Als User anzeigen'}>
                {viewAsUser ? <><EyeOff size={14} /> User-Sicht</> : <><Eye size={14} /> Als User anzeigen</>}
              </Button>
            )}
            <Text fontSize="sm" color="fg.muted">{currentUser?.name}</Text>
            <Button size="sm" variant="ghost" onClick={logout}>
              <LogOut size={14} /> Abmelden
            </Button>
          </HStack>
        </Flex>
      </Box>
      <Box flex="1" p={6} bg="gray.50">
        <Outlet />
      </Box>
    </Flex>
  )
}
