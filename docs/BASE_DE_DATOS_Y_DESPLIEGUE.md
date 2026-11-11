# 🗄️ Base de datos y despliegue

## 1. ¿Dónde hacer la base de datos? → **Supabase** (recomendado)

| Opción | Pros | Contras | Veredicto |
|---|---|---|---|
| **Supabase** (PostgreSQL) | Gratis para empezar. Base SQL real. **Usuarios y roles** incluidos. **Tiempo real** nativo. Seguridad por filas. Panel tipo Excel para ver datos. | Pausa proyectos gratuitos inactivos 7 días (se reactivan con un clic) | ✅ **Elegida** |
| Firebase (Firestore) | Tiempo real y modo offline muy buenos | NoSQL: los reportes y el SQL son más difíciles. Las reglas de seguridad son más complejas. | Buena alternativa |
| Google Sheets + Apps Script (actual) | Familiar, gratis | Lento, sin usuarios, límites de cuota, la URL queda expuesta, sin tiempo real | ❌ Se reemplaza |
| Servidor propio (MySQL + PHP/Node) | Control total | Hay que mantener y pagar un servidor | Innecesario por ahora |

La app ya viene preparada para Supabase: solo necesitas pegar 2 datos.

## 2. De tus tablas de Excel a la base de datos

```mermaid
erDiagram
  events ||--o{ event_categories : "salidas por categoría"
  categories ||--o{ event_categories : ""
  events ||--o{ laps : "pasos por meta"
  categories ||--o{ riders : ""
  teams ||--o{ riders : ""
  riders ||..o{ laps : "por dorsal"
  events {
    uuid id PK
    text name
    text location
    date date
    timestamptz start_at
    numeric lap_km
    text status
  }
  categories {
    uuid id PK
    text name
    int laps
    text color
    int sort
  }
  teams {
    uuid id PK
    text name
  }
  riders {
    uuid id PK
    int dorsal UK
    text name
    uuid category_id FK
    uuid team_id FK
    text photo_url
  }
  event_categories {
    uuid id PK
    uuid event_id FK
    uuid category_id FK
    int laps
    timestamptz start_at
  }
  laps {
    uuid id PK
    uuid event_id FK
    int dorsal
    timestamptz ts
    uuid created_by
  }
  staff {
    uuid user_id PK
    text email
    text role
  }
```

| Hoja del Excel | Tabla nueva | Cambios |
|---|---|---|
| `EVENTOS` (id, name, date) | `events` | + sede, **hora de salida general**, km por vuelta, estado (próximo / en vivo / finalizado) |
| `CATEGORIAS` (id, name, laps, startTime) | `categories` | + color. ⚠️ **`startTime` se mueve** a `event_categories` porque cambia en cada evento. |
| — | `event_categories` **(nueva)** | Hora de salida y vueltas **de cada categoría en cada evento** |
| `Equipos` (id, name) | `teams` | Nombre único, sin importar mayúsculas |
| `CORREDORES` (dorsal, name, category, team, photo) | `riders` | Usa la categoría y el equipo por **ID** (no por texto). El dorsal es único. |
| `Registro` (id, eventId, eventName, dorsal, timestamp, dateTime) | `laps` | Una sola columna `ts` con fecha, hora y milisegundos. + quién registró. |
| `RESULTADOS` | *(se calcula)* | Ya no se guarda: se calcula al momento y siempre está correcto |
| — | `staff` **(nueva)** | Usuarios autorizados y su rol |

El archivo completo está en [`supabase/schema.sql`](../supabase/schema.sql). Ya se probó en PostgreSQL 16: se puede ejecutar dos veces, el público no puede escribir y el registrador no puede crear eventos.

## 3. Crear la base de datos (10 minutos)

1. Entra a **https://supabase.com** → *Start your project* → inicia sesión con GitHub o correo.
2. **New project**: nombre `chronobike`, una contraseña segura (guárdala) y la región más cercana (ej. *West US*).
3. Menú izquierdo → **SQL Editor** → **New query** → pega **todo** `supabase/schema.sql` → **Run**.
   ✅ Debe decir *Success. No rows returned*.
