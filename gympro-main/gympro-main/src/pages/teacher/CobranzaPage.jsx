import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const METODOS = ['Efectivo', 'Transferencia', 'Mercado Pago']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getPeriodo(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriodo(periodo) {
  const [year, month] = periodo.split('-')
  return `${MESES[parseInt(month) - 1]} ${year}`
}

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0)
}

export default function CobranzaPage() {
  const [students, setStudents] = useState([])
  const [payments, setPayments] = useState([])
  const [periodo, setPeriodo] = useState(getPeriodo())
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [modalStudent, setModalStudent] = useState(null)
  const [payForm, setPayForm] = useState({ amount: '', method: 'Efectivo', notes: '' })
  const [savingPay, setSavingPay] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => { loadData() }, [periodo])

  async function loadData() {
    setLoading(true)
    const [{ data: studs }, { data: pays }] = await Promise.all([
      supabase.from('profiles').select('id, name, plan, telefono, precio_mensual, activo, fecha_inicio').eq('role', 'student').eq('activo', true).order('name'),
      supabase.from('payments').select('*').eq('period', periodo)
    ])
    setStudents(studs || [])
    setPayments(pays || [])
    setLoading(false)
  }

  function getPayment(studentId) {
    return payments.find(p => p.student_id === studentId)
  }

  function getStatus(studentId) {
    const pay = getPayment(studentId)
    if (pay?.status === 'paid') return 'paid'

    // Si el alumno todavía no arrancó en este período, no debe nada
    const student = students.find(s => s.id === studentId)
    if (student?.fecha_inicio) {
      // fecha_inicio puede ser "2026-12-01" → tomamos solo año y mes
      const parts = student.fecha_inicio.substring(0, 7).split('-').map(Number) // "2026-12"
      const piYear = parts[0], piMonth = parts[1]
      const [pYear, pMonth] = periodo.split('-').map(Number)
      const periodoNum = pYear * 100 + pMonth
      const inicioNum = piYear * 100 + piMonth
      if (periodoNum < inicioNum) return 'inactive'
    }

    const today = new Date()
    const [year, month] = periodo.split('-').map(Number)
    if (today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() > 10) return 'overdue'
    if (today.getFullYear() > year || (today.getFullYear() === year && today.getMonth() + 1 > month)) return 'overdue'
    return 'pending'
  }

  async function generarCuotas() {
    if (!confirm(`¿Generar cuotas de ${formatPeriodo(periodo)} para todos los alumnos activos?\n\nSolo se crean las que no existen todavía.`)) return
    setLoading(true)
    try {
      // Alumnos que YA tienen cuota en este período
      const yaExisten = new Set(payments.map(p => p.student_id))

      const [pyear, pmonth] = periodo.split('-')
      const dueDate = `${pyear}-${pmonth}-10`

      const nuevas = students
        .filter(s => !yaExisten.has(s.id))
        .map(s => ({
          student_id: s.id,
          period: periodo,
          amount: s.precio_mensual || 0,
          currency: 'ARS',
          due_date: dueDate,
          status: 'pending',
          payment_date: null,
          method: null,
          notes: null,
        }))

      if (nuevas.length === 0) {
        showToast('Todos los alumnos ya tienen cuota generada')
        setLoading(false)
        return
      }

      await supabase.from('payments').insert(nuevas)
      showToast(`${nuevas.length} cuota${nuevas.length > 1 ? 's' : ''} generada${nuevas.length > 1 ? 's' : ''}`)
      loadData()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function openPayModal(student) {
    const pay = getPayment(student.id)
    setModalStudent(student)
    setPayForm({
      amount: pay?.amount || student.precio_mensual || '',
      method: pay?.method || 'Efectivo',
      notes: pay?.notes || '',
    })
  }

  async function registerPayment(e) {
    e.preventDefault()
    setSavingPay(true)
    const existing = getPayment(modalStudent.id)
    const [pyear, pmonth] = periodo.split('-')
    const dueDate = `${pyear}-${pmonth}-10`

    const payload = {
      student_id: modalStudent.id,
      amount: parseFloat(payForm.amount),
      currency: 'ARS',
      payment_date: new Date().toISOString().split('T')[0],
      due_date: dueDate,
      period: periodo,
      method: payForm.method,
      status: 'paid',
      notes: payForm.notes,
    }
    let result
    if (existing) {
      result = await supabase.from('payments').update(payload).eq('id', existing.id)
    } else {
      result = await supabase.from('payments').insert(payload)
    }

    if (result.error) {
      alert('Error Supabase: ' + result.error.message + '\nCódigo: ' + result.error.code)
      setSavingPay(false)
      return
    }

    setSavingPay(false)
    setModalStudent(null)
    showToast(`Pago de ${modalStudent.name} registrado`)
    loadData()
  }

  async function updatePrice(studentId, price) {
    await supabase.from('profiles').update({ precio_mensual: parseFloat(price) }).eq('id', studentId)
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, precio_mensual: parseFloat(price) } : s))
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const filtered = students.filter(s => !filterStatus || getStatus(s.id) === filterStatus)
  const totalCobrado = payments.filter(p => p.status === 'paid' && p.period === periodo).reduce((a, p) => a + (p.amount || 0), 0)
  const totalPendiente = filtered.filter(s => ['pending','overdue'].includes(getStatus(s.id))).reduce((a, s) => a + (s.precio_mensual || 0), 0)
  const countPaid = students.filter(s => getStatus(s.id) === 'paid').length
  const countPending = students.filter(s => getStatus(s.id) === 'pending').length
  const countOverdue = students.filter(s => getStatus(s.id) === 'overdue').length

  return (
    <div className="py-4 space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-primary-400 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-lg">
          <i className="ti ti-check" /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2">
          <i className="ti ti-cash text-primary-400" /> Cobranza
        </h2>
        <div className="flex items-center gap-2">
          <select className="input text-sm w-auto"
            value={periodo} onChange={e => setPeriodo(e.target.value)}>
            {Array.from({ length: 6 }, (_, i) => {
              const d = new Date(); d.setMonth(d.getMonth() - i)
              const p = getPeriodo(d)
              return <option key={p} value={p}>{formatPeriodo(p)}</option>
            })}
          </select>
          <button onClick={generarCuotas}
            className="btn-secondary flex items-center gap-1.5 text-sm whitespace-nowrap">
            <i className="ti ti-bolt text-sm" /> Generar cuotas
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="text-xl font-semibold text-primary-400">{countPaid}</p>
          <p className="text-xs text-gray-400 mt-0.5">Pagaron</p>
          <p className="text-xs font-medium text-primary-400 mt-1">{formatMoney(totalCobrado)}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xl font-semibold text-amber-500">{countPending}</p>
          <p className="text-xs text-gray-400 mt-0.5">Pendiente</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xl font-semibold text-red-500">{countOverdue}</p>
          <p className="text-xs text-gray-400 mt-0.5">Vencido</p>
          <p className="text-xs font-medium text-red-400 mt-1">{formatMoney(totalPendiente)}</p>
        </div>
      </div>

      {/* Filtro estado */}
      <div className="flex gap-2">
        {[['', 'Todos'], ['paid', 'Pagaron'], ['pending', 'Pendiente'], ['overdue', 'Vencido']].map(([val, label]) => (
          <button key={val} onClick={() => setFilterStatus(val)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStatus === val ? 'bg-primary-400 text-white border-primary-400' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Lista alumnos */}
      {loading ? (
        <div className="text-center py-8 text-gray-400"><i className="ti ti-loader animate-spin text-2xl" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const status = getStatus(s.id)
            const pay = getPayment(s.id)
            return (
              <div key={s.id} className="card p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">{s.name}</p>
                    <StatusBadge status={status} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-gray-400">{s.plan || 'Sin plan'}</span>
                    {pay?.method && <span className="text-xs text-gray-400">{pay.method}</span>}
                    {pay?.payment_date && <span className="text-xs text-gray-400">{pay.payment_date}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Precio editable */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">$</span>
                    <input
                      type="number"
                      className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1 text-right"
                      value={s.precio_mensual || ''}
                      placeholder="0"
                      onChange={e => updatePrice(s.id, e.target.value)}
                    />
                  </div>
                  {status === 'paid' ? (
                    <button onClick={() => openPayModal(s)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-primary-400 transition-colors" title="Ver pago">
                      <i className="ti ti-check text-base" />
                    </button>
                  ) : status === 'inactive' ? (
                    <span className="text-xs text-gray-300 px-3 py-1.5">—</span>
                  ) : (
                    <button onClick={() => openPayModal(s)}
                      className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                      <i className="ti ti-cash text-sm" /> Cobrar
                    </button>
                  )}
                  {s.telefono && (
                    <a href={`https://wa.me/54${s.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${s.name.split(' ').pop()}! Te recuerdo que el pago de ${formatPeriodo(periodo)} está pendiente. Podés abonar por efectivo, transferencia o Mercado Pago. Cualquier consulta avisame! 💪`)}`}
                      target="_blank" rel="noreferrer"
                      className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-500 transition-colors" title="Recordatorio WhatsApp">
                      <i className="ti ti-brand-whatsapp text-base" />
                    </a>
                  )}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">Sin alumnos en este filtro</div>
          )}
        </div>
      )}

      {/* Modal registrar pago */}
      {modalStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-medium text-gray-900 mb-1 flex items-center gap-2">
              <i className="ti ti-cash text-primary-400" />
              {getPayment(modalStudent.id) ? 'Editar pago' : 'Registrar pago'}
            </h3>
            <p className="text-xs text-gray-400 mb-4">{modalStudent.name} · {formatPeriodo(periodo)}</p>
            <form onSubmit={registerPayment} className="space-y-3">
              <div>
                <label className="label">Monto ($)</label>
                <input className="input" type="number" placeholder="0" value={payForm.amount}
                  onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Método de pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {METODOS.map(m => (
                    <button key={m} type="button"
                      onClick={() => setPayForm(p => ({ ...p, method: m }))}
                      className={`py-2 rounded-xl text-xs font-medium border transition-colors ${payForm.method === m ? 'bg-primary-400 text-white border-primary-400' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Notas (opcional)</label>
                <input className="input" placeholder="Ej: pagó mitad..." value={payForm.notes}
                  onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalStudent(null)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={savingPay}>
                  {savingPay ? <i className="ti ti-loader animate-spin" /> : null} Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'paid') return (
    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
      <i className="ti ti-check text-xs" /> Pagado
    </span>
  )
  if (status === 'overdue') return (
    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
      <i className="ti ti-alert-circle text-xs" /> Vencido
    </span>
  )
  if (status === 'inactive') return (
    <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full flex items-center gap-1">
      <i className="ti ti-calendar-off text-xs" /> No iniciado
    </span>
  )
  return (
    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
      <i className="ti ti-clock text-xs" /> Pendiente
    </span>
  )
}
