import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth.jsx'
import { supabase } from '../../lib/supabase'
import { exportHistoryExcel } from '../../lib/export'

export default function StudentHistory() {
  const { profile } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [availableMonths, setAvailableMonths] = useState([])

  useEffect(() => {
    if (profile) loadHistory()
  }, [profile])

  async function loadHistory() {
    // Paso 1: traer sesiones con días
    const { data: sessionsData } = await supabase
      .from('training_sessions')
      .select('*, training_days(name)')
      .eq('student_id', profile.id)
      .order('completed_at', { ascending: false })

    if (!sessionsData?.length) {
      setSessions([])
      setLoading(false)
      return
    }

    // Paso 2: traer todos los logs de esas sesiones
    const sessionIds = sessionsData.map(s => s.id)
    const { data: logsData } = await supabase
      .from('exercise_logs')
      .select('session_id, exercise_id, weight_used_kg, series_done, reps_done')
      .in('session_id', sessionIds)

    // Paso 3: traer nombres de ejercicios
    const exerciseIds = [...new Set((logsData || []).map(l => l.exercise_id))]
    let exerciseMap = {}
    if (exerciseIds.length) {
      const { data: exsData } = await supabase
        .from('exercises')
        .select('id, name, block_name')
        .in('id', exerciseIds)
      exsData?.forEach(e => { exerciseMap[e.id] = e })
    }

    // Combinar todo
    const logsBySession = {}
    logsData?.forEach(log => {
      if (!logsBySession[log.session_id]) logsBySession[log.session_id] = []
      logsBySession[log.session_id].push({
        ...log,
        exercises: exerciseMap[log.exercise_id] || null
      })
    })

    const all = sessionsData.map(s => ({
      ...s,
      exercise_logs: logsBySession[s.id] || []
    }))

    setSessions(all)
    const months = [...new Set(all.map(s => s.month_year))].sort().reverse()
    setAvailableMonths(months)
    if (months.length) setSelectedMonth(months[0])
    setLoading(false)
  }

  function formatMonth(my) {
    if (!my) return ''
    const [year, month] = my.split('-')
    const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    return `${nombres[parseInt(month) - 1]} ${year}`
  }

  const filteredSessions = sessions.filter(s => s.month_year === selectedMonth)
  const totalSessions = filteredSessions.length
  const totalExercises = filteredSessions.reduce((a, s) => a + (s.exercise_logs?.filter(l => l.weight_used_kg).length || 0), 0)
  const trainingDays = [...new Set(filteredSessions.map(s => s.training_days?.name))].filter(Boolean)

  if (loading) return (
    <div className="py-12 text-center text-gray-400">
      <i className="ti ti-loader animate-spin text-3xl block mb-2" />
    </div>
  )

  if (!sessions.length) return (
    <div className="py-16 text-center">
      <i className="ti ti-history text-5xl text-gray-200 block mb-3" />
      <p className="text-gray-500 font-medium">Sin entrenamientos registrados</p>
      <p className="text-sm text-gray-400 mt-1">Completá tu primera sesión en "Mi rutina"</p>
    </div>
  )

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2">
          <i className="ti ti-history text-primary-400" /> Historial
        </h2>
        <button onClick={() => exportHistoryExcel({ studentName: profile.name, history: sessions })}
          className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3">
          <i className="ti ti-file-spreadsheet text-sm" /> Excel
        </button>
      </div>

      <div>
        <p className="label mb-2">Mes</p>
        <div className="flex gap-2 flex-wrap">
          {availableMonths.map(m => (
            <button key={m} onClick={() => setSelectedMonth(m)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all
                ${selectedMonth === m
                  ? 'bg-primary-400 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-400'}`}>
              {formatMonth(m)}
            </button>
          ))}
        </div>
      </div>

      {selectedMonth && (
        <div className="card p-4">
          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <i className="ti ti-chart-bar text-primary-400" />
            Resumen de {formatMonth(selectedMonth)}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-medium text-primary-600">{totalSessions}</p>
              <p className="text-xs text-gray-500 mt-0.5">Sesiones</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-medium text-primary-600">{totalExercises}</p>
              <p className="text-xs text-gray-500 mt-0.5">Ejercicios</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-medium text-primary-600">{trainingDays.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Días activos</p>
            </div>
          </div>
          {trainingDays.length > 0 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {trainingDays.map(d => (
                <span key={d} className="text-xs px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full">{d}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <i className="ti ti-calendar-off text-3xl block mb-2" />
            <p className="text-sm">Sin entrenamientos en {formatMonth(selectedMonth)}</p>
          </div>
        ) : (
          filteredSessions.map(session => (
            <div key={session.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-gray-900 flex items-center gap-2">
                    <i className="ti ti-calendar text-primary-400 text-sm" />
                    {session.training_days?.name} · Semana {session.week_number}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(session.completed_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <span className="text-xs bg-primary-50 text-primary-800 px-2.5 py-1 rounded-full font-medium">
                  {session.exercise_logs?.filter(l => l.weight_used_kg).length || 0} ejercicios
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {session.exercise_logs?.filter(l => l.weight_used_kg).map((log, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 bg-gray-100 rounded-lg text-gray-700">
                    {log.exercises?.name || 'Ejercicio'} <strong className="text-primary-600">{log.weight_used_kg} kg</strong>
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
