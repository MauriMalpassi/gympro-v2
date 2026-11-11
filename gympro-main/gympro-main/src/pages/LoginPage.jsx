import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="JP Fitness" className="w-24 h-24 mx-auto mb-4 rounded-full shadow-2xl" />
          <h1 className="text-3xl font-bold text-white tracking-wide">JP FITNESS</h1>
          <p className="text-sm text-gray-400 mt-1">Plataforma de rutinas de entrenamiento</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-medium text-gray-800 mb-5">Iniciar sesión</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-center gap-2">
              <i className="ti ti-alert-circle text-base" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email" className="input" placeholder="tu@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input
                type="password" className="input" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required
              />
            </div>
            <button type="submit"
              className="btn-primary w-full mt-2 flex items-center justify-center gap-2 py-3"
              disabled={loading}>
              {loading ? <i className="ti ti-loader animate-spin" /> : <i className="ti ti-login" />}
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-xs text-center text-gray-500 mt-6">
  ¿Problemas para ingresar? Contactá a tu entrenador.
</p>

<div className="mt-4 flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
  <p className="text-xs text-gray-400">Desarrollado por</p>
  <p className="text-sm font-semibold text-blue-500 tracking-wide">Mauricio Malpassi</p>
  <p className="text-xs text-gray-400">Técnico en Informática</p>
</div>
      </div>
    </div>
  )
}
