import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Topbar from '../../components/Topbar'
import TeacherDashboard from './TeacherDashboard'
import StudentsPage from './StudentsPage'
import ProgressionPage from './ProgressionPage'
import TrainingDaysPage from './TrainingDaysPage'
import ExercisesPage from './ExercisesPage'
import RutinasPage from './RutinasPage'
import ConfigPage from './ConfigPage'

const TABS = [
  { path: '/', label: 'Tablero', icon: 'ti-layout-dashboard' },
  { path: '/alumnos', label: 'Alumnos', icon: 'ti-users' },
  { path: '/dias', label: 'Días', icon: 'ti-calendar' },
  { path: '/ejercicios', label: 'Ejercicios', icon: 'ti-barbell' },
  { path: '/progresion', label: 'Progresión', icon: 'ti-chart-line' },
  { path: '/rutinas', label: 'Rutinas', icon: 'ti-calendar-month' },
  { path: '/config', label: 'Configuración', icon: 'ti-settings' },
]

export default function TeacherLayout() {
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
      <main className="flex-1 p-4 max-w-5xl mx-auto w-full">
        <Routes>
          <Route path="/" element={<TeacherDashboard />} />
          <Route path="/alumnos" element={<StudentsPage />} />
          <Route path="/dias" element={<TrainingDaysPage />} />
          <Route path="/ejercicios" element={<ExercisesPage />} />
          <Route path="/progresion" element={<ProgressionPage />} />
          <Route path="/rutinas" element={<RutinasPage />} />
          <Route path="/config" element={<ConfigPage />} />
        </Routes>
      </main>
    </div>
  )
}
