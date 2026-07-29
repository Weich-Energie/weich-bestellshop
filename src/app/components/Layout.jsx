import React, { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Box, Flex, HStack, VStack, Text, Button, Spacer, IconButton } from '@chakra-ui/react'
import {
  ShoppingCart, Package, ClipboardList, Heart, Send, LayoutGrid, LogOut, ShieldCheck,
  Eye, EyeOff, Truck, History, Menu as MenuIcon, X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

function Nav({ to, icon: Icon, children, onNavigate }) {
  return (
    <NavLink to={to} end style={{ textDecoration: 'none' }} onClick={onNavigate}>
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
  const [menuOffen, setMenuOffen] = useState(false)
  const location = useLocation()

  // Menue nach jedem Seitenwechsel zuklappen — sonst verdeckt es den Inhalt.
  React.useEffect(() => { setMenuOffen(false) }, [location.pathname])

  // Einmal definiert, zweimal gerendert (Desktop-Leiste + mobiles Klappmenue),
  // damit die Navigation nicht doppelt gepflegt werden muss.
  const links = (
    <>
      <Nav to="/katalog" icon={LayoutGrid}>Katalog</Nav>
      <Nav to="/warenkorb" icon={ShoppingCart}>Warenkorb</Nav>
      <Nav to="/bestellungen" icon={ClipboardList}>Meine Bestellungen</Nav>
      <Nav to="/favoriten" icon={Heart}>Favoriten</Nav>
      <Nav to="/bedarf" icon={Send}>Bedarf melden</Nav>
      {isAdmin && (
        <>
          <Box borderTopWidth={{ base: '1px', md: 0 }} borderLeftWidth={{ base: 0, md: '1px' }}
            my={{ base: 1, md: 0 }} mx={{ base: 0, md: 2 }} w={{ base: '100%', md: 'auto' }} h={{ base: 0, md: 6 }} />
          <Nav to="/admin/katalog" icon={Package}>Katalog verwalten</Nav>
          <Nav to="/admin/freigabe" icon={ShieldCheck}>Freigaben</Nav>
          <Nav to="/admin/bestellungen" icon={Truck}>Bestellungen</Nav>
          <Nav to="/admin/historie" icon={History}>Historie</Nav>
          <Nav to="/admin/bedarf" icon={Send}>Bedarfsmeldungen</Nav>
          <Nav to="/admin/import" icon={Package}>Beleg-Import</Nav>
          <Nav to="/admin/lieferanten" icon={Truck}>Lieferanten</Nav>
        </>
      )}
    </>
  )

  return (
    <Flex minH="100vh" direction="column">
      <Box borderBottomWidth="1px" bg="white" px={{ base: 3, md: 4 }} py={2}>
        <Flex align="center" gap={{ base: 2, md: 4 }}>
          <IconButton
            display={{ base: 'inline-flex', md: 'none' }}
            size="sm" variant="ghost" onClick={() => setMenuOffen((v) => !v)}
            aria-label={menuOffen ? 'Menü schließen' : 'Menü öffnen'}>
            {menuOffen ? <X size={20} /> : <MenuIcon size={20} />}
          </IconButton>

          <HStack gap={2}>
            <ShoppingCart size={22} color="#3182CE" />
            <Text fontWeight="bold" fontSize="lg">Bestellshop</Text>
          </HStack>

          {/* Desktop-Navigation */}
          <HStack gap={1} ml={4} flexWrap="wrap" display={{ base: 'none', md: 'flex' }}>
            {links}
          </HStack>

          <Spacer />

          <HStack gap={3}>
            {hasAdminRights && (
              <Button size="sm" variant={viewAsUser ? 'solid' : 'outline'}
                colorPalette={viewAsUser ? 'orange' : 'gray'}
                onClick={() => setViewAsUser((v) => !v)}
                title={viewAsUser ? 'Zurueck zur Admin-Sicht' : 'Als User anzeigen'}>
                {viewAsUser ? <EyeOff size={14} /> : <Eye size={14} />}
                <Box as="span" display={{ base: 'none', lg: 'inline' }}>
                  {viewAsUser ? ' User-Sicht' : ' Als User anzeigen'}
                </Box>
              </Button>
            )}
            <Text fontSize="sm" color="fg.muted" display={{ base: 'none', md: 'block' }}>
              {currentUser?.name}
            </Text>
            <Button size="sm" variant="ghost" onClick={logout} aria-label="Abmelden">
              <LogOut size={14} />
              <Box as="span" display={{ base: 'none', md: 'inline' }}> Abmelden</Box>
            </Button>
          </HStack>
        </Flex>

        {/* Mobiles Klappmenue */}
        {menuOffen && (
          <VStack align="stretch" gap={0} mt={2} pt={2} borderTopWidth="1px"
            display={{ base: 'flex', md: 'none' }}>
            <Text fontSize="xs" color="fg.muted" px={3} pb={1}>{currentUser?.name}</Text>
            {links}
          </VStack>
        )}
      </Box>

      <Box flex="1" p={{ base: 3, md: 6 }} bg="gray.50">
        <Outlet />
      </Box>
    </Flex>
  )
}
