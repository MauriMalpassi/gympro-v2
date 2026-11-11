import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const DAY_COLORS = ['#1D9E75','#BA7517','#185FA5','#9333EA','#E24B4A','#0891B2']

export default function TrainingDaysPage() {
  const [days, setDays] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', color: '#1D9E75' })
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { loadDays() }, [])

  async function loadDays() {
    const { data } = await supabase.from('training_days').select('*, exercises(count)').order('order_index')
    setDays(data || [])
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', description: '', color: '#1D9E75' })
    setShowModal(true)
  }

  function openEdit(day) {
    setEditing(day)
    setForm({ name: day.name, description: day.description || '', color: day.color || '#1D9E75' })
    setShowModal(true)
  }

  async function save(e) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editing) {
        await supabase.from('training_days').update({
          name: form.name,
          description: form.description,
          color: form.color,
        }).eq('id', editing.id)
        showToast('Día actualizado')
      } else {
        const maxOrder = days.length ? Math.max(...days.map(d => d.order_index)) + 1 : 1
        await supabase.from('training_days').insert({
          name: form.name,
          description: form.description,
          color: form.color,
          order_index: maxOrder,
        })
        showToast('Día creado')
      }
      setShowModal(false)
      loadDays()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function deleteDay(day) {
    const exCount = day.exercises?.[0]?.count || 0
    const msg = exCount > 0
      ? `Este día tiene ${exCount} ejercicios asociados. ¿Eliminar de todas formas? Se perderá el historial.`
      : '¿Eliminar este día de entrenamiento?'
    if (!confirm(msg)) return
    await supabase.from('training_days').delete().eq('id', day.id)
    loadDays()
    showToast('Día eliminado')
  }

  async function moveDay(day, dir) {
    const idx = days.findIndex(d => d.id === day.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= days.length) return
    const swap = days[swapIdx]
    await Promise.all([
      supabase.from('training_days').update({ order_index: swap.order_index }).eq('id', day.id),
      supabase.from('training_days').update({ order_index: day.order_index }).eq('id', swap.id),
    ])
    loadDays()
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
          <i className="ti ti-calendar text-primary-400" /> Días de entrenamiento
        </h2>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
          <i className="ti ti-plus" /> Nuevo día
        </button>
      </div>

      <div className="space-y-3">
        {days.map((day, idx) => (
          <div key={day.id} className="card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: (day.color || '#1D9E75') + '22' }}>
              <i className="ti ti-calendar text-lg" style={{ color: day.color || '#1D9E75' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">{day.name}</p>
              {day.description && <p className="text-xs text-gray-400 mt-0.5">{day.description}</p>}
              <p className="text-xs text-gray-400 mt-0.5">{day.exercises?.[0]?.count || 0} ejercicios</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => moveDay(day, 'up')} disabled={idx === 0}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30 transition-colors">
                <i className="ti ti-chevron-up text-base" />
              </button>
              <button onClick={() => moveDay(day, 'down')} disabled={idx === days.length - 1}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30 transition-colors">
                <i className="ti ti-chevron-down text-base" />
              </button>
              <button onClick={() => openEdit(day)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                <i className="ti ti-edit text-base" />
              </button>
              <button onClick={() => deleteDay(day)}
                className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                <i className="ti ti-trash text-base" />
              </button>
            </div>
          </div>
        ))}
        {!days.length && (
          <div className="text-center py-12 text-gray-400">
            <i className="ti ti-calendar-off text-4xl block mb-2" />
            <p className="text-sm">Sin días de entrenamiento</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-medium text-gray-900 mb-4 flex items-center gap-2">
              <i className="ti ti-calendar text-primary-400" />
              {editing ? 'Editar día' : 'Nuevo día de entrenamiento'}
            </h3>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="label">Nombre del día</label>
                <input className="input" placeholder="Ej: Pecho y Tríceps, Piernas, Día A..."
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Descripción (opcional)</label>
                <input className="input" placeholder="Ej: Fuerza + hipertrofia"
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {DAY_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={loading}>
                  {loading ? <i className="ti ti-loader animate-spin" /> : null}
                  {editing ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
