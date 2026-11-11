-- ============================================================
-- GymPro - Schema Supabase (versión corregida)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- PERFILES DE USUARIO
-- ============================================================
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  name        text not null,
  role        text not null check (role in ('teacher','student')),
  username    text unique not null,
  created_at  timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Usuarios ven su propio perfil"
  on public.profiles for select using (auth.uid() = id);

create policy "Profesor ve todos los perfiles"
  on public.profiles for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

create policy "Profesor inserta perfiles"
  on public.profiles for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

create policy "Profesor actualiza perfiles"
  on public.profiles for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

create policy "Profesor elimina alumnos"
  on public.profiles for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

-- ============================================================
-- DÍAS DE ENTRENAMIENTO
-- ============================================================
create table public.training_days (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  order_index integer not null,
  created_at  timestamptz default now()
);

alter table public.training_days enable row level security;
create policy "Todos leen días" on public.training_days for select using (true);
create policy "Profesor gestiona días" on public.training_days for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
);

-- ============================================================
-- EJERCICIOS
-- ============================================================
create table public.exercises (
  id             uuid default uuid_generate_v4() primary key,
  training_day_id uuid references public.training_days on delete cascade not null,
  block_name     text not null,
  block_order    integer not null,
  name           text not null,
  series         integer not null default 4,
  reps           integer not null default 12,
  order_index    integer not null,
  created_at     timestamptz default now()
);

alter table public.exercises enable row level security;
create policy "Todos leen ejercicios" on public.exercises for select using (true);
create policy "Profesor gestiona ejercicios" on public.exercises for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
);

-- ============================================================
-- PESOS SUGERIDOS
-- ============================================================
create table public.suggested_weights (
  id          uuid default uuid_generate_v4() primary key,
  student_id  uuid references public.profiles on delete cascade not null,
  exercise_id uuid references public.exercises on delete cascade not null,
  weight_kg   numeric(6,2) not null default 0,
  updated_at  timestamptz default now(),
  unique (student_id, exercise_id)
);

alter table public.suggested_weights enable row level security;

create policy "Alumno ve sus pesos sugeridos"
  on public.suggested_weights for select using (auth.uid() = student_id);

create policy "Profesor ve todos los pesos sugeridos"
  on public.suggested_weights for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

create policy "Profesor gestiona pesos sugeridos"
  on public.suggested_weights for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

-- ============================================================
-- SESIONES DE ENTRENAMIENTO
-- ============================================================
create table public.training_sessions (
  id              uuid default uuid_generate_v4() primary key,
  student_id      uuid references public.profiles on delete cascade not null,
  training_day_id uuid references public.training_days on delete cascade not null,
  week_number     integer not null check (week_number between 1 and 4),
  month_year      text not null,
  notes           text,
  completed_at    timestamptz default now(),
  created_at      timestamptz default now(),
  unique (student_id, training_day_id, week_number, month_year)
);

alter table public.training_sessions enable row level security;

create policy "Alumno ve sus sesiones"
  on public.training_sessions for select using (auth.uid() = student_id);

create policy "Alumno crea sus sesiones"
  on public.training_sessions for insert with check (auth.uid() = student_id);

create policy "Alumno actualiza sus sesiones"
  on public.training_sessions for update using (auth.uid() = student_id);

create policy "Profesor ve todas las sesiones"
  on public.training_sessions for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

-- ============================================================
-- REGISTROS DE PESO POR EJERCICIO
-- ============================================================
create table public.exercise_logs (
  id             uuid default uuid_generate_v4() primary key,
  session_id     uuid references public.training_sessions on delete cascade not null,
  exercise_id    uuid references public.exercises on delete cascade not null,
  weight_used_kg numeric(6,2),
  series_done    integer,
  reps_done      integer,
  notes          text,
  created_at     timestamptz default now(),
  unique (session_id, exercise_id)
);

alter table public.exercise_logs enable row level security;

create policy "Alumno ve sus logs"
  on public.exercise_logs for select using (
    exists (select 1 from public.training_sessions s where s.id = session_id and s.student_id = auth.uid())
  );

create policy "Alumno crea sus logs"
  on public.exercise_logs for insert with check (
    exists (select 1 from public.training_sessions s where s.id = session_id and s.student_id = auth.uid())
  );

