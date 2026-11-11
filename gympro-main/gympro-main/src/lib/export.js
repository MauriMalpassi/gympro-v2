import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export function exportRoutinePDF({ studentName, dayName, weekLabel, exercises, logs, suggested }) {
  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.setTextColor(8, 80, 65)
  doc.text('GymPro — Rutina de entrenamiento', 14, 20)

  doc.setFontSize(11)
  doc.setTextColor(80, 80, 80)
  doc.text(`Alumno: ${studentName}`, 14, 30)
  doc.text(`Día: ${dayName}  |  ${weekLabel}  |  Fecha: ${new Date().toLocaleDateString('es-AR')}`, 14, 36)

  const rows = exercises.map(ex => {
    const sug = suggested[ex.id] ?? '—'
    const used = logs[ex.id] ?? '—'
    return [
      ex.block_name,
      ex.name,
      ex.series,
      ex.reps,
      sug !== '—' ? `${sug} kg` : '—',
      used !== '—' ? `${used} kg` : '—',
    ]
  })

  autoTable(doc, {
    startY: 44,
    head: [['Bloque', 'Ejercicio', 'Series', 'Reps', 'Sugerido', 'Utilizado']],
    body: rows,
    headStyles: { fillColor: [29, 158, 117], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 250, 246] },
    styles: { fontSize: 10 },
  })

  doc.save(`GymPro_${studentName.replace(' ', '_')}_${dayName}_${weekLabel}.pdf`)
}

export function exportHistoryExcel({ studentName, history }) {
  const rows = []
  history.forEach(session => {
    session.exercise_logs?.forEach(log => {
      rows.push({
        Día: session.training_days?.name,
        Semana: `Semana ${session.week_number}`,
        Mes: session.month_year,
        Ejercicio: log.exercises?.name,
        Bloque: log.exercises?.block_name,
        Series: log.series_done ?? log.exercises?.series,
        Repeticiones: log.reps_done ?? log.exercises?.reps,
        'Peso utilizado (kg)': log.weight_used_kg ?? '',
        Fecha: new Date(session.completed_at).toLocaleDateString('es-AR'),
      })
    })
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [12,14,10,30,12,8,12,18,12].map(w => ({ wch: w }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Historial')
  XLSX.writeFile(wb, `GymPro_Historial_${studentName.replace(' ', '_')}.xlsx`)
}
