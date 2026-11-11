import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth.jsx'
import { supabase } from '../../lib/supabase'

export default function ConfigPage() {
  const { profile } = useAuth()
  const [form, setForm] = useState({ display_name: '', specialty: '', phone: '' })
  const [profileForm, setProfileForm] = useState({ name: '' })
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (profile) {
      setProfileForm({ name: profile.name })
      loadConfig()
    }
  }, [profile])

  async function loadConfig() {
    const { data } = await supabase
      .from('teacher_config')
      .select('*')
      .eq('teacher_id', profile.id)
      .single()
    if (data) setForm({ display_name: data.display_name || '', specialty: data.specialty || '', phone: data.phone || '' })
  }

  async function saveConfig(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await supabase.from('teacher_config').upsert({
        teacher_id: profile.id,
        display_name: form.display_name,
        specialty: form.specialty,
        phone: form.phone,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'teacher_id' })

      if (profileForm.name !== profile.name) {
        await supabase.from('profiles').update({ name: profileForm.name }).eq('id', profile.id)
      }

      showToast('Configuración guardada')
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  return (
    <div className="py-4 space-y-5 max-w-lg">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-primary-400 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-lg">
          <i className="ti ti-check" /> {toast}
        </div>
      )}

      <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2">
        <i className="ti ti-settings text-primary-400" /> Configuración
      </h2>

      <form onSubmit={saveConfig} className="space-y-5">
        {/* Datos del profesor */}
        <div className="card p-5 space-y-4">
          <h3 className="font-medium text-gray-800 flex items-center gap-2">
            <i className="ti ti-user text-primary-400" /> Datos del profesor
          </h3>
          <div>
            <label className="label">Nombre completo</label>
            <input className="input" placeholder="Ej: Juan García"
              value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Nombre que verán los alumnos</label>
            <input className="input" placeholder="Ej: Profe Juan"
              value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">Este nombre aparece en las rutinas de los alumnos</p>
          </div>
          <div>
            <label className="label">Especialidad</label>
            <input className="input" placeholder="Ej: Musculación y fuerza"
              value={form.specialty} onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))} />
          </div>
          <div>
            <label className="label">Teléfono de contacto</label>
            <input className="input" placeholder="Ej: +54 11 1234-5678"
              value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
        </div>

        {/* Info del sistema */}
        <div className="card p-5 space-y-3">
          <h3 className="font-medium text-gray-800 flex items-center gap-2">
            <i className="ti ti-info-circle text-primary-400" /> Información del sistema
          </h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span>Usuario</span>
              <span className="font-medium text-gray-900">@{profile?.username}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span>Rol</span>
              <span className="font-medium text-primary-600">Profesor</span>
            </div>
            <div className="flex justify-between py-2">
              <span>Versión</span>
              <span className="font-medium text-gray-900">GymPro 1.0</span>
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 py-3" disabled={loading}>
          {loading ? <i className="ti ti-loader animate-spin" /> : <i className="ti ti-device-floppy" />}
          {loading ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </form>
    </div>
  )
}
