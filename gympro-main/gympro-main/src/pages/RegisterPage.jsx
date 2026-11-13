import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const PLANES = ['Musculación', 'Funcional', 'Musculación + Funcional']
const TURNOS = ['Mañana', 'Tarde', 'Noche']

export default function RegisterPage() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [invitation, setInvitation] = useState(null)
  const [status, setStatus] = useState('loading') // loading | valid | invalid | used | expired | success
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', telefono: '', plan: '', turno: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { checkCode() }, [code])

  async function checkCode() {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('code', code)
      .maybeSingle()

    if (error || !data) { setStatus('invalid'); return }
    if (data.used_at) { setStatus('used'); return }
    if (new Date(data.expires_at) < new Date()) { setStatus('expired'); return }
    setInvitation(data)
    setStatus('valid')
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      // 1. Crear usuario en Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })
      if (authError) throw new Error(authError.message)
      const userId = authData.user?.id
      if (!userId) throw new Error('No se pudo crear el usuario')

      // 2. Crear perfil
      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        email: form.email,
        name: form.name,
        username: form.username,
        telefono: form.telefono,
        plan: form.plan,
        turno: form.turno,
        role: 'student',
        activo: true,
      })
      if (profileError) throw new Error(profileError.message)

      // 3. Marcar invitación como usada
      await supabase.from('invitations').update({
        used_by: userId,
        used_at: new Date().toISOString(),
      }).eq('code', code)

      setStatus('success')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Estados de la página
  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-3 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (status === 'invalid') return <StatusCard icon="ti-link-off" title="Link inválido" text="Este link de registro no existe." color="red" />
  if (status === 'used') return <StatusCard icon="ti-check" title="Link ya utilizado" text="Este link ya fue usado para registrarse." color="gray" />
  if (status === 'expired') return <StatusCard icon="ti-clock-off" title="Link vencido" text="Este link expiró. Pedile uno nuevo a tu entrenador." color="amber" />

  if (status === 'success') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-lg text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ti ti-check text-3xl text-green-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">¡Registro completado!</h2>
        <p className="text-gray-500 text-sm mb-6">Tu cuenta fue creada. Ya podés iniciar sesión.</p>
        <button onClick={() => navigate('/')} className="btn-primary w-full">Ir al inicio</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-primary-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <i className="ti ti-barbell text-white text-2xl" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">JP FITNESS</h1>
          <p className="text-sm text-gray-500 mt-1">Completá tus datos para registrarte</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-3">
          <div>
            <label className="label">Apellido y nombre *</label>
            <input className="input" placeholder="Ej: López Martín" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Usuario *</label>
              <input className="input" placeholder="martin" value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input className="input" placeholder="1123456789" value={form.telefono}
                onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" placeholder="tu@email.com" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Contraseña *</label>
            <input className="input" type="password" placeholder="mínimo 8 caracteres" value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={8} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Plan</label>
              <select className="input" value={form.plan} onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}>
                <option value="">Sin definir</option>
                {PLANES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Turno</label>
              <select className="input" value={form.turno} onChange={e => setForm(p => ({ ...p, turno: e.target.value }))}>
                <option value="">Sin definir</option>
                {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg flex items-center gap-2">
              <i className="ti ti-alert-circle" /> {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 mt-2" disabled={loading}>
            {loading ? <i className="ti ti-loader animate-spin" /> : <i className="ti ti-user-check" />}
            Crear mi cuenta
          </button>
        </form>
      </div>
    </div>
  )
}

function StatusCard({ icon, title, text, color }) {
  const colors = {
    red: 'bg-red-100 text-red-500',
    gray: 'bg-gray-100 text-gray-500',
    amber: 'bg-amber-100 text-amber-500',
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-lg text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${colors[color]}`}>
          <i className={`ti ${icon} text-3xl`} />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-500 text-sm">{text}</p>
      </div>
    </div>
  )
}