4. *(Opcional, para practicar)* Nueva consulta → pega `supabase/seed.sql` → **Run**. Carga los mismos datos ficticios del demo.
5. **Project Settings → API**: copia
   - **Project URL** → `https://xxxx.supabase.co`
   - **anon public** key → `eyJhbGciOi...`
6. Pégalos en `js/config.js`:
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJhbGciOi...',
   ```
   💡 La clave *anon* es pública por diseño. La seguridad la dan las políticas RLS del `schema.sql`. **Nunca** pongas la clave `service_role` en la app.

## 4. Crear usuarios del staff

1. Supabase → **Authentication → Users → Add user → Create new user**: correo, contraseña y ✅ *Auto Confirm User*.
2. **SQL Editor**:
   ```sql
   insert into public.staff (user_id, email, role)
   select id, email, 'admin' from auth.users where email = 'organizador@miserial.mx'
   on conflict (user_id) do update set role = excluded.role;
   ```
   Para registradores, cambia `'admin'` por `'registrador'`.
3. Recomendado: **Authentication → Providers → Email** → desactiva *"Allow new users to sign up"*. Así solo tú creas cuentas.

## 5. Publicar la página (Netlify)

**Opción rápida (arrastrar y soltar):**
1. Entra a **https://app.netlify.com/drop**.
2. Arrastra la carpeta del proyecto (la que contiene `index.html`).
3. ✅ Obtienes una URL tipo `https://nombre-aleatorio.netlify.app`. Cámbiala en *Site settings → Change site name*.

**Opción recomendada (conectada a GitHub, se actualiza sola):**
1. Netlify → *Add new site → Import an existing project → GitHub* → elige `chronobike`.
2. Build command: *(vacío)*. Publish directory: `.`. **Deploy**.
3. Cada vez que se suba un cambio al repositorio, el sitio se actualiza.

**Alternativas equivalentes:** Vercel, Cloudflare Pages o GitHub Pages. Es un sitio 100 % estático.

**Dominio propio (opcional):** *Domain management → Add a domain* (ej. `resultados.miserial.mx`).

| URL | Para |
|---|---|
| `https://tu-sitio.netlify.app/` | Público (compártela) |
| `https://tu-sitio.netlify.app/admin.html` | Staff |

## 6. Migrar tus datos actuales
1. Entra a `admin.html` como admin → **Importar y ajustes**.
2. Arrastra tu `chronobike.xlsx`. Se leen las hojas **CORREDORES**, **CATEGORIAS** y **Equipos**.
3. Revisa los conteos → **Importar ahora**.
4. Ve a **Categorías** y asigna colores y vueltas. Las salidas se dan en cada evento.

> Los pasos antiguos (hoja `Registro`) no se importan porque sus horas de salida eran incorrectas y no se pueden reconstruir con confianza.

## 7. Desarrollo local

```bash
npm start
```

```bash
npm test
```

```bash
npm run seed:sql
```

```bash
npm run screenshots
```

`npm start` sirve la app en http://localhost:5173. `npm test` corre las pruebas del motor de tiempos. `npm run seed:sql` regenera `supabase/seed.sql` desde `js/demo-data.js`. `npm run screenshots` regenera las capturas de `docs/img` (requiere Playwright y que `npm start` esté corriendo).

## 8. Mantenimiento
- **Respaldo:** después de cada evento, en *Importar y ajustes → Descargar respaldo*. Supabase también hace respaldos diarios en planes de pago.
- **Proyecto pausado** (plan gratuito): entra al panel de Supabase → *Restore project*.
- **Ver o editar datos a mano:** Supabase → *Table Editor* (parecido a Excel).
- **Reporte rápido en SQL:** la vista `laps_detalle` une pasos, corredor, categoría y equipo.
