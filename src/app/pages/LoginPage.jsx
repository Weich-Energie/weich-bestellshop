import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Flex, VStack, Heading, Input, Button, Text, Field } from '@chakra-ui/react'
import { ShoppingCart } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function LoginPage() {
  const { loginWithEmail, isAuthenticated, accessDeniedMessage, error } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  async function onSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try { await loginWithEmail(email, password) }
    catch { /* Fehler steht im Context */ }
    finally { setSubmitting(false) }
  }

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50" p={4}>
      <Box bg="white" borderWidth="1px" borderRadius="lg" p={8} maxW="400px" w="100%">
        <VStack gap={4} align="stretch">
          <VStack gap={2}>
            <ShoppingCart size={40} color="#3182CE" />
            <Heading size="lg">Bestellshop</Heading>
            <Text fontSize="sm" color="fg.muted">Weich Solartechnik</Text>
          </VStack>

          <form onSubmit={onSubmit}>
            <VStack gap={3} align="stretch">
              <Field.Root>
                <Field.Label>Email</Field.Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </Field.Root>
              <Field.Root>
                <Field.Label>Passwort</Field.Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              </Field.Root>
              {error && <Text color="red.500" fontSize="sm">{error}</Text>}
              {accessDeniedMessage && <Text color="orange.600" fontSize="sm">{accessDeniedMessage}</Text>}
              <Button type="submit" colorPalette="blue" loading={submitting}>Anmelden</Button>
            </VStack>
          </form>
        </VStack>
      </Box>
    </Flex>
  )
}
