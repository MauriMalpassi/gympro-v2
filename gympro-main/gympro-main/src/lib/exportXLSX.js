import * as XLSX from 'xlsx'

export function exportStudentXLSX(profile, items, weights, day, week) {
  const data = [
    [`GymPro — Reporte de ${profile.full_name}`],
    [`Día: ${day}   Semana: ${week}   Fecha: ${new Date().toLocaleDateString('es-AR')}`],
    [],
    ['Bloque', 'Ejercicio', 'Series', 'Repeticiones', 'Peso sugerido (kg)', 'Peso utilizado (kg)', 'Diferencia (kg)'],
    ...items.map(item => {
      const sug   = item.suggested_kg || 0
      const used  = weights[item.id] || 0
      const diff  = used > 0 ? used - sug : ''
      return [
        item.block,
        item.exercises?.name || '',
        item.series,
        item.reps,
        sug > 0 ? sug : '',
        used > 0 ? used : '',
        diff,
      ]
    })
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, { wch: 35 }, { wch: 8 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 14 }
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, day)
  XLSX.writeFile(wb, `gympro_${profile.full_name.replace(' ','_')}_${day}_S${week}.xlsx`)
}

export function exportAllHistoryXLSX(profile, sessions) {
  const byDay = {}
  sessions.forEach(s => {
    const day = s.routine_items?.day_of_week || 'Sin día'
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(s)
  })

  const wb = XLSX.utils.book_new()

  Object.entries(byDay).forEach(([day, daySessions]) => {
    const data = [
      [`GymPro — Historial ${profile.full_name} — ${day}`],
      [`Exportado: ${new Date().toLocaleDateString('es-AR')}`],
      [],
      ['Semana', 'Ejercicio', 'Series', 'Reps', 'Sugerido (kg)', 'Utilizado (kg)', 'Diferencia'],
      ...daySessions.map(s => {
        const sug   = s.routine_items?.suggested_kg || 0
        const used  = s.actual_kg || 0
        return [
          `Semana ${s.week_number}`,
          s.routine_items?.exercises?.name || '',
          s.routine_items?.series || '',
          s.routine_items?.reps || '',
          sug || '',
          used,
          sug > 0 ? used - sug : '',
        ]
      })
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [{ wch:10 },{ wch:35 },{ wch:8 },{ wch:6 },{ wch:14 },{ wch:14 },{ wch:12 }]
    XLSX.utils.book_append_sheet(wb, ws, day.slice(0, 31))
  })

  XLSX.writeFile(wb, `gympro_historial_${profile.full_name.replace(' ','_')}.xlsx`)
}
