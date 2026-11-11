import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth.jsx'
import { supabase } from '../../lib/supabase'
import { exportRoutinePDF } from '../../lib/export'

const BLOCK_CLASSES = { 'Bloque 1': 'badge-block1', 'Bloque 2': 'badge-block2', 'Bloque 3': 'badge-block3' }
const WEEKS = [1, 2, 3, 4]

export default function StudentRoutine() {
  const { profile } = useAuth()
  const [days, setDays] = useState([])
  const [activeDay, setActiveDay] = useState(null)
  const [activeWeek, setActiveWeek] = useState(1)
  const [exercises, setExercises] = useState([])
  const [suggested, setSuggested] = useState({})
  const [weights, setWeights] = useState({})
  const [sessionId, setSessionId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [autoSaveTimer, setAutoSaveTimer] = useState(null)
  const [toast, setToast] = useState('')
  const [teacherConfig, setTeacherConfig] = useState(null)
  const [showVideo, setShowVideo] = useState(null)
  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem('gympro_fontsize') || 'normal'
  })

  const monthYear = new Date().toISOString().slice(0, 7)

  const fontStyle = fontSize === 'muygrande'
    ? { fontSize: '22px' }
    : fontSize === 'grande'
    ? { fontSize: '18px' }
    : { fontSize: '15px' }

  const inputStyle = fontSize === 'muygrande'
    ? { fontSize: '28px', padding: '12px', width: '110px', fontWeight: 'bold' }
    : fontSize === 'grande'
    ? { fontSize: '22px', padding: '10px', width: '90px', fontWeight: 'bold' }
    : { fontSize: '14px', padding: '8px', width: '80px' }

  const labelStyle = fontSize === 'muygrande'
    ? { fontSize: '20px', fontWeight: '600' }
    : fontSize === 'grande'
    ? { fontSize: '17px', fontWeight: '500' }
    : { fontSize: '14px' }

  useEffect(() => {
    loadDaysAndTeacher()
  }, [])

  useEffect(() => {
    if (activeDay && profile) loadRoutine()
  }, [activeDay, activeWeek, profile])

  async function loadDaysAndTeacher() {
    const [{ data: daysData }, { data: tcData }] = await Promise.all([
      supabase.from('training_days').select('*').order('order_index'),
      supabase.from('teacher_config').select('*').limit(1).single(),
    ])
    setDays(daysData || [])
    if (daysData?.length) setActiveDay(daysData[0].id)
    if (tcData) setTeacherConfig(tcData)
  }

  async function loadRoutine() {
    // Traer ejercicios base, pesos sugeridos y overrides personalizados en paralelo
    const [{ data: exs }, { data: sw }, { data: overrides }] = await Promise.all([
      supabase.from('exercises').select('*').eq('training_day_id', activeDay).order('order_index'),
      supabase.from('suggested_weights').select('*').eq('student_id', profile.id),
      supabase.from('exercise_overrides').select('*').eq('student_id', profile.id),
    ])

    const baseExercises = exs || []

    // Buscar rutina mensual activa
    const { data: activeRoutine } = await supabase
      .from('monthly_routines')
      .select('id')
      .eq('is_active', true)
      .maybeSingle()

    if (activeRoutine) {
      // Traer monthly_exercises del mismo día, ordenados por order_index
      const { data: monthlyExs } = await supabase
        .from('monthly_exercises')
        .select('order_index, video_url')
        .eq('monthly_routine_id', activeRoutine.id)
        .eq('training_day_id', activeDay)
        .order('order_index')

      if (monthlyExs?.length) {
        // Mapear por order_index → video_url
        const videoByIndex = {}
        monthlyExs.forEach(me => {
          if (me.video_url && me.video_url !== 'EMPTY' && me.video_url.trim() !== '') {
            videoByIndex[me.order_index] = me.video_url
          }
        })
        // Asignar video_url a cada ejercicio base por su order_index
        baseExercises.forEach(ex => {
          if (videoByIndex[ex.order_index]) {
            ex.video_url = videoByIndex[ex.order_index]
          }
        })
      }
    }

    // Aplicar overrides personalizados del alumno (nombre, series, reps)
    if (overrides?.length) {
      const overrideMap = {}
      overrides.forEach(o => { overrideMap[o.exercise_id] = o })
      baseExercises.forEach(ex => {
        const ov = overrideMap[ex.id]
        if (ov) {
          if (ov.custom_name) ex.name = ov.custom_name
          if (ov.custom_series) ex.series = ov.custom_series
          if (ov.custom_reps) ex.reps = ov.custom_reps
          if (ov.notes) ex.description = ov.notes
        }
      })
    }

    setExercises(baseExercises)

    const sugMap = {}
    sw?.forEach(s => { sugMap[s.exercise_id] = s.weight_kg })
    setSuggested(sugMap)

    // FIX: usar maybeSingle() en vez de single() para evitar error cuando no hay sesión
    const { data: session } = await supabase
      .from('training_sessions')
      .select('id')
      .eq('student_id', profile.id)
      .eq('training_day_id', activeDay)
      .eq('week_number', activeWeek)
      .eq('month_year', monthYear)
      .maybeSingle()

    if (session) {
      setSessionId(session.id)
      const { data: logs } = await supabase
        .from('exercise_logs')
        .select('exercise_id, weight_used_kg')
        .eq('session_id', session.id)
      const map = {}
      logs?.forEach(l => { map[l.exercise_id] = l.weight_used_kg })
      setWeights(map)
    } else {
      setSessionId(null)
      setWeights({})
    }
  }

  async function autoSave(exerciseId, value) {
    if (!value || value === '') return
    try {
      let sid = sessionId
      if (!sid) {
        const { data: newSession } = await supabase
          .from('training_sessions')
          .upsert({
            student_id: profile.id,
            training_day_id: activeDay,
            week_number: activeWeek,
            month_year: monthYear,
            completed_at: new Date().toISOString(),
          }, { onConflict: 'student_id,training_day_id,week_number,month_year' })
          .select().single()
        sid = newSession.id
        setSessionId(sid)
      }
      await supabase.from('exercise_logs').upsert({
        session_id: sid,
        exercise_id: exerciseId,
        weight_used_kg: parseFloat(value),
      }, { onConflict: 'session_id,exercise_id' })
      showToast('Guardado ✓')
    } catch (err) {
      console.error('Autoguardado error:', err)
    }
  }

  async function saveWorkout() {
    setSaving(true)
    try {
      let sid = sessionId
      if (!sid) {
        const { data: newSession } = await supabase
          .from('training_sessions')
          .upsert({
            student_id: profile.id,
            training_day_id: activeDay,
            week_number: activeWeek,
            month_year: monthYear,
            completed_at: new Date().toISOString(),
          }, { onConflict: 'student_id,training_day_id,week_number,month_year' })
          .select().single()
        sid = newSession.id
        setSessionId(sid)
      }

      const logsToUpsert = Object.entries(weights)
        .filter(([, v]) => v !== '' && v !== undefined)
        .map(([exerciseId, weight]) => ({
          session_id: sid,
          exercise_id: exerciseId,
          weight_used_kg: parseFloat(weight),
          series_done: exercises.find(e => e.id === exerciseId)?.series,
          reps_done: exercises.find(e => e.id === exerciseId)?.reps,
        }))

      if (logsToUpsert.length) {
        await supabase.from('exercise_logs').upsert(logsToUpsert, { onConflict: 'session_id,exercise_id' })
      }
      showToast('¡Entrenamiento guardado!')
    } catch (err) {
      alert('Error al guardar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  function getYoutubeEmbed(url) {
    if (!url) return null
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&\s?]+)/)
    return match ? `https://www.youtube.com/embed/${match[1]}` : null
  }

  const currentDay = days.find(d => d.id === activeDay)

  return (
    <div className="py-4 space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-primary-400 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-lg">
          <i className="ti ti-check" /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2">
            <i className="ti ti-run text-primary-400" /> Mi rutina
          </h2>
          {teacherConfig?.display_name && (
            <p className="text-xs text-gray-400 mt-0.5">
              <i className="ti ti-user text-gray-300 mr-1" />
              Preparada por {teacherConfig.display_name}
            </p>
          )}
        </div>
        <button
          onClick={() => exportRoutinePDF({
            studentName: profile.name,
            dayName: currentDay?.name || '',
            weekLabel: `Semana ${activeWeek}`,
            exercises,
            logs: weights,
            suggested
          })}
          className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3"
        >
          <i className="ti ti-file-type-pdf text-sm" /> PDF
        </button>
      </div>

      {/* Day selector */}
      <div className="flex gap-2 flex-wrap">
        {days.map(d => (
          <button
            key={d.id}
            onClick={() => setActiveDay(d.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all
              ${activeDay === d.id ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}
            style={activeDay === d.id ? { background: d.color || '#1D9E75', borderColor: d.color || '#1D9E75' } : {}}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Tamaño de letra */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 font-medium">Tamaño de letra:</span>
        <div className="flex gap-2">
          {['normal', 'grande', 'muygrande'].map(s => (
            <button
              key={s}
              onClick={() => {
                setFontSize(s)
                localStorage.setItem('gympro_fontsize', s)
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all
                ${fontSize === s ? 'bg-primary-400 text-white border-primary-400' : 'bg-white border-gray-200 text-gray-600'}`}
            >
              {s === 'normal' ? 'A' : s === 'grande' ? 'A+' : 'A++'}
            </button>
          ))}
        </div>
      </div>

      {/* Week selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Semana:</span>
        <div className="flex gap-2">
          {WEEKS.map(w => (
            <button
              key={w}
              onClick={() => setActiveWeek(w)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-all
                ${activeWeek === w ? 'bg-primary-400 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-400'}`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise cards */}
      <div className="space-y-3">
        {exercises.map(ex => {
          const sug = suggested[ex.id]
          return (
            <div key={ex.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={BLOCK_CLASSES[ex.block_name] || 'badge-block1'}>{ex.block_name}</span>
                    {ex.muscle_group && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">{ex.muscle_group}</span>
                    )}
                  </div>
                  <h3 style={fontStyle} className="font-medium text-gray-900 flex items-center gap-2">
                    <i className="ti ti-barbell text-primary-400 text-sm" />{ex.name}
                  </h3>
                  {ex.description && <p className="text-xs text-gray-400 mt-1">{ex.description}</p>}
                </div>
                {ex.video_url && ex.video_url !== 'EMPTY' && ex.video_url.trim() !== '' && (
                  <button
                    onClick={() => setShowVideo(ex)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0 ml-2"
                  >
                    <i className="ti ti-player-play text-sm" /> Ver ejemplo
                  </button>
                )}
              </div>

              <div className="flex gap-2 mb-4 flex-wrap">
                <span className="text-xs px-2.5 py-1 bg-gray-100 rounded-lg text-gray-600">
                  <strong className="text-gray-900">{ex.series}</strong> series
                </span>
                <span className="text-xs px-2.5 py-1 bg-gray-100 rounded-lg text-gray-600">
                  <strong className="text-gray-900">{ex.reps}</strong> reps
                </span>
                {sug > 0 && (
                  <span className="text-xs px-2.5 py-1 bg-primary-50 rounded-lg text-primary-800">
                    Sugerido: <strong>{sug} kg</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                <div className="flex-1">
                  <p style={labelStyle} className="text-gray-700">Peso utilizado</p>
                  {sug > 0 && <p className="text-xs text-gray-400 mt-0.5">Referencia: {sug} kg</p>}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="kg"
                  value={weights[ex.id] ?? ''}
                  onChange={e => {
                    const val = e.target.value
                    const exId = ex.id
                    setWeights(p => ({ ...p, [exId]: val }))
                    if (autoSaveTimer) clearTimeout(autoSaveTimer)
                    setAutoSaveTimer(setTimeout(() => autoSave(exId, val), 1500))
                  }}
                  style={inputStyle}
                  className="text-center border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 bg-white"
                />
              </div>
            </div>
          )
        })}

        {!exercises.length && (
          <div className="text-center py-12 text-gray-400">
            <i className="ti ti-barbell text-4xl block mb-2" />
            <p className="text-sm">Sin ejercicios para este día</p>
          </div>
        )}
      </div>

      {exercises.length > 0 && (
        <button
          onClick={saveWorkout}
          disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          {saving ? <i className="ti ti-loader animate-spin" /> : <i className="ti ti-device-floppy" />}
          {saving ? 'Guardando…' : 'Guardar entrenamiento'}
        </button>
      )}

      {/* Video Modal */}
      {showVideo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">{showVideo.name}</h3>
              <button
                onClick={() => setShowVideo(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <i className="ti ti-x text-lg" />
              </button>
            </div>
            {getYoutubeEmbed(showVideo.video_url) ? (
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute inset-0 w-full h-full rounded-xl"
                  src={getYoutubeEmbed(showVideo.video_url)}
                  allowFullScreen
                  title={showVideo.name}
                />
              </div>
            ) : (
              <a
                href={showVideo.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex items-center justify-center gap-2"
              >
                <i className="ti ti-external-link" /> Abrir video
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
