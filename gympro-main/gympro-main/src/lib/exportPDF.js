import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function exportStudentPDF(profile, items, weights, day, week) {
  const doc = new jsPDF()

  // Header
  doc.setFillColor(29, 185, 122)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('GymPro', 14, 12)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Reporte de entrenamiento', 14, 20)

  // Info
  doc.setTextColor(40, 40, 40)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(profile.full_name, 14, 38)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(`${day} · Semana ${week} · ${new Date().toLocaleDateString('es-AR')}`, 14, 45)

  // Table
  const rows = items.map(item => [
    item.block,
    item.exercises?.name || '—',
    `${item.series} × ${item.reps}`,
    item.suggested_kg > 0 ? `${item.suggested_kg} kg` : '—',
    weights[item.id] ? `${weights[item.id]} kg` : '—',
  ])

  autoTable(doc, {
    startY: 52,
    head: [['Bloque', 'Ejercicio', 'Series × Reps', 'Sugerido', 'Utilizado']],
    body: rows,
    headStyles: { fillColor: [29, 185, 122], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [245, 253, 249] },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 70 }, 2: { cellWidth: 25 }, 3: { cellWidth: 25 }, 4: { cellWidth: 25 } },
  })

  // Footer
  const pageH = doc.internal.pageSize.height
  doc.setFontSize(7)
  doc.setTextColor(180, 180, 180)
  doc.text('Generado por GymPro', 14, pageH - 8)

  doc.save(`gympro_${profile.full_name.replace(' ', '_')}_${day}_S${week}.pdf`)
}

export function exportAllHistoryPDF(profile, sessions) {
  const doc = new jsPDF()

  doc.setFillColor(29, 185, 122)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('GymPro — Historial completo', 14, 18)

  doc.setTextColor(40, 40, 40)
  doc.setFontSize(11)
  doc.text(profile.full_name, 14, 38)
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, 14, 45)

  const rows = sessions.map(s => [
    s.routine_items?.day_of_week || '—',
    `S${s.week_number}`,
    s.routine_items?.exercises?.name || '—',
    s.routine_items?.suggested_kg ? `${s.routine_items.suggested_kg} kg` : '—',
    `${s.actual_kg} kg`,
  ])

  autoTable(doc, {
    startY: 52,
    head: [['Día', 'Semana', 'Ejercicio', 'Sugerido', 'Utilizado']],
    body: rows,
    headStyles: { fillColor: [29, 185, 122], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 253, 249] },
  })

  doc.save(`gympro_historial_${profile.full_name.replace(' ', '_')}.pdf`)
}
