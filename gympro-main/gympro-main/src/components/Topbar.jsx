import { useAuth } from '../hooks/useAuth.jsx'

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function Topbar() {
  const { profile, signOut } = useAuth()

  return (
    <header className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-2.5">
        <img src="/logo.png" alt="JP Fitness" className="w-9 h-9 rounded-full" />
        <div>
          <span className="font-bold text-gray-900 text-base leading-tight block">JP FITNESS</span>
          <span className="text-xs text-gray-400 leading-tight block">Gestión de rutinas</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-sm font-medium text-gray-800 leading-tight">{profile?.name}</span>
          <span className={`text-xs ${profile?.role === 'teacher' ? 'text-primary-600' : 'text-accent-400'}`}>
            {profile?.role === 'teacher' ? 'Profesor' : 'Alumno'}
          </span>
        </div>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-medium text-sm
          ${profile?.role === 'teacher' ? 'bg-primary-50 text-primary-800' : 'bg-accent-50 text-accent-800'}`}>
          {getInitials(profile?.name)}
        </div>
        <button
          onClick={signOut}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title="Cerrar sesión"
        >
          <i className="ti ti-logout text-lg" />
        </button>
      </div>
    </header>
  )
}
