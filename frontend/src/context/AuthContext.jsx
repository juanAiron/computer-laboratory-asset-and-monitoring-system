import { createContext, useCallback, useEffect, useState } from 'react'
import api, { setAccessToken } from '../api/client'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session silently on page reload using HttpOnly refresh cookie
  useEffect(() => {
    let active = true
    async function restoreSession() {
      try {
        const { data } = await api.post('/auth/refresh')
        if (active) {
          setAccessToken(data.access_token)
          setUser(data.user)
        }
      } catch {
        if (active) {
          setAccessToken(null)
          setUser(null)
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    restoreSession()
    return () => {
      active = false
    }
  }, [])

  const loginWithGoogle = useCallback(async (credential) => {
    const { data } = await api.post('/auth/google', { credential })
    setAccessToken(data.access_token)
    setUser(data.user)
    return data.user
  }, [])

  const loginLocal = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/local', { email, password })
    setAccessToken(data.access_token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, loginLocal, logout }}>
      {children}
    </AuthContext.Provider>
  )
}