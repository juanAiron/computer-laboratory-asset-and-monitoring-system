import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './features/auth/LoginPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { UsersManagePage } from './features/users/UsersManagePage'
import { ProfilePage } from './features/profile/ProfilePage'
import { ClassSessionsPage } from './features/sessions/ClassSessionsPage'
import { InstructorProfilePage } from './features/instructors/InstructorProfilePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/sessions" element={<ClassSessionsPage />} />
            <Route path="/users" element={<UsersManagePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/instructors/:instructorId" element={<InstructorProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}