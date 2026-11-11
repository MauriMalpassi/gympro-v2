import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Topbar from '../../components/Topbar'
import StudentRoutine from './StudentRoutine'
import StudentHistory from './StudentHistory'
import StudentProgress from './StudentProgress'

const TABS = [
  { path: '/', label: 'Mi rutina', icon: 'ti-run' },
  { path: '/historial', label: 'Historial', icon: 'ti-history' },
  { path: '/progresion', label: 'Progresión', icon: 'ti-chart-line' },
]

export default function StudentLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Topbar />
      <div className="bg-white border-b border-gray-100 px-4">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors
                ${(tab.path === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.path))
                  ? 'border-primary-400 text-primary-600 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              <i className={`ti ${tab.icon} text-base`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <Routes>
          <Route path="/" element={<StudentRoutine />} />
          <Route path="/historial" element={<StudentHistory />} />
          <Route path="/progresion" element={<StudentProgress />} />
        </Routes>
      </main>
    </div>
  )
}
