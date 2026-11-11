-- ================================================================
-- GymPro — Migración de base de datos
-- Ejecutar en: Supabase → SQL Editor → New query
-- ================================================================

-- 1. Tabla de perfiles de usuario (extiende auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null check (role in ('teacher', 'student')),
  created_at  timestamptz default now()
);

-- 2. Ejercicios globales
create table if not exists public.exercises (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text,
  created_at  timestamptz default now()
);

-- 3. Rutinas: un profesor asigna una rutina a un alumno
create table if not exists public.routines (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  teacher_id  uuid not null references public.profiles(id) on delete cascade,
  name        text not null default 'Rutina mensual',
  month       text,            -- e.g. "Junio 2026"
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 4. Ítem de rutina: ejercicio dentro de una rutina
create table if not exists public.routine_items (
  id              uuid primary key default gen_random_uuid(),
  routine_id      uuid not null references public.routines(id) on delete cascade,
  exercise_id     uuid not null references public.exercises(id),
  day_of_week     text not null check (day_of_week in ('Lunes','Miércoles','Viernes')),
  block           text not null,          -- 'Bloque 1', 'Bloque 2', 'Bloque 3'
  position        int not null default 1,
  series          int not null default 4,
  reps            int not null default 10,
  suggested_kg    numeric(6,2) default 0,
  notes           text,
  created_at      timestamptz default now()
);

-- 5. Sesiones de entrenamiento registradas por el alumno
create table if not exists public.sessions (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.profiles(id) on delete cascade,
  routine_item_id uuid not null references public.routine_items(id) on delete cascade,
  week_number     int not null check (week_number between 1 and 4),
  actual_kg       numeric(6,2) not null,
  actual_series   int,
  actual_reps     int,
  notes           text,
  logged_at       timestamptz default now()
);

-- ================================================================
-- Row Level Security (RLS)
-- ================================================================

alter table public.profiles      enable row level security;
alter table public.exercises     enable row level security;
alter table public.routines      enable row level security;
alter table public.routine_items enable row level security;
alter table public.sessions      enable row level security;

-- Profiles: cada uno ve el suyo; profesores ven todos
create policy "profiles_self" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_teacher_all" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Exercises: todos pueden leer; solo profesores pueden escribir
create policy "exercises_read_all" on public.exercises
  for select using (true);

create policy "exercises_teacher_write" on public.exercises
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

-- Routines: alumno ve las suyas; profesor ve todas las suyas
create policy "routines_student_own" on public.routines
  for select using (student_id = auth.uid());

create policy "routines_teacher_own" on public.routines
  for select using (teacher_id = auth.uid());

create policy "routines_teacher_write" on public.routines
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

-- Routine items: hereda acceso de la rutina
create policy "routine_items_access" on public.routine_items
  for select using (
    exists (
      select 1 from public.routines r
      where r.id = routine_id
        and (r.student_id = auth.uid() or r.teacher_id = auth.uid())
    )
  );

create policy "routine_items_teacher_write" on public.routine_items
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

-- Sessions: alumno ve y escribe las suyas; profesor ve las de sus alumnos
create policy "sessions_student_own" on public.sessions
  for all using (student_id = auth.uid());

create policy "sessions_teacher_view" on public.sessions
  for select using (
    exists (
      select 1 from public.routines r
      join public.routine_items ri on ri.routine_id = r.id
      where ri.id = routine_item_id and r.teacher_id = auth.uid()
    )
  );

-- ================================================================
-- Datos de ejemplo (opcional — para probar)
-- ================================================================
-- Nota: los usuarios reales se crean via Supabase Auth.
-- Luego de crear usuarios en Auth, insertar sus perfiles:
--
-- insert into public.profiles(id, full_name, role) values
--   ('UUID_DEL_PROFESOR', 'Profesor García', 'teacher'),
--   ('UUID_DEL_ALUMNO',   'Martín López',    'student');
