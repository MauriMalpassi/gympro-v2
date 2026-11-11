import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

const BLOCK_CLASSES = { 'Bloque 1': 'badge-block1', 'Bloque 2': 'badge-block2', 'Bloque 3': 'badge-block3' }
const COLORS = ['#E1F5EE','#FAEEDA','#E6F1FB']
const TEXT_COLORS = ['#085041','#633806','#0C447C']
const WEEKS = [1, 2, 3, 4]

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function TeacherDashboard() {
  const [students, setStudents] = useState([])
  const [selectedStu, setSelectedStu] = useState(null)
  const [days, setDays] = useState([])
  const [activeDay, setActiveDay] = useState(null)
  const [activeWeek, setActiveWeek] = useState(1)
  const [exercises, setExercises] = useState([])
  const [suggested, setSuggested] = useState({})
  const [logs, setLogs] = useState({})
  const [saving, setSaving] = useState(false)
  const [overrides, setOverrides] = useState({})
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [editingOverride, setEditingOverride] = useState(null)
  const [overrideForm, setOverrideForm] = useState({ custom_name: '', custom_series: '', custom_reps: '', notes: '' })
  const [toast, setToast] = useState('')
  const [sessionCount, setSessionCount] = useState(0)
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

  // Combobox states for override modal
  const [allExercises, setAllExercises] = useState([])
  const [overrideSearch, setOverrideSearch] = useState('')
  const [showOverrideDropdown, setShowOverrideDropdown] = useState(false)
  const overrideComboRef = useRef(null)

  useEffect(() => { loadInitialData() }, [])

  useEffect(() => {
    if (selectedStu && activeDay) {
      loadExercises()
      loadLogs()
      loadStats()
      loadOverrides()
    }
  }, [selectedStu, activeDay, activeWeek])

  useEffect(() => {
    if (selectedStu && activeDay) buildChart()
  }, [exercises, suggested, logs])

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (overrideComboRef.current && !overrideComboRef.current.contains(e.target)) {
        setShowOverrideDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadInitialData() {
    const [{ data: stus }, { data: daysData }, { data: allEx }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'student').order('name'),
      supabase.from('training_days').select('*').order('order_index'),
      supabase.from('exercises').select('*').order('name')
    ])
    setStudents(stus || [])
    setDays(daysData || [])
    setAllExercises(allEx || [])
    if (stus?.length) setSelectedStu(stus[0].id)
    if (daysData?.length) setActiveDay(daysData[0].id)
  }

  async function loadOverrides() {
    if (!selectedStu) return
    const { data } = await supabase
      .from('exercise_overrides')
      .select('*')
      .eq('student_id', selectedStu)
    const map = {}
    data?.forEach(o => { map[o.exercise_id] = o })
    setOverrides(map)
  }

  async function saveOverride(e) {
    e.preventDefault()
    if (!editingOverride) return
    await supabase.from('exercise_overrides').upsert({
      student_id: selectedStu,
      exercise_id: editingOverride.id,
      custom_name: overrideForm.custom_name || null,
      custom_series: overrideForm.custom_series ? Number(overrideForm.custom_series) : null,
      custom_reps: overrideForm.custom_reps ? Number(overrideForm.custom_reps) : null,
      notes: overrideForm.notes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,exercise_id' })
    setShowOverrideModal(false)
    loadOverrides()
    showToast('Personalización guardada')
  }

  async function deleteOverride(exerciseId) {
    await supabase.from('exercise_overrides').delete()
      .eq('student_id', selectedStu).eq('exercise_id', exerciseId)
    loadOverrides()
    showToast('Personalización eliminada')
  }

  function openOverride(ex) {
    const existing = overrides[ex.id]
    setEditingOverride(ex)
    const nameVal = existing?.custom_name || ex.name
    setOverrideForm({
      custom_name: nameVal,
      custom_series: existing?.custom_series || ex.series,
      custom_reps: existing?.custom_reps || ex.reps,
      notes: existing?.notes || '',
    })
    setOverrideSearch(nameVal)
    setShowOverrideModal(true)
  }

  function selectOverrideExercise(ex) {
    setOverrideForm(p => ({
      ...p,
      custom_name: ex.name,
      custom_series: ex.series ?? p.custom_series,
      custom_reps: ex.reps ?? p.custom_reps,
    }))
    setOverrideSearch(ex.name)
    setShowOverrideDropdown(false)
  }

  const filteredOverrideExercises = allExercises.filter(ex =>
    ex.name.toLowerCase().includes(overrideSearch.toLowerCase())
  )

  async function loadExercises() {
    // Buscar rutina activa primero
    const { data: activeRoutine } = await supabase
      .from('monthly_routines')
      .select('id')
      .eq('is_active', true)
      .maybeSingle()

    if (!activeRoutine) { setExercises([]); return }

    const { data } = await supabase
      .from('exercises')
      .select('*')
      .eq('training_day_id', activeDay)
      .eq('monthly_routine_id', activeRoutine.id)
      .order('block_order')
      .order('order_index')
    setExercises(data || [])

    const { data: sw } = await supabase
      .from('suggested_weights')
      .select('*')
      .eq('student_id', selectedStu)
      .in('exercise_id', (data || []).map(e => e.id))

    const map = {}
    sw?.forEach(s => { map[s.exercise_id] = s.weight_kg })
    setSuggested(map)
  }

  async function loadLogs() {
    const monthYear = new Date().toISOString().slice(0, 7)
    const { data: session } = await supabase
      .from('training_sessions')
      .select('id')
      .eq('student_id', selectedStu)
      .eq('training_day_id', activeDay)
      .eq('week_number', activeWeek)
      .eq('month_year', monthYear)
      .maybeSingle()

    if (!session) { setLogs({}); return }

    const { data: logData } = await supabase
      .from('exercise_logs')
      .select('exercise_id, weight_used_kg')
      .eq('session_id', session.id)

    const map = {}
    logData?.forEach(l => { map[l.exercise_id] = l.weight_used_kg })
    setLogs(map)
  }

  async function loadStats() {
    const { count } = await supabase
      .from('training_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', selectedStu)
    setSessionCount(count || 0)
  }

  async function updateSuggested(exerciseId, value) {
    const kg = parseFloat(value) || 0
    setSuggested(prev => ({ ...prev, [exerciseId]: kg }))
    setSaving(true)
    await supabase.from('suggested_weights').upsert({
      student_id: selectedStu,
      exercise_id: exerciseId,
      weight_kg: kg,
      updated_at: new Date().toISOString()
    }, { onConflict: 'student_id,exercise_id' })
    setSaving(false)
    showToast('Peso sugerido guardado')
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  function buildChart() {
    if (!chartRef.current) return
    if (chartInstance.current) chartInstance.current.destroy()

    const labels = exercises.map(e => {
      const name = overrides[e.id]?.custom_name || e.name
      return name.length > 18 ? name.slice(0, 18) + '…' : name
    })
    const dataUsed = exercises.map(e => logs[e.id] ?? null)
    const dataSug = exercises.map(e => suggested[e.id] ?? 0)

    chartInstance.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Utilizado (kg)',
            data: dataUsed,
            backgroundColor: 'rgba(29,158,117,0.7)',
            borderColor: '#1D9E75',
            borderWidth: 1.5,
            borderRadius: 6,
          },
          {
            label: 'Sugerido (kg)',
            data: dataSug,
            type: 'line',
            borderColor: '#BA7517',
            borderDash: [4, 3],
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#BA7517',
            fill: false,
            tension: 0.3,
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: v => v + ' kg', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
          x: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }
    })
  }

  const currentStu = students.find(s => s.id === selectedStu)

  return (
    <div className="space-y-5 py-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-primary-400 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-lg">
          <i className="ti ti-check" /> {toast}
        </div>
      )}

      <div>
        <p className="label mb-2">Alumno seleccionado</p>
        <div className="flex gap-2 flex-wrap">
          {students.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSelectedStu(s.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all
                ${selectedStu === s.id
                  ? 'border-primary-400 bg-primary-50 text-primary-800 font-medium'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium"
                style={{ background: COLORS[i % 3], color: TEXT_COLORS[i % 3] }}>
                {getInitials(s.name)}
              </span>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Sesiones', val: sessionCount, sub: 'registradas' },
          { label: 'Ejercicios', val: exercises.length, sub: activeDay ? days.find(d => d.id === activeDay)?.name : '' },
          { label: 'Días / semana', val: 3, sub: 'Lun · Mié · Vie' },
          { label: 'Semanas', val: 4, sub: 'mes actual' },
        ].map(s => (
          <div key={s.label} className="bg-gray-100 rounded-xl p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-medium text-gray-900 mt-1">{s.val}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2 flex-wrap">
          {days.map(d => (
            <button key={d.id} onClick={() => setActiveDay(d.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all
                ${activeDay === d.id ? 'bg-primary-400 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-400'}`}>
              {d.name}
            </button>
          ))}
        </div>
        <select
          value={activeWeek}
          onChange={e => setActiveWeek(Number(e.target.value))}
          className="input !w-auto text-sm py-1.5"
        >
          {WEEKS.map(w => <option key={w} value={w}>Semana {w}</option>)}
        </select>
        {saving && <span className="text-xs text-gray-400 flex items-center gap-1"><i className="ti ti-loader animate-spin" />Guardando…</span>}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Ejercicio</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Bloque</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">S</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">R</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide min-w-[100px]">Sugerido</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Personal.</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Utilizado</th>
              </tr>
            </thead>
            <tbody>
              {exercises.map(ex => (
                <tr key={ex.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {overrides[ex.id]?.custom_name || ex.name}
                    {overrides[ex.id]?.custom_name && overrides[ex.id]?.custom_name !== ex.name &&
                      <span className="text-xs text-primary-400 ml-1">*</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={BLOCK_CLASSES[ex.block_name] || 'badge-block1'}>{ex.block_name}</span>
                  </td>
                  <td className="px-3 py-3 text-center text-gray-500">
                    {overrides[ex.id]?.custom_series || ex.series}
                    {overrides[ex.id]?.custom_series && <span className="text-xs text-primary-400 ml-1">*</span>}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-500">
                    {overrides[ex.id]?.custom_reps || ex.reps}
                    {overrides[ex.id]?.custom_reps && <span className="text-xs text-primary-400 ml-1">*</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={suggested[ex.id] ?? ''}
                      onChange={e => updateSuggested(ex.id, e.target.value)}
                      placeholder="kg"
                      className="w-20 px-2 py-1 text-center text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400 bg-white"
                    />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button onClick={() => openOverride(ex)}
                      className={`p-1.5 rounded-lg transition-colors text-sm
                        ${overrides[ex.id] ? 'text-primary-400 bg-primary-50' : 'text-gray-300 hover:text-primary-400 hover:bg-primary-50'}`}
                      title="Personalizar para este alumno">
                      <i className="ti ti-user-edit" />
                    </button>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-medium ${logs[ex.id] !== undefined ? 'text-primary-600' : 'text-gray-300'}`}>
                      {logs[ex.id] !== undefined ? `${logs[ex.id]} kg` : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-4">
          <i className="ti ti-chart-bar text-primary-400 text-lg" />
          <h3 className="font-medium text-gray-800">Comparación de pesos — {currentStu?.name}</h3>
          <div className="ml-auto flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary-400/70 inline-block" />Utilizado</span>
            <span className="flex items-center gap-1.5"><span className="w-5 border-b-2 border-dashed border-accent-400 inline-block" />Sugerido</span>
          </div>
        </div>
        <div className="relative h-52">
          <canvas ref={chartRef} />
        </div>
      </div>

      {showOverrideModal && editingOverride && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-medium text-gray-900 mb-1 flex items-center gap-2">
              <i className="ti ti-user-edit text-primary-400" /> Personalizar ejercicio
            </h3>
            <p className="text-xs text-gray-400 mb-4">Solo para {currentStu?.name}</p>
            <form onSubmit={saveOverride} className="space-y-3">
              <div>
                <label className="label">Nombre del ejercicio</label>
                <div className="relative" ref={overrideComboRef}>
                  <input
                    className="input"
                    value={overrideSearch}
                    onChange={e => {
                      setOverrideSearch(e.target.value)
                      setOverrideForm(p => ({ ...p, custom_name: e.target.value }))
                      setShowOverrideDropdown(true)
                    }}
                    onFocus={() => setShowOverrideDropdown(true)}
                    placeholder="Buscar ejercicio..."
                    autoComplete="off"
                  />
                  {showOverrideDropdown && filteredOverrideExercises.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredOverrideExercises.map(ex => (
                        <div
                          key={ex.id}
                          onMouseDown={() => selectOverrideExercise(ex)}
                          className="px-3 py-2 hover:bg-primary-50 cursor-pointer text-sm text-gray-700"
                        >
                          {ex.name}
                          {ex.muscle_group && (
                            <span className="text-xs text-gray-400 ml-2">{ex.muscle_group}</span>
                          )}
                        </div>
                      ))}
                      {overrideSearch && !filteredOverrideExercises.find(e => e.name.toLowerCase() === overrideSearch.toLowerCase()) && (
                        <div
                          onMouseDown={() => {
                            setOverrideForm(p => ({ ...p, custom_name: overrideSearch }))
                            setShowOverrideDropdown(false)
                          }}
                          className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-500 border-t border-gray-100"
                        >
                          Usar "{overrideSearch}" como nombre personalizado
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Series</label>
                  <input className="input" type="number" min="1" value={overrideForm.custom_series}
                    onChange={e => setOverrideForm(p => ({ ...p, custom_series: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Repeticiones</label>
                  <input className="input" type="number" min="1" value={overrideForm.custom_reps}
                    onChange={e => setOverrideForm(p => ({ ...p, custom_reps: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Notas (opcional)</label>
                <textarea className="input resize-none" rows={2} value={overrideForm.notes}
                  onChange={e => setOverrideForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              {overrides[editingOverride.id] && (
                <button type="button" onClick={() => { deleteOverride(editingOverride.id); setShowOverrideModal(false) }}
                  className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                  <i className="ti ti-trash" /> Quitar personalización
                </button>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowOverrideModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
