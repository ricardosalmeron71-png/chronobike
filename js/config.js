// ─────────────────────────────────────────────────────────────
//  ChronoBike · Configuración
//  Deja SUPABASE_URL vacío para usar el MODO DEMO (datos ficticios
//  guardados en el navegador). Pega aquí los datos de tu proyecto
//  Supabase (Project Settings → API) para usar la base de datos real.
// ─────────────────────────────────────────────────────────────
export const CONFIG = {
  SUPABASE_URL: '',        // ej. 'https://abcdxyz.supabase.co'
  SUPABASE_ANON_KEY: '',   // clave "anon public" (es segura para el navegador)

  APP_NAME: 'ChronoBike',
  ORGANIZER: 'Serial MTB Sonora',

  // Segundos mínimos entre dos pasos del mismo dorsal antes de pedir confirmación
  DUPLICATE_WINDOW_SECONDS: 30,
};
