# GymPro — Plataforma de gestión de rutinas

Aplicación web React + Supabase para profesores y alumnos de gimnasio.

## Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL + Auth + Row Level Security)
- **Gráficos**: Chart.js
- **Exportación**: jsPDF + xlsx

---

## Configuración paso a paso

### 1. Crear proyecto en Supabase

1. Ir a https://supabase.com y crear una cuenta gratuita
2. Crear un nuevo proyecto
3. Ir a **Settings > API** y copiar:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`

### 2. Crear la base de datos

1. En Supabase ir a **SQL Editor**
2. Pegar y ejecutar el contenido de `supabase/schema.sql`
3. Esto crea todas las tablas, políticas de seguridad y carga los ejercicios del Excel

### 3. Crear el usuario Profesor

1. En Supabase ir a **Authentication > Users > Add user**
2. Completar con email y contraseña del profesor
3. Luego ir a **SQL Editor** y ejecutar:

```sql
INSERT INTO public.profiles (id, name, username, role)
VALUES (
  '<UUID del usuario creado>',
  'Nombre del Profesor',
  'profe',
  'teacher'
);
```

### 4. Instalar y correr localmente

```bash
# Clonar o descomprimir el proyecto
cd gympro

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# Iniciar en desarrollo
npm run dev
```

### 5. Crear alumnos

Una vez logueado como profesor, ir a la sección **Alumnos** y usar el botón **Nuevo alumno**.

---

## Estructura del proyecto

```
src/
  components/
    Topbar.jsx          — Barra de navegación superior
  hooks/
    useAuth.js          — Contexto de autenticación
  lib/
    supabase.js         — Cliente de Supabase
    export.js           — Exportación PDF y Excel
  pages/
    LoginPage.jsx
    teacher/
      TeacherLayout.jsx
      TeacherDashboard.jsx   — Rutinas + pesos sugeridos + gráfico
      StudentsPage.jsx       — Gestión de alumnos
      ProgressionPage.jsx    — Evolución por ejercicio
    student/
      StudentLayout.jsx
      StudentRoutine.jsx     — Registrar pesos del entrenamiento
      StudentHistory.jsx     — Ver historial de sesiones
      StudentProgress.jsx    — Ver curva de progresión

supabase/
  schema.sql            — Tablas, RLS y seed de ejercicios
```

---

## Despliegue en producción (gratuito)

### Opción A — Vercel

```bash
npm install -g vercel
vercel
# Configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel Dashboard
```

### Opción B — Netlify

```bash
npm run build
# Subir la carpeta dist/ a Netlify
# Configurar variables de entorno en Site Settings > Environment Variables
```

---

## Días y ejercicios incluidos (del Excel original)

### Lunes
**Bloque 1**: Press Arnold sentado · Pect Deck · Sentadilla split · Sentadilla c/ barra  
**Bloque 2**: Jalón al pecho neutro · Remo c/ barra · Swing sobre cabeza · Hip thrust  
**Bloque 3**: Plancha lateral · Rectos · Curl martillo · Fondos de tríceps

### Miércoles
**Bloque 1**: Press militar c/ barra · Póleas enfrentadas · Estocadas caminando · Prensa 45  
**Bloque 2**: Remo bajo en pólea · Remo serrucho · Peso muerto rumano · Camilla de isquios  
**Bloque 3**: Plancha frontal · Crunch · Curl de bíceps concentrado · Extensión de tríceps en polea

### Viernes
**Bloque 1**: Vuelos laterales · Press plano c/ barra · Saltos al cajón · Sentadilla Hack  
**Bloque 2**: Dominadas · Remo en landmine · Curl de isquios c/ patín · Hiperextensión  
**Bloque 3**: Abs bicicleta · Crunch piernas elevadas · Curl de bíceps en pólea baja · Press francés
