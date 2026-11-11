import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const BLOCK_CLASSES = { 'Bloque 1': 'badge-block1', 'Bloque 2': 'badge-block2', 'Bloque 3': 'badge-block3' }

export default function RutinasPage() {
  const [routines, setRoutines] = useState([])
  const [days, setDays] = useState([])
  const [activeRoutine, setActiveRoutine] = useState(null)
  const [exercises, setExercises] = useState([])
  const [allExercises, setAllExercises] = useState([])
  const [activeDay, setActiveDay] = useState(null)
  const [showNewRoutine, setShowNewRoutine] = useState(false)
  const [showNewExercise, setShowNewExercise] = useState(false)
  const [editingEx, setEditingEx] = useState(null)
  const [form, setForm] = useState({ name: '', series: 4, reps: 12, block_name: 'Bloque 1', muscle_group: '', video_url: '' })
  const [monthYear, setMonthYear] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  // Combobox states
  const [exSearch, setExSearch] = useState('')
  const [showExDropdown, setShowExDropdown] = useState(false)
  const comboRef = useRef(null)

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (activeRoutine && activeDay) loadExercises() }, [activeRoutine, activeDay])

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (comboRef.current && !comboRef.current.contains(e.target)) {
        setShowExDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadData() {
    const [{ data: ruts }, { data: ds }, { data: allEx }] = await Promise.all([
      supabase.from('monthly_routines').select('*').order('month_year', { ascending: false }),
      supabase.from('training_days').select('*').order('order_index'),
      supabase.from('exercises').select('*').order('name'),
    ])
    setRoutines(ruts || [])
    setDays(ds || [])
    setAllExercises(allEx || [])
    if (ruts?.length) setActiveRoutine(ruts[0].id)
    if (ds?.length) setActiveDay(ds[0].id)
  }

  async function loadExercises() {
    const { data } = await supabase
      .from('monthly_exercises')
      .select('*')
      .eq('monthly_routine_id', activeRoutine)
      .eq('training_day_id', activeDay)
      .order('order_index')
    setExercises(data || [])
  }

  async function createRoutine() {
    if (!monthYear) { alert('Elegí un mes'); return }
    setLoading(true)
    try {
      const { data: currentExs } = await supabase
  .from('monthly_exercises')
  .select('*')
  .eq('monthly_routine_id', (await supabase.from('monthly_routines').select('id').eq('is_active', true).maybeSingle()).data?.id)
  .order('block_order')
  .order('order_index')

      const { data: newRoutine } = await supabase
        .from('monthly_routines')
        .insert({ month_year: monthYear, name: `Rutina ${monthYear}`, is_active: false })
        .select().single()

      if (currentExs?.length) {
        await supabase.from('monthly_exercises').insert(
          currentExs.map(ex => ({
            monthly_routine_id: newRoutine.id,
            training_day_id: ex.training_day_id,
            block_name: ex.block_name,
            block_order: ex.block_order,
            name: ex.name,
            series: ex.series,
            reps: ex.reps,
            order_index: ex.order_index,
            muscle_group: ex.muscle_group,
            video_url: ex.video_url,
          }))
        )
      }

      setShowNewRoutine(false)
      setMonthYear('')
      loadData()
      showToast('Rutina creada — ya podés editarla')
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ✅ SAFE activateRoutine: UPDATE por nombre en lugar de DELETE + INSERT
  // Preserva los UUIDs de exercises → no rompe exercise_logs
  async function activateRoutine(id) {
    if (!confirm('¿Activar esta rutina? Los alumnos verán estos ejercicios desde ahora.')) return
    setLoading(true)
    try {
      // 1. Desactivar todas, activar esta
      await supabase.from('monthly_routines').update({ is_active: false }).neq('id', id)
      await supabase.from('monthly_routines').update({ is_active: true }).eq('id', id)

      // 2. Traer ejercicios de la rutina mensual a activar
      const { data: monthlyExs } = await supabase
        .from('monthly_exercises')
        .select('*')
        .eq('monthly_routine_id', id)

      if (!monthlyExs?.length) {
        loadData()
        showToast('¡Rutina activada!')
        return
      }

      // 3. Traer ejercicios actuales de la tabla exercises
      const { data: currentExs } = await supabase
        .from('exercises')
        .select('id, name')

      const currentByName = {}
      for (const ex of (currentExs || [])) {
        currentByName[ex.name.toLowerCase().trim()] = ex.id
      }

      const toUpdate = []
      const toInsert = []

      for (const mex of monthlyExs) {
        const key = mex.name.toLowerCase().trim()
        if (currentByName[key]) {
          // Ejercicio existente → UPDATE (preserva UUID y no rompe exercise_logs)
          toUpdate.push({ id: currentByName[key], data: mex })
        } else {
          // Ejercicio nuevo → INSERT
          toInsert.push(mex)
        }
      }

      // 4. UPDATE en paralelo (en lotes de 10 para no saturar)
      for (const { id: exId, data: mex } of toUpdate) {
        await supabase.from('exercises').update({
          training_day_id: mex.training_day_id,
          block_name: mex.block_name,
          block_order: mex.block_order,
          series: mex.series,
          reps: mex.reps,
          order_index: mex.order_index,
          muscle_group: mex.muscle_group,
          video_url: mex.video_url,
          description: mex.description || null,
        }).eq('id', exId)
      }

      // 5. INSERT ejercicios nuevos
      if (toInsert.length) {
        await supabase.from('exercises').insert(
          toInsert.map(mex => ({
            training_day_id: mex.training_day_id,
            block_name: mex.block_name,
            block_order: mex.block_order,
            name: mex.name,
            series: mex.series,
            reps: mex.reps,
            order_index: mex.order_index,
            muscle_group: mex.muscle_group,
            video_url: mex.video_url,
            description: mex.description || null,
          }))
        )
      }

      loadData()
      showToast(`¡Rutina activada! ${toUpdate.length} actualizados, ${toInsert.length} nuevos`)
    } catch (err) {
      alert('Error al activar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function openRename(routine) {
    setRenameValue(routine.month_year)
    setShowRenameModal(true)
  }

  async function saveRename(e) {
    e.preventDefault()
    if (!renameValue) return
    await supabase.from('monthly_routines')
      .update({ month_year: renameValue, name: `Rutina ${renameValue}` })
      .eq('id', activeRoutine)
    setShowRenameModal(false)
    loadData()
    showToast('Rutina renombrada')
  }

  async function saveExercise(e) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editingEx) {
        await supabase.from('monthly_exercises').update({
          name: form.name, series: Number(form.series), reps: Number(form.reps),
          block_name: form.block_name, muscle_group: form.muscle_group, video_url: form.video_url,
        }).eq('id', editingEx.id)
        showToast('Ejercicio actualizado')
      } else {
        const maxOrder = exercises.length ? Math.max(...exercises.map(e => e.order_index)) + 1 : 1
        await supabase.from('monthly_exercises').insert({
          monthly_routine_id: activeRoutine,
          training_day_id: activeDay,
          name: form.name, series: Number(form.series), reps: Number(form.reps),
          block_name: form.block_name,
          block_order: form.block_name === 'Bloque 1' ? 1 : form.block_name === 'Bloque 2' ? 2 : 3,
          muscle_group: form.muscle_group, video_url: form.video_url,
          order_index: maxOrder,
        })
                 // Guardar en biblioteca si es ejercicio nuevo
        const exists = allExercises.find(e => e.name.toLowerCase().trim() === form.name.toLowerCase().trim())
        if (!exists) {
          const { data: newEx } = await supabase.from('exercises').insert({
            training_day_id: activeDay,
            block_name: form.block_name,
            block_order: form.block_name === 'Bloque 1' ? 1 : form.block_name === 'Bloque 2' ? 2 : 3,
            name: form.name,
            series: Number(form.series),
            reps: Number(form.reps),
            muscle_group: form.muscle_group,
            video_url: form.video_url,
            monthly_routine_id: activeRoutine,
          }).select().single()
          if (newEx) setAllExercises(p => [...p, newEx])
        }       
        showToast('Ejercicio agregado')
      }
      setShowNewExercise(false)
      setEditingEx(null)
      setForm({ name: '', series: 4, reps: 12, block_name: 'Bloque 1', muscle_group: '', video_url: '' })
      setExSearch('')
      loadExercises()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function deleteExercise(id) {
    if (!confirm('¿Eliminar este ejercicio de la rutina?')) return
    await supabase.from('monthly_exercises').delete().eq('id', id)
    loadExercises()
    showToast('Ejercicio eliminado')
  }

  function openEdit(ex) {
    setEditingEx(ex)
    setForm({ name: ex.name, series: ex.series, reps: ex.reps, block_name: ex.block_name, muscle_group: ex.muscle_group || '', video_url: ex.video_url || '' })
    setExSearch(ex.name)
    setShowNewExercise(true)
  }

  function openNew() {
    setEditingEx(null)
    setForm({ name: '', series: 4, reps: 12, block_name: 'Bloque 1', muscle_group: '', video_url: '' })
    setExSearch('')
    setShowNewExercise(true)
  }

  function selectExercise(ex) {
    setForm(p => ({
      ...p,
      name: ex.name,
      muscle_group: ex.muscle_group || p.muscle_group,
      video_url: ex.video_url || '',
      series: ex.series || p.series,
      reps: ex.reps || p.reps,
    }))
    setExSearch(ex.name)
    setShowExDropdown(false)
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const currentRoutine = routines.find(r => r.id === activeRoutine)
  const filteredExs = allExercises.filter(ex =>
    ex.name.toLowerCase().includes(exSearch.toLowerCase())
  )

  return (
    <div className="py-4 space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-primary-400 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-lg">
          <i className="ti ti-check" /> {toast}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2">
          <i className="ti ti-calendar-month text-primary-400" /> Rutinas mensuales
        </h2>
        <button onClick={() => setShowNewRoutine(true)} className="btn-primary flex items-center gap-2 text-sm">
          <i className="ti ti-plus" /> Nueva rutina
        </button>
      </div>

      {/* Selector de rutinas */}
      <div className="flex gap-2 flex-wrap">
        {routines.map(r => (
          <button key={r.id} onClick={() => setActiveRoutine(r.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-all
              ${activeRoutine === r.id ? 'border-primary-400 bg-primary-50 text-primary-800 font-medium' : 'border-gray-200 bg-white text-gray-600'}`}>
            {r.month_year}
            {r.is_active && <span className="w-2 h-2 rounded-full bg-primary-400 inline-block" />}
          </button>
        ))}
        {!routines.length && <p className="text-sm text-gray-400">No hay rutinas creadas todavía</p>}
      </div>

      {currentRoutine && (
        <>
          {/* Info de la rutina */}
                   <div className={`card p-4 flex items-center justify-between gap-3 ${currentRoutine.is_active ? 'border-primary-400' : ''}`}>
            <div>
              <p className="font-medium text-gray-900">{currentRoutine.month_year}</p>
              <p className="text-xs mt-0.5">
                {currentRoutine.is_active
                  ? <span className="text-primary-600 font-medium">✓ Activa — los alumnos ven esta rutina</span>
                  : currentRoutine.month_year < new Date().toISOString().slice(0, 7)
                  ? <span className="text-gray-400">📦 Archivada — solo lectura</span>
                  : <span className="text-yellow-600">En preparación — los alumnos aún no la ven</span>}
              </p>
            </div>
            <div className="flex gap-2">
              {!currentRoutine.is_active && currentRoutine.month_year >= new Date().toISOString().slice(0, 7) && (
                <>
                  <button onClick={() => openRename(currentRoutine)}
                    className="btn-secondary text-sm flex items-center gap-1.5">
                    <i className="ti ti-pencil text-xs" /> Cambiar mes
                  </button>
                  <button onClick={() => activateRoutine(currentRoutine.id)}
                    className="btn-primary text-sm flex items-center gap-2" disabled={loading}>
                    {loading ? <i className="ti ti-loader animate-spin" /> : <i className="ti ti-player-play" />} Activar
                  </button>
                </>
              )}
            </div>
          </div>
          {/* Selector de día */}
          <div className="flex gap-2 flex-wrap">
            {days.map(d => (
              <button key={d.id} onClick={() => setActiveDay(d.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all
                  ${activeDay === d.id ? 'bg-primary-400 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                {d.name}
              </button>
            ))}
          </div>

          {/* Botón agregar ejercicio */}
          <div className="flex justify-end">
            <button onClick={openNew}
              className="btn-secondary flex items-center gap-2 text-sm">
              <i className="ti ti-plus" /> Agregar ejercicio
            </button>
          </div>

          {/* Lista de ejercicios */}
          <div className="space-y-2">
            {exercises.map(ex => (
              <div key={ex.id} className="card p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={BLOCK_CLASSES[ex.block_name] || 'badge-block1'}>{ex.block_name}</span>
                    {ex.muscle_group && <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">{ex.muscle_group}</span>}
                    {ex.video_url && ex.video_url !== 'EMPTY' && ex.video_url.trim() !== '' && (
                      <span className="text-xs px-2 py-0.5 bg-red-50 rounded-full text-red-400 flex items-center gap-1">
                        <i className="ti ti-player-play text-xs" /> video
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-900">{ex.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{ex.series} series × {ex.reps} reps</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(ex)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                    <i className="ti ti-edit text-base" />
                  </button>
                  <button onClick={() => deleteExercise(ex.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                    <i className="ti ti-trash text-base" />
                  </button>
                </div>
              </div>
            ))}
            {!exercises.length && (
              <div className="text-center py-8 text-gray-400">
                <i className="ti ti-barbell text-3xl block mb-2" />
                <p className="text-sm">Sin ejercicios para este día</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal nueva rutina */}
      {showNewRoutine && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-medium text-gray-900 mb-4 flex items-center gap-2">
              <i className="ti ti-calendar-month text-primary-400" /> Nueva rutina mensual
            </h3>
            <p className="text-sm text-gray-500 mb-4">Se va a crear con los ejercicios actuales como base para que puedas editarlos.</p>
            <div>
              <label className="label">Mes</label>
              <input type="month" className="input" value={monthYear} onChange={e => setMonthYear(e.target.value)} />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowNewRoutine(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={createRoutine} className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={loading}>
                {loading ? <i className="ti ti-loader animate-spin" /> : null} Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal renombrar rutina */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-medium text-gray-900 mb-4 flex items-center gap-2">
              <i className="ti ti-pencil text-primary-400" /> Cambiar mes de la rutina
            </h3>
            <form onSubmit={saveRename} className="space-y-4">
              <div>
                <label className="label">Mes</label>
                <input type="month" className="input" value={renameValue} onChange={e => setRenameValue(e.target.value)} required />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowRenameModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ejercicio con combobox */}
      {showNewExercise && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-medium text-gray-900 mb-4 flex items-center gap-2">
              <i className="ti ti-barbell text-primary-400" />
              {editingEx ? 'Editar ejercicio' : 'Agregar ejercicio'}
            </h3>
            <form onSubmit={saveExercise} className="space-y-3">

              {/* ✅ COMBOBOX: busca en la biblioteca de ejercicios */}
              <div>
                <label className="label">Nombre</label>
                <div className="relative" ref={comboRef}>
                  <input
                    className="input pr-8"
                    placeholder="Buscar en biblioteca..."
                    value={exSearch}
                    onChange={e => {
                      setExSearch(e.target.value)
                      setForm(p => ({ ...p, name: e.target.value }))
                      setShowExDropdown(true)
                    }}
                    onFocus={() => setShowExDropdown(true)}
                    required
                  />
                  <i className="ti ti-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />

                  {showExDropdown && (filteredExs.length > 0 || exSearch) && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                      {filteredExs.map(ex => (
                        <button
                          key={ex.id}
                          type="button"
                          onMouseDown={() => selectExercise(ex)}
                          className="w-full text-left px-3 py-2.5 hover:bg-primary-50 flex items-center justify-between gap-2 text-sm border-b border-gray-50 last:border-0"
                        >
                          <span className="font-medium text-gray-800 truncate">{ex.name}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {ex.muscle_group && (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded-full text-gray-500">{ex.muscle_group}</span>
                            )}
                            {ex.video_url && ex.video_url.trim() && ex.video_url !== 'EMPTY' && (
                              <span className="text-xs px-1.5 py-0.5 bg-red-50 rounded-full text-red-400 flex items-center gap-0.5">
                                <i className="ti ti-player-play text-xs" /> video
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                      {/* Opción para usar nombre nuevo si no existe en la biblioteca */}
                      {exSearch && !allExercises.find(ex => ex.name.toLowerCase() === exSearch.toLowerCase()) && (
                        <button
                          type="button"
                          onMouseDown={() => {
                            setForm(p => ({ ...p, name: exSearch }))
                            setShowExDropdown(false)
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-yellow-50 text-sm text-yellow-700 border-t border-gray-100 flex items-center gap-2"
                        >
                          <i className="ti ti-plus text-xs" />
                          Usar "{exSearch}" como nombre nuevo
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Bloque</label>
                  <select className="input" value={form.block_name} onChange={e => setForm(p => ({ ...p, block_name: e.target.value }))}>
                    <option>Bloque 1</option>
                    <option>Bloque 2</option>
                    <option>Bloque 3</option>
                  </select>
                </div>
                <div>
                  <label className="label">Grupo muscular</label>
                  <input className="input" placeholder="Ej: Pecho"
                    value={form.muscle_group} onChange={e => setForm(p => ({ ...p, muscle_group: e.target.value }))} />
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
                <label className="label">Video YouTube (opcional)</label>
                <input className="input" placeholder="https://youtube.com/watch?v=..."
                  value={form.video_url} onChange={e => setForm(p => ({ ...p, video_url: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowNewExercise(false); setEditingEx(null); setExSearch('') }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={loading}>
                  {loading ? <i className="ti ti-loader animate-spin" /> : null}
                  {editingEx ? 'Guardar' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
