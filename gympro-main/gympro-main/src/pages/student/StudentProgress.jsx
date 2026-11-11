import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

export default function StudentProgress() {
  const { profile } = useAuth()
  const [exercises, setExercises] = useState([])
  const [selectedEx, setSelectedEx] = useState(null)
  const [chartData, setChartData] = useState([])
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

  useEffect(() => {
    supabase.from('exercises').select('*, training_days(name)').order('order_index').then(({ data }) => {
      setExercises(data || [])
      if (data?.length) setSelectedEx(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (selectedEx && profile) loadProgression()
  }, [selectedEx, profile])

  useEffect(() => { buildChart() }, [chartData])

  async function loadProgression() {
    const { data } = await supabase
      .from('exercise_logs')
      .select('weight_used_kg, training_sessions!inner(week_number, month_year, completed_at, training_days(name), student_id)')
      .eq('exercise_id', selectedEx)
      .eq('training_sessions.student_id', profile.id)
      .not('weight_used_kg', 'is', null)
    setChartData(data?.filter(d => d.training_sessions).sort((a, b) => a.training_sessions.week_number - b.training_sessions.week_number) || [])
  }

  function buildChart() {
    if (!chartRef.current) return
    if (chartInstance.current) chartInstance.current.destroy()
    if (!chartData.length) return

    const labels = chartData.map(d =>
      `${d.training_sessions.training_days?.name?.slice(0, 3)} S${d.training_sessions.week_number}`)
    const values = chartData.map(d => d.weight_used_kg)

    chartInstance.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'kg',
          data: values,
          borderColor: '#1D9E75',
          backgroundColor: 'rgba(29,158,117,0.08)',
          borderWidth: 2.5,
          pointBackgroundColor: '#1D9E75',
          pointRadius: 5,
          tension: 0.35,
          fill: true,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: v => Number(v.toFixed(1)) + ' kg', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
          x: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }
    })
  }

  const maxVal = chartData.length ? Math.max(...chartData.map(d => d.weight_used_kg)) : null
  const delta = chartData.length >= 2
    ? (chartData.at(-1).weight_used_kg - chartData[0].weight_used_kg).toFixed(1)
    : null

  return (
    <div className="py-4 space-y-5">
      <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2">
        <i className="ti ti-chart-line text-primary-400" /> Mi progresión
      </h2>

      <div>
        <p className="label mb-2">Seleccioná un ejercicio</p>
        <div className="flex gap-2 flex-wrap">
          {exercises.map(ex => (
            <button key={ex.id} onClick={() => setSelectedEx(ex.id)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-all
                ${selectedEx === ex.id ? 'bg-primary-400 border-primary-400 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {ex.name}
            </button>
          ))}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-100 rounded-xl p-3">
            <p className="text-xs text-gray-500">Registros</p>
            <p className="text-xl font-medium text-gray-900">{chartData.length}</p>
          </div>
          <div className="bg-gray-100 rounded-xl p-3">
            <p className="text-xs text-gray-500">Mejor marca</p>
            <p className="text-xl font-medium text-primary-600">{maxVal} kg</p>
          </div>
          <div className="bg-gray-100 rounded-xl p-3">
            <p className="text-xs text-gray-500">Evolución</p>
            <p className={`text-xl font-medium ${delta > 0 ? 'text-primary-600' : delta < 0 ? 'text-red-500' : 'text-gray-900'}`}>
              {delta !== null ? (delta > 0 ? '+' : '') + delta + ' kg' : '—'}
            </p>
          </div>
        </div>
      )}

      <div className="card p-4">
        <p className="font-medium text-gray-700 mb-4 text-sm">
          {exercises.find(e => e.id === selectedEx)?.name}
        </p>
        {chartData.length ? (
          <div className="relative h-56">
            <canvas ref={chartRef} />
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <i className="ti ti-chart-line text-3xl block mb-2" />
              <p className="text-sm">Completá sesiones para ver tu progresión</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