create policy "Alumno actualiza sus logs"
  on public.exercise_logs for update using (
    exists (select 1 from public.training_sessions s where s.id = session_id and s.student_id = auth.uid())
  );

create policy "Profesor ve todos los logs"
  on public.exercise_logs for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

-- ============================================================
-- SEED: Días y ejercicios
-- ============================================================
do $$
declare
  did_lun uuid;
  did_mie uuid;
  did_vie uuid;
begin
  -- Insertar días uno por uno con RETURNING
  insert into public.training_days (name, order_index) values ('Lunes', 1) returning id into did_lun;
  insert into public.training_days (name, order_index) values ('Miércoles', 2) returning id into did_mie;
  insert into public.training_days (name, order_index) values ('Viernes', 3) returning id into did_vie;

  -- LUNES
  insert into public.exercises (training_day_id, block_name, block_order, name, series, reps, order_index) values
    (did_lun,'Bloque 1',1,'Press Arnold sentado',4,12,1),
    (did_lun,'Bloque 1',1,'Pect Deck',4,10,2),
    (did_lun,'Bloque 1',1,'Sentadilla split',4,12,3),
    (did_lun,'Bloque 1',1,'Sentadilla c/ barra',4,10,4),
    (did_lun,'Bloque 2',2,'Jalón al pecho neutro',4,10,5),
    (did_lun,'Bloque 2',2,'Remo c/ barra',4,10,6),
    (did_lun,'Bloque 2',2,'Swing sobre cabeza',3,12,7),
    (did_lun,'Bloque 2',2,'Hip thrust',4,12,8),
    (did_lun,'Bloque 3',3,'Plancha lateral',3,30,9),
    (did_lun,'Bloque 3',3,'Rectos',3,15,10),
    (did_lun,'Bloque 3',3,'Curl martillo',3,12,11),
    (did_lun,'Bloque 3',3,'Fondos de tríceps',3,12,12);

  -- MIÉRCOLES
  insert into public.exercises (training_day_id, block_name, block_order, name, series, reps, order_index) values
    (did_mie,'Bloque 1',1,'Press militar c/ barra',4,10,1),
    (did_mie,'Bloque 1',1,'Póleas enfrentadas',4,12,2),
    (did_mie,'Bloque 1',1,'Estocadas caminando',3,12,3),
    (did_mie,'Bloque 1',1,'Prensa 45',4,12,4),
    (did_mie,'Bloque 2',2,'Remo bajo en pólea',4,10,5),
    (did_mie,'Bloque 2',2,'Remo serrucho',4,10,6),
    (did_mie,'Bloque 2',2,'Peso muerto rumano',4,10,7),
    (did_mie,'Bloque 2',2,'Camilla de isquios',4,12,8),
    (did_mie,'Bloque 3',3,'Plancha frontal',3,40,9),
    (did_mie,'Bloque 3',3,'Crunch',3,20,10),
    (did_mie,'Bloque 3',3,'Curl de bíceps concentrado',3,12,11),
    (did_mie,'Bloque 3',3,'Extensión de tríceps en polea',3,12,12);

  -- VIERNES
  insert into public.exercises (training_day_id, block_name, block_order, name, series, reps, order_index) values
    (did_vie,'Bloque 1',1,'Vuelos laterales',4,12,1),
    (did_vie,'Bloque 1',1,'Press plano c/ barra',4,10,2),
    (did_vie,'Bloque 1',1,'Saltos al cajón',3,8,3),
    (did_vie,'Bloque 1',1,'Sentadilla Hack',4,12,4),
    (did_vie,'Bloque 2',2,'Dominadas',4,8,5),
    (did_vie,'Bloque 2',2,'Remo en landmine',4,10,6),
    (did_vie,'Bloque 2',2,'Curl de isquios c/ patín',3,10,7),
    (did_vie,'Bloque 2',2,'Hiperextensión',3,12,8),
    (did_vie,'Bloque 3',3,'Abs bicicleta',3,20,9),
    (did_vie,'Bloque 3',3,'Crunch piernas elevadas',3,15,10),
    (did_vie,'Bloque 3',3,'Curl de bíceps en pólea baja',3,12,11),
    (did_vie,'Bloque 3',3,'Press francés',3,12,12);
end;
$$;
