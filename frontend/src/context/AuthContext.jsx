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
        const response = await api.post('/auth/refresh')
        if (response.status === 204) return
        const { data } = response
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

  const loginLocal = useCallback(async (identifier, password) => {
    const { data } = await api.post('/auth/local', { identifier, password })
    setAccessToken(data.access_token)
    setUser(data.user)
    return data.user
  }, [])

  const signupLocal = useCallback(async (idNumber, password, confirmPassword, fullName) => {
    const { data } = await api.post('/auth/signup', {
      id_number: idNumber,
      password,
      full_name: fullName,
      confirm_password: confirmPassword,
    })
    setAccessToken(data.access_token)
    setUser(data.user)
    return data.user
  }, [])

  const forgotPassword = useCallback(async (email) => {
    const { data } = await api.post('/auth/forgot-password', { email })
    return data.detail
  }, [])

  const resetPassword = useCallback(async (token, password, confirmPassword) => {
    const { data } = await api.post('/auth/reset-password', {
      token,
      password,
      confirm_password: confirmPassword,
    })
    return data.detail
  }, [])

  const updateProfile = useCallback(async (payload) => {
    const { data } = await api.patch('/users/me', payload)
    setUser((current) => ({ ...current, ...data }))
    return data
  }, [])

  const updateProfilePhoto = useCallback(async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post('/users/me/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    setUser((current) => ({ ...current, ...data }))
    return data
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
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        loginLocal,
        signupLocal,
        forgotPassword,
        resetPassword,
        updateProfile,
        updateProfilePhoto,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}