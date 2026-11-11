import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const MUSCLE_GROUPS = ['Pecho','Espalda','Hombros','Bíceps','Tríceps','Piernas','Glúteos','Abdominales','Full body']

export default function ExercisesPage() {
  const [exercises, setExercises] = useState([])
  const [days, setDays] = useState([])
  const [filterDay, setFilterDay] = useState('all')
  const [filterMuscle, setFilterMuscle] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showVideo, setShowVideo] = useState(null)
  const [form, setForm] = useState({ name: '', series: 4, reps: 12, block_name: 'Bloque 1', training_day_id: '', muscle_group: '', video_url: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: exs }, { data: ds }] = await Promise.all([
      supabase.from('exercises').select('*, training_days(name, color)').order('order_index'),
      supabase.from('training_days').select('*').order('order_index'),
    ])
    setExercises(exs || [])
    setDays(ds || [])
    if (ds?.length && !form.training_day_id) {
      setForm(p => ({ ...p, training_day_id: ds[0].id }))
    }
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', series: 4, reps: 12, block_name: 'Bloque 1', training_day_id: days[0]?.id || '', muscle_group: '', video_url: '', description: '' })
    setShowModal(true)
  }

  function openEdit(ex) {
    setEditing(ex)
    setForm({
      name: ex.name, series: ex.series, reps: ex.reps,
      block_name: ex.block_name, training_day_id: ex.training_day_id,
      muscle_group: ex.muscle_group || '', video_url: ex.video_url || '',
      description: ex.description || ''
    })
    setShowModal(true)
  }

  async function save(e) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editing) {
        await supabase.from('exercises').update({
          name: form.name, series: Number(form.series), reps: Number(form.reps),
          block_name: form.block_name, training_day_id: form.training_day_id,
          muscle_group: form.muscle_group, video_url: form.video_url, description: form.description,
        }).eq('id', editing.id)
        showToast('Ejercicio actualizado')
      } else {
        const sameDay = exercises.filter(e => e.training_day_id === form.training_day_id)
        const maxOrder = sameDay.length ? Math.max(...sameDay.map(e => e.order_index)) + 1 : 1
        await supabase.from('exercises').insert({
          name: form.name, series: Number(form.series), reps: Number(form.reps),
          block_name: form.block_name, training_day_id: form.training_day_id,
          muscle_group: form.muscle_group, video_url: form.video_url, description: form.description,
          order_index: maxOrder, block_order: form.block_name === 'Bloque 1' ? 1 : form.block_name === 'Bloque 2' ? 2 : 3,
        })
        showToast('Ejercicio creado')
      }
      setShowModal(false)
      loadData()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function deleteExercise(ex) {
    if (!confirm(`¿Eliminar "${ex.name}"? Se perderá el historial de pesos asociado a este ejercicio.`)) return
    await supabase.from('exercises').delete().eq('id', ex.id)
    loadData()
    showToast('Ejercicio eliminado')
  }

  function getYoutubeEmbed(url) {
    if (!url) return null
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
    return match ? `https://www.youtube.com/embed/${match[1]}` : null
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const filtered = exercises.filter(ex =>
    (filterDay === 'all' || ex.training_day_id === filterDay) &&
    (filterMuscle === 'all' || ex.muscle_group === filterMuscle)
  )

  const grouped = filtered.reduce((acc, ex) => {
    const dayName = ex.training_days?.name || 'Sin día'
    if (!acc[dayName]) acc[dayName] = { color: ex.training_days?.color || '#1D9E75', exercises: [] }
    acc[dayName].exercises.push(ex)
    return acc
  }, {})

  return (
    <div className="py-4 space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-primary-400 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-lg">
          <i className="ti ti-check" /> {toast}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2">
          <i className="ti ti-barbell text-primary-400" /> Ejercicios
        </h2>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
          <i className="ti ti-plus" /> Nuevo ejercicio
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select className="input !w-auto text-sm py-1.5" value={filterDay} onChange={e => setFilterDay(e.target.value)}>
          <option value="all">Todos los días</option>
          {days.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="input !w-auto text-sm py-1.5" value={filterMuscle} onChange={e => setFilterMuscle(e.target.value)}>
          <option value="all">Todos los músculos</option>
          {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Exercises grouped by day */}
      {Object.entries(grouped).map(([dayName, { color, exercises: dayExs }]) => (
        <div key={dayName}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            <p className="text-sm font-medium text-gray-600">{dayName}</p>
            <span className="text-xs text-gray-400">({dayExs.length})</span>
          </div>
          <div className="space-y-2">
            {dayExs.map(ex => (
              <div key={ex.id} className="card p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">{ex.name}</p>
                    {ex.muscle_group && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">{ex.muscle_group}</span>
                    )}
                    <span className="text-xs px-2 py-0.5 bg-primary-50 rounded-full text-primary-700">{ex.block_name}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{ex.series} series × {ex.reps} reps</p>
                  {ex.description && <p className="text-xs text-gray-400 mt-0.5">{ex.description}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {ex.video_url && (
                    <button onClick={() => setShowVideo(ex)}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Ver video">
                      <i className="ti ti-brand-youtube text-base" />
                    </button>
                  )}
                  <button onClick={() => openEdit(ex)}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                    <i className="ti ti-edit text-base" />
                  </button>
                  <button onClick={() => deleteExercise(ex)}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                    <i className="ti ti-trash text-base" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {!filtered.length && (
        <div className="text-center py-12 text-gray-400">
          <i className="ti ti-barbell text-4xl block mb-2" />
          <p className="text-sm">Sin ejercicios</p>
        </div>
      )}

      {/* Video Modal */}
      {showVideo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">{showVideo.name}</h3>
              <button onClick={() => setShowVideo(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <i className="ti ti-x text-lg" />
              </button>
            </div>
            {getYoutubeEmbed(showVideo.video_url) ? (
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute inset-0 w-full h-full rounded-xl"
                  src={getYoutubeEmbed(showVideo.video_url)}
                  allowFullScreen title={showVideo.name}
                />
              </div>
            ) : (
              <a href={showVideo.video_url} target="_blank" rel="noopener noreferrer"
                className="btn-primary flex items-center justify-center gap-2">
                <i className="ti ti-external-link" /> Abrir video
              </a>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-medium text-gray-900 mb-4 flex items-center gap-2">
              <i className="ti ti-barbell text-primary-400" />
              {editing ? 'Editar ejercicio' : 'Nuevo ejercicio'}
            </h3>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="label">Nombre</label>
                <input className="input" placeholder="Ej: Press de banca"
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Día</label>
                  <select className="input" value={form.training_day_id}
                    onChange={e => setForm(p => ({ ...p, training_day_id: e.target.value }))}>
                    {days.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Bloque</label>
                  <select className="input" value={form.block_name}
                    onChange={e => setForm(p => ({ ...p, block_name: e.target.value }))}>
                    <option>Bloque 1</option>
                    <option>Bloque 2</option>
                    <option>Bloque 3</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Series</label>
                  <input className="input" type="number" min="1" max="10"
                    value={form.series} onChange={e => setForm(p => ({ ...p, series: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Repeticiones</label>
                  <input className="input" type="number" min="1" max="100"
                    value={form.reps} onChange={e => setForm(p => ({ ...p, reps: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="label">Grupo muscular</label>
                <select className="input" value={form.muscle_group}
                  onChange={e => setForm(p => ({ ...p, muscle_group: e.target.value }))}>
                  <option value="">Sin categoría</option>
                  {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Video de ejemplo (YouTube)</label>
                <input className="input" placeholder="https://youtube.com/watch?v=..."
                  value={form.video_url} onChange={e => setForm(p => ({ ...p, video_url: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">Pegá el link de YouTube del ejercicio</p>
              </div>
              <div>
                <label className="label">Descripción (opcional)</label>
                <textarea className="input resize-none" rows={2} placeholder="Notas o indicaciones..."
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
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
