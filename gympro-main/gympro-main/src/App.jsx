import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import TeacherLayout from './pages/teacher/TeacherLayout'
import StudentLayout from './pages/student/StudentLayout'

export default function App() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Cargando GymPro…</p>
        </div>
      </div>
    )
  }

  if (!user || !profile) return <LoginPage />

  return (
    <Routes>
      {profile.role === 'teacher' ? (
        <Route path="/*" element={<TeacherLayout />} />
      ) : (
        <Route path="/*" element={<StudentLayout />} />
      )}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
