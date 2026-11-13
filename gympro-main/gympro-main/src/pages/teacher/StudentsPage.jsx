import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

const COLORS = ['#E1F5EE','#FAEEDA','#E6F1FB','#FCF0F0']
const TEXT_COLORS = ['#085041','#633806','#0C447C','#7F1D1D']

const PLANES = ['Musculación', 'Funcional', 'Musculación + Funcional']
const TURNOS = ['Mañana', 'Tarde', 'Noche']

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const EMPTY_FORM = {
  name: '', username: '', email: '', password: '',
  telefono: '', plan: '', turno: '', fecha_inicio: '', activo: true
}

export default function StudentsPage() {
  const [students, setStudents] = useState([])
  const [inviteLink, setInviteLink] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editStudent, setEditStudent] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('')

  useEffect(() => { loadStudents() }, [])

  async function loadStudents() {
    const { data } = await supabase
      .from('profiles')
      .select('*, training_sessions(count)')
      .eq('role', 'student')
      .order('name')
    setStudents(data || [])
  }

  async function generateInvite() {
    const { data, error } = await supabase
      .from('invitations')
      .insert({ created_by: (await supabase.auth.getUser()).data.user?.id })
      .select('code')
      .single()
    if (error || !data) { alert('Error al generar invitación'); return }
    const link = `${APP_URL}/registro/${data.code}`
    setInviteLink(link)
    setShowInviteModal(true)
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink)
    showToast('Link copiado')
  }

  function sendWhatsApp(telefono) {
    const msg = encodeURIComponent(`Hola! Te comparto tu link para registrarte en JP Fitness:\n${inviteLink}\n\nEl link es válido por 48 horas.`)
    window.open(`https://wa.me/54${telefono.replace(/\D/g,'')}?text=${msg}`, '_blank')
  }

  async function createStudent(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('dynamic-handler', {
        body: {
          name: form.name,
          username: form.username,
          email: form.email,
          password: form.password,
          telefono: form.telefono,
          plan: form.plan,
          turno: form.turno,
          fecha_inicio: form.fecha_inicio || null,
          activo: form.activo,
        }
      })
      if (error || data?.error) throw new Error(error?.message || data?.error)
      setShowModal(false)
      setForm(EMPTY_FORM)
      loadStudents()
      showToast('Alumno creado correctamente')
    } catch (err) {
      alert('Error al crear alumno: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function saveEdit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await supabase.from('profiles').update({
        name: form.name,
        username: form.username,
        telefono: form.telefono,
        plan: form.plan,
        turno: form.turno,
        fecha_inicio: form.fecha_inicio || null,
        activo: form.activo,
      }).eq('id', editStudent.id)
      setEditStudent(null)
      setForm(EMPTY_FORM)
      loadStudents()
      showToast('Alumno actualizado')
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function openEdit(s) {
    setEditStudent(s)
    setForm({
      name: s.name || '',
      username: s.username || '',
      email: s.email || '',
      password: '',
      telefono: s.telefono || '',
      plan: s.plan || '',
      turno: s.turno || '',
      fecha_inicio: s.fecha_inicio || '',
      activo: s.activo !== false,
    })
  }

  async function toggleActivo(s) {
    await supabase.from('profiles').update({ activo: !s.activo }).eq('id', s.id)
    loadStudents()
    showToast(s.activo ? 'Alumno desactivado' : 'Alumno activado')
  }

  async function resetPassword(student) {
    const newPass = prompt(`Nueva contraseña para ${student.name}:\n(mínimo 8 caracteres)`)
    if (!newPass) return
    if (newPass.length < 8) { alert('Mínimo 8 caracteres'); return }
    const { data, error } = await supabase.functions.invoke('dynamic-handler', {
      body: { action: 'reset-password', userId: student.id, password: newPass }
    })
    if (error || data?.error) { alert('Error: ' + (error?.message || data?.error)); return }
    showToast(`Contraseña de ${student.name} actualizada`)
  }

  async function deleteStudent(id) {
    if (!confirm('¿Eliminar este alumno? Se borrarán todos sus datos.')) return
    await supabase.from('profiles').delete().eq('id', id)
    loadStudents()
    showToast('Alumno eliminado')
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const filtered = students.filter(s => {
    const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase())
    const matchPlan = !filterPlan || s.plan === filterPlan
    return matchSearch && matchPlan
  })

  const musculacion = filtered.filter(s => s.plan?.includes('Musculación') || !s.plan)
  const funcional = filtered.filter(s => s.plan === 'Funcional')
  const ambos = filtered.filter(s => s.plan === 'Musculación + Funcional')

  return (
    <div className="py-4 space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-primary-400 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-lg">
          <i className="ti ti-check" /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2">
          <i className="ti ti-users text-primary-400" /> Alumnos
          <span className="text-sm font-normal text-gray-400">({students.length} total)</span>
        </h2>
        <div className="flex gap-2">
          <button onClick={generateInvite}
            className="btn-secondary flex items-center gap-2 text-sm">
            <i className="ti ti-link" /> Invitar
          </button>
          <button onClick={() => { setShowModal(true); setForm(EMPTY_FORM) }}
            className="btn-primary flex items-center gap-2 text-sm">
            <i className="ti ti-plus" /> Nuevo alumno
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <input
          className="input flex-1 min-w-0 text-sm"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input text-sm w-auto" value={filterPlan} onChange={e => setFilterPlan(e.target.value)}>
          <option value="">Todos los planes</option>
          {PLANES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="text-2xl font-semibold text-primary-400">{students.filter(s => s.activo !== false).length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Activos</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-semibold text-blue-500">{students.filter(s => s.plan?.includes('Musculación')).length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Musculación</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-semibold text-orange-400">{students.filter(s => s.plan?.includes('Funcional')).length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Funcional</p>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <i className="ti ti-users-off text-4xl block mb-2" />
            <p className="text-sm">Sin alumnos registrados</p>
          </div>
        )}
        {filtered.map((s, i) => (
          <div key={s.id} className={`card p-4 flex items-center gap-3 ${s.activo === false ? 'opacity-50' : ''}`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-medium text-sm flex-shrink-0"
              style={{ background: COLORS[i % 4], color: TEXT_COLORS[i % 4] }}>
              {getInitials(s.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900 truncate">{s.name}</p>
                {s.activo === false && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inactivo</span>}
              </div>
              <div className="flex flex-wrap gap-x-3 mt-0.5">
                {s.plan && <span className="text-xs text-gray-400">{s.plan}</span>}
                {s.turno && <span className="text-xs text-gray-400">{s.turno}</span>}
                {s.telefono && (
                  <a href={`https://wa.me/54${s.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                    className="text-xs text-green-600 hover:text-green-700 flex items-center gap-0.5">
                    <i className="ti ti-brand-whatsapp text-xs" /> {s.telefono}
                  </a>
                )}
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => openEdit(s)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title="Editar">
                <i className="ti ti-edit text-base" />
              </button>
              <button onClick={() => toggleActivo(s)}
                className={`p-2 rounded-lg transition-colors ${s.activo === false ? 'hover:bg-green-50 text-gray-300 hover:text-green-500' : 'hover:bg-yellow-50 text-gray-400 hover:text-yellow-500'}`}
                title={s.activo === false ? 'Activar' : 'Desactivar'}>
                <i className={`ti ${s.activo === false ? 'ti-toggle-left' : 'ti-toggle-right'} text-base`} />
              </button>
              <button onClick={() => resetPassword(s)}
                className="p-2 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-500 transition-colors" title="Cambiar contraseña">
                <i className="ti ti-lock text-base" />
              </button>
              <button onClick={() => deleteStudent(s.id)}
                className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Eliminar">
                <i className="ti ti-trash text-base" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal invitación */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-medium text-gray-900 mb-1 flex items-center gap-2">
              <i className="ti ti-link text-primary-400" /> Link de registro
            </h3>
            <p className="text-xs text-gray-400 mb-4">Válido por 48 horas. Solo una persona puede usarlo.</p>

            <div className="bg-gray-50 rounded-xl p-3 mb-4 break-all text-xs text-gray-600 font-mono">
              {inviteLink}
            </div>

            <div className="space-y-2">
              <button onClick={copyLink}
                className="btn-secondary w-full flex items-center justify-center gap-2 text-sm">
                <i className="ti ti-copy" /> Copiar link
              </button>
              <button onClick={() => sendWhatsApp('')}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                <i className="ti ti-brand-whatsapp" /> Abrir WhatsApp
              </button>
            </div>

            <button onClick={() => setShowInviteModal(false)}
              className="mt-3 w-full text-center text-sm text-gray-400 hover:text-gray-600">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal crear / editar */}
      {(showModal || editStudent) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-medium text-gray-900 mb-4 flex items-center gap-2">
              <i className={`ti ${editStudent ? 'ti-edit' : 'ti-user-plus'} text-primary-400`} />
              {editStudent ? 'Editar alumno' : 'Nuevo alumno'}
            </h3>
            <form onSubmit={editStudent ? saveEdit : createStudent} className="space-y-3">

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Apellido y nombre *</label>
                  <input className="input" placeholder="Ej: López Martín" value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Usuario *</label>
                  <input className="input" placeholder="martin" value={form.username}
                    onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Teléfono (WhatsApp)</label>
                  <input className="input" placeholder="1123456789" value={form.telefono}
                    onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} />
                </div>
                {!editStudent && (
                  <>
                    <div className="col-span-2">
                      <label className="label">Email *</label>
                      <input className="input" type="email" placeholder="alumno@email.com" value={form.email}
                        onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
                    </div>
                    <div className="col-span-2">
                      <label className="label">Contraseña inicial *</label>
                      <input className="input" type="password" placeholder="mínimo 8 caracteres" value={form.password}
                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={8} />
                    </div>
                  </>
                )}
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
                <div className="col-span-2">
                  <label className="label">Fecha de inicio</label>
                  <input className="input" type="date" value={form.fecha_inicio}
                    onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <input type="checkbox" id="activo" checked={form.activo}
                    onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))}
                    className="w-4 h-4 accent-primary-400" />
                  <label htmlFor="activo" className="text-sm text-gray-700">Alumno activo</label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditStudent(null); setForm(EMPTY_FORM) }}
                  className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={loading}>
                  {loading ? <i className="ti ti-loader animate-spin" /> : null}
                  {editStudent ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
