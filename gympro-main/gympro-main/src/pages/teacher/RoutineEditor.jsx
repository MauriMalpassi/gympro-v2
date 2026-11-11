import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const DAYS    = ['Lunes', 'Miércoles', 'Viernes']
const BLOCKS  = ['Bloque 1', 'Bloque 2', 'Bloque 3']
const WEEKS   = [1, 2, 3, 4]

function blockBadge(block) {
  if (block === 'Bloque 1') return 'badge-block1'
  if (block === 'Bloque 2') return 'badge-block2'
  return 'badge-block3'
}

export default function RoutineEditor() {
  const { studentId }   = useParams()
  const { profile }     = useAuth()
  const navigate        = useNavigate()
  const [student, setStudent]   = useState(null)
  const [routine, setRoutine]   = useState(null)
  const [items, setItems]       = useState([])
  const [exercises, setExercises] = useState([])
  const [activeDay, setActiveDay] = useState('Lunes')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [loading, setLoading]   = useState(true)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItem, setNewItem]   = useState({ exercise_id: '', block: 'Bloque 1', series: 4, reps: 10, suggested_kg: 0 })

  useEffect(() => { loadAll() }, [studentId])

  async function loadAll() {
    setLoading(true)
    const [{ data: stu }, { data: exs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', studentId).single(),
      supabase.from('exercises').select('*').order('name'),
    ])
    setStudent(stu)
    setExercises(exs || [])

    // Get or create routine
    let { data: rout } = await supabase
      .from('routines')
      .select('*')
      .eq('student_id', studentId)
      .eq('teacher_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!rout) {
      const { data: newRout } = await supabase.from('routines').insert({
        student_id: studentId,
        teacher_id: profile.id,
        name:       'Rutina mensual',
        month:      new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' }),
      }).select().single()
      rout = newRout
    }
    setRoutine(rout)

    // Load items
    const { data: its } = await supabase
      .from('routine_items')
      .select('*, exercises(*)')
      .eq('routine_id', rout.id)
      .order('position')
    setItems(its || [])
    setLoading(false)
  }

  async function updateSuggested(itemId, val) {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, suggested_kg: val } : it))
  }

  async function saveAll() {
    setSaving(true)
    for (const item of items) {
      await supabase.from('routine_items')
        .update({ suggested_kg: item.suggested_kg })
        .eq('id', item.id)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function addItem() {
    if (!newItem.exercise_id) return
    const dayItems = items.filter(it => it.day_of_week === activeDay)
    await supabase.from('routine_items').insert({
      routine_id:  routine.id,
      exercise_id: newItem.exercise_id,
      day_of_week: activeDay,
      block:       newItem.block,
      position:    dayItems.length + 1,
      series:      newItem.series,
      reps:        newItem.reps,
      suggested_kg: newItem.suggested_kg,
    })
    setShowAddItem(false)
    setNewItem({ exercise_id: '', block: 'Bloque 1', series: 4, reps: 10, suggested_kg: 0 })
    loadAll()
  }

  async function removeItem(id) {
    await supabase.from('routine_items').delete().eq('id', id)
    setItems(prev => prev.filter(it => it.id !== id))
  }

  const dayItems = items.filter(it => it.day_of_week === activeDay)

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-gym-200 border-t-gym-500 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 fade-up">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-iron-100 text-iron-400 transition-colors">
          <i className="ti ti-arrow-left text-lg" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-iron-900">Rutina de {student?.full_name}</h1>
          <p className="text-sm text-iron-400 mt-0.5 capitalize">{routine?.month}</p>
        </div>
      </div>

      {/* Days */}
      <div className="flex gap-2 flex-wrap">
        {DAYS.map(d => (
          <button key={d} onClick={() => setActiveDay(d)} className={`day-chip ${activeDay === d ? 'active' : ''}`}>{d}</button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-iron-50 border-b border-iron-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-iron-500 uppercase tracking-wide">Ejercicio</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-iron-500 uppercase tracking-wide w-24">Bloque</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-iron-500 uppercase tracking-wide w-16">Series</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-iron-500 uppercase tracking-wide w-16">Reps</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-iron-500 uppercase tracking-wide w-28">Sugerido (kg)</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-iron-50">
              {dayItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-iron-300 text-sm">
                    <i className="ti ti-clipboard-list text-3xl block mb-2" />
                    Sin ejercicios para {activeDay}. Agregá uno abajo.
                  </td>
                </tr>
              ) : dayItems.map(item => (
                <tr key={item.id} className="hover:bg-iron-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-iron-800">{item.exercises?.name}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={blockBadge(item.block)}>{item.block}</span>
                  </td>
                  <td className="px-3 py-3 text-center text-iron-600">{item.series}</td>
                  <td className="px-3 py-3 text-center text-iron-600">{item.reps}</td>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="number"
                      value={item.suggested_kg}
                      onChange={e => updateSuggested(item.id, parseFloat(e.target.value) || 0)}
                      className="w-20 text-center input py-1.5 text-gym-700 font-semibold"
                      min="0"
                      step="0.5"
                    />
                  </td>
                  <td className="px-2 py-3">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-iron-300 hover:text-red-400 transition-colors"
                    >
                      <i className="ti ti-trash text-sm" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add item row */}
        {showAddItem ? (
          <div className="border-t border-iron-100 p-4 bg-iron-50/50">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="label">Ejercicio</label>
                <select className="input" value={newItem.exercise_id} onChange={e => setNewItem(n => ({...n, exercise_id: e.target.value}))}>
                  <option value="">Seleccionar...</option>
                  {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Bloque</label>
                <select className="input" value={newItem.block} onChange={e => setNewItem(n => ({...n, block: e.target.value}))}>
                  {BLOCKS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Series × Reps</label>
                <div className="flex gap-1 items-center">
                  <input type="number" className="input w-14 text-center" value={newItem.series} min="1" onChange={e => setNewItem(n => ({...n, series: +e.target.value}))} />
                  <span className="text-iron-400 text-xs">×</span>
                  <input type="number" className="input w-14 text-center" value={newItem.reps} min="1" onChange={e => setNewItem(n => ({...n, reps: +e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">Sug. (kg)</label>
                <input type="number" className="input" value={newItem.suggested_kg} min="0" step="0.5"
                  onChange={e => setNewItem(n => ({...n, suggested_kg: +e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={addItem} className="btn-primary text-sm py-2"><i className="ti ti-plus" />Agregar</button>
              <button onClick={() => setShowAddItem(false)} className="btn-secondary text-sm py-2">Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="border-t border-iron-50 p-3">
            <button onClick={() => setShowAddItem(true)} className="flex items-center gap-2 text-sm text-iron-400 hover:text-gym-600 w-full px-2 py-1.5 rounded-lg hover:bg-gym-50 transition-colors">
              <i className="ti ti-plus text-base" />Agregar ejercicio
            </button>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={saveAll} disabled={saving} className="btn-primary">
          {saving ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando...</>
          ) : saved ? (
            <><i className="ti ti-check" />¡Guardado!</>
          ) : (
            <><i className="ti ti-device-floppy" />Guardar pesos sugeridos</>
          )}
        </button>
        <p className="text-xs text-iron-400">Los cambios en pesos sugeridos serán visibles al alumno de inmediato.</p>
      </div>
    </div>
  )
}
