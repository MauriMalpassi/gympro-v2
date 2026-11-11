import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const COLORS = ['#E1F5EE','#FAEEDA','#E6F1FB','#FCF0F0']
const TEXT_COLORS = ['#085041','#633806','#0C447C','#7F1D1D']

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function StudentsPage() {
  const [students, setStudents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { loadStudents() }, [])

  async function loadStudents() {
    const { data } = await supabase
      .from('profiles')
      .select('*, training_sessions(count)')
      .eq('role', 'student')
      .order('name')
    setStudents(data || [])
  }

async function resetPassword(student) {
  const newPass = prompt(`Nueva contraseña para ${student.name}:\n(mínimo 8 caracteres)`)
  if (!newPass) return
  if (newPass.length < 8) { alert('La contraseña debe tener al menos 8 caracteres'); return }
  
  const { data, error } = await supabase.functions.invoke('dynamic-handler', {
    body: { action: 'reset-password', userId: student.id, password: newPass }
  })
  
  if (error || data?.error) {
    alert('Error al resetear: ' + (error?.message || data?.error))
    return
  }
  showToast(`Contraseña de ${student.name} actualizada`)
}

async function openEdit(student) {
  const newName = prompt('Nombre completo:', student.name)
  if (!newName) return
  await supabase.from('profiles').update({ name: newName }).eq('id', student.id)
  loadStudents()
  showToast('Alumno actualizado')
}

async function createStudent(e) {
    e.preventDefault()
    setLoading(true)
    try {
      // Crear usuario en Supabase Auth
      const { data, error } = await supabase.functions.invoke('dynamic-handler', {
  body: {
    name: form.name,
    username: form.username,
    email: form.email,
    password: form.password,
  }
})
if (error || data?.error) throw new Error(error?.message || data?.error)

      setShowModal(false)
      setForm({ name: '', username: '', email: '', password: '' })
      loadStudents()
      showToast('Alumno creado correctamente')
    } catch (err) {
      alert('Error al crear alumno: ' + err.message)
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="py-4 space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-primary-400 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-lg">
          <i className="ti ti-check" /> {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2">
          <i className="ti ti-users text-primary-400" /> Gestión de alumnos
        </h2>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <i className="ti ti-plus" /> Nuevo alumno
        </button>
      </div>

      <div className="space-y-3">
        {students.map((s, i) => (
          <div key={s.id} className="card p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center font-medium text-sm flex-shrink-0"
              style={{ background: COLORS[i % 4], color: TEXT_COLORS[i % 4] }}>
              {getInitials(s.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">{s.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">@{s.username} · {s.training_sessions?.[0]?.count || 0} sesiones</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => openEdit(s)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title="Editar">
  		<i className="ti ti-edit text-base" />
	      </button>

		<button onClick={() => resetPassword(s)}
  		className="p-2 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-500 transition-colors" title="Resetear contraseña">
 		 <i className="ti ti-lock text-base" />
		</button>

              <button onClick={() => deleteStudent(s.id)}
                className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Eliminar">
                <i className="ti ti-trash text-base" />
              </button>
            </div>
          </div>
        ))}
        {!students.length && (
          <div className="text-center py-12 text-gray-400">
            <i className="ti ti-users-off text-4xl block mb-2" />
            <p className="text-sm">Sin alumnos registrados todavía</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-medium text-gray-900 mb-4 flex items-center gap-2">
              <i className="ti ti-user-plus text-primary-400" /> Nuevo alumno
            </h3>
            <form onSubmit={createStudent} className="space-y-3">
              <div>
                <label className="label">Nombre completo</label>
                <input className="input" placeholder="Ej: Martín López" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Usuario</label>
                <input className="input" placeholder="Ej: martin" value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="alumno@email.com" value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Contraseña inicial</label>
                <input className="input" type="password" placeholder="mínimo 8 caracteres" value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={8} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={loading}>
                  {loading ? <i className="ti ti-loader animate-spin" /> : null} Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
