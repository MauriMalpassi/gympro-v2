/**
 * seed-exercises.js
 * Ejecutar UNA VEZ en la consola del navegador o como script Node
 * con la service role key para insertar los ejercicios del Excel.
 *
 * Uso: copiar y pegar en la consola del navegador estando logueado
 * como profesor en la app, o ejecutar via Supabase SQL Editor.
 */

// ── SQL alternativo — pegar en Supabase SQL Editor ──────────────────
/*
INSERT INTO exercises (name, category) VALUES
  ('Press Arnold sentado',          'Hombros'),
  ('Pect Deck',                     'Pecho'),
  ('Sentadilla split',              'Piernas'),
  ('Sentadilla c/ barra',           'Piernas'),
  ('Jalón al pecho neutro',         'Espalda'),
  ('Remo c/ barra',                 'Espalda'),
  ('Swing sobre cabeza',            'Funcional'),
  ('Hip thrust',                    'Glúteos'),
  ('Plancha lateral',               'Core'),
  ('Rectos',                        'Core'),
  ('Curl martillo',                 'Bíceps'),
  ('Fondos de tríceps',             'Tríceps'),
  ('Press militar c/ barra',        'Hombros'),
  ('Póleas enfrentadas',            'Pecho'),
  ('Estocadas caminando',           'Piernas'),
  ('Prensa 45',                     'Piernas'),
  ('Remo bajo en pólea',            'Espalda'),
  ('Remo serrucho',                 'Espalda'),
  ('Peso muerto rumano',            'Espalda'),
  ('Camilla de isquios',            'Isquiotibiales'),
  ('Plancha frontal',               'Core'),
  ('Crunch',                        'Core'),
  ('Curl de bíceps concentrado',    'Bíceps'),
  ('Extensión de tríceps en polea', 'Tríceps'),
  ('Vuelos laterales',              'Hombros'),
  ('Press plano c/ barra',          'Pecho'),
  ('Saltos al cajón',               'Funcional'),
  ('Sentadilla Hack',               'Piernas'),
  ('Dominadas',                     'Espalda'),
  ('Remo en landmine',              'Espalda'),
  ('Curl de isquios c/ patín',      'Isquiotibiales'),
  ('Hiperextensión',                'Espalda'),
  ('Abs bicicleta',                 'Core'),
  ('Crunch piernas elevadas',       'Core'),
  ('Curl de bíceps en pólea baja',  'Bíceps'),
  ('Press francés',                 'Tríceps')
ON CONFLICT DO NOTHING;
*/

export const EXERCISE_SEED = [
  { name: 'Press Arnold sentado',          category: 'Hombros' },
  { name: 'Pect Deck',                     category: 'Pecho' },
  { name: 'Sentadilla split',              category: 'Piernas' },
  { name: 'Sentadilla c/ barra',           category: 'Piernas' },
  { name: 'Jalón al pecho neutro',         category: 'Espalda' },
  { name: 'Remo c/ barra',                 category: 'Espalda' },
  { name: 'Swing sobre cabeza',            category: 'Funcional' },
  { name: 'Hip thrust',                    category: 'Glúteos' },
  { name: 'Plancha lateral',               category: 'Core' },
  { name: 'Rectos',                        category: 'Core' },
  { name: 'Curl martillo',                 category: 'Bíceps' },
  { name: 'Fondos de tríceps',             category: 'Tríceps' },
  { name: 'Press militar c/ barra',        category: 'Hombros' },
  { name: 'Póleas enfrentadas',            category: 'Pecho' },
  { name: 'Estocadas caminando',           category: 'Piernas' },
  { name: 'Prensa 45',                     category: 'Piernas' },
  { name: 'Remo bajo en pólea',            category: 'Espalda' },
  { name: 'Remo serrucho',                 category: 'Espalda' },
  { name: 'Peso muerto rumano',            category: 'Espalda' },
  { name: 'Camilla de isquios',            category: 'Isquiotibiales' },
  { name: 'Plancha frontal',               category: 'Core' },
  { name: 'Crunch',                        category: 'Core' },
  { name: 'Curl de bíceps concentrado',    category: 'Bíceps' },
  { name: 'Extensión de tríceps en polea', category: 'Tríceps' },
  { name: 'Vuelos laterales',              category: 'Hombros' },
  { name: 'Press plano c/ barra',          category: 'Pecho' },
  { name: 'Saltos al cajón',               category: 'Funcional' },
  { name: 'Sentadilla Hack',               category: 'Piernas' },
  { name: 'Dominadas',                     category: 'Espalda' },
  { name: 'Remo en landmine',              category: 'Espalda' },
  { name: 'Curl de isquios c/ patín',      category: 'Isquiotibiales' },
  { name: 'Hiperextensión',                category: 'Espalda' },
  { name: 'Abs bicicleta',                 category: 'Core' },
  { name: 'Crunch piernas elevadas',       category: 'Core' },
  { name: 'Curl de bíceps en pólea baja',  category: 'Bíceps' },
  { name: 'Press francés',                 category: 'Tríceps' },
]
