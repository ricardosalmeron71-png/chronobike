// ChronoBike · Edge Function "staff"
// Crea y administra las cuentas del staff DESDE LA APP.
// Usa la llave secreta (service role) que Supabase inyecta automáticamente:
// nunca viaja al navegador. Solo un administrador puede usarla, salvo la
// acción "bootstrap", que crea el PRIMER administrador cuando aún no existe ninguno.
//
// Despliegue: Supabase → Edge Functions → Deploy a new function → Via editor
//   nombre: staff  ·  pega este archivo  ·  desactiva "Verify JWT" (la función valida al usuario por sí misma)
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ROLES = ['admin', 'registrador'];
const cleanEmail = (e: unknown) => String(e ?? '').trim().toLowerCase();
function checkInput(email: string, password?: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Correo no válido');
  if (password !== undefined && String(password).length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const { count: adminCount, error: cErr } = await db.from('staff').select('user_id', { count: 'exact', head: true }).eq('role', 'admin');
    if (cErr) throw cErr;

    // ── Sin sesión ──
    if (action === 'status') return json({ hasAdmin: (adminCount ?? 0) > 0 });

    if (action === 'bootstrap') {
      if ((adminCount ?? 0) > 0) return json({ error: 'Ya existe un administrador. Inicia sesión.' }, 403);
      const email = cleanEmail(body.email); checkInput(email, body.password);
      const { data, error } = await db.auth.admin.createUser({ email, password: String(body.password), email_confirm: true });
      if (error) throw error;
      const { error: sErr } = await db.from('staff').insert({ user_id: data.user.id, email, role: 'admin' });
      if (sErr) throw sErr;
      return json({ ok: true });
    }

    // ── A partir de aquí: solo administradores ──
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: who } = await db.auth.getUser(token);
    if (!who?.user) return json({ error: 'Inicia sesión de nuevo' }, 401);
    const { data: me } = await db.from('staff').select('role').eq('user_id', who.user.id).maybeSingle();
    if (me?.role !== 'admin') return json({ error: 'Solo un administrador puede gestionar usuarios' }, 403);

    const target = String(body.user_id || '');
    const notSelf = () => { if (target === who.user!.id) throw new Error('No puedes hacer eso con tu propia cuenta'); };

    switch (action) {
      case 'list': {
        const { data: staff, error } = await db.from('staff').select('*').order('created_at');
        if (error) throw error;
        const users = [];
        for (const s of staff) {
          const { data } = await db.auth.admin.getUserById(s.user_id);
          users.push({ ...s, last_sign_in_at: data?.user?.last_sign_in_at ?? null, me: s.user_id === who.user.id });
        }
        return json({ users });
      }
      case 'create': {
        const email = cleanEmail(body.email); checkInput(email, body.password);
        const role = ROLES.includes(body.role) ? body.role : 'registrador';
        let userId: string;
        const { data, error } = await db.auth.admin.createUser({ email, password: String(body.password), email_confirm: true });
        if (error) {
          // Si la cuenta ya existía (p. ej. se quitó del staff antes) se reactiva con la nueva contraseña
          if (!/already|registered|exists/i.test(error.message)) throw error;
          const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
          const found = list?.users.find((u) => u.email?.toLowerCase() === email);
          if (!found) throw error;
          userId = found.id;
          await db.auth.admin.updateUserById(userId, { password: String(body.password), ban_duration: 'none' });
        } else userId = data.user.id;
        const { error: sErr } = await db.from('staff').upsert({ user_id: userId, email, role });
        if (sErr) throw sErr;
        return json({ ok: true });
      }
      case 'set_role': {
        notSelf();
        if (!ROLES.includes(body.role)) throw new Error('Rol no válido');
        const { error } = await db.from('staff').update({ role: body.role }).eq('user_id', target);
        if (error) throw error;
        return json({ ok: true });
      }
      case 'reset_password': {
        if (String(body.password || '').length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
        const { data: s } = await db.from('staff').select('user_id').eq('user_id', target).maybeSingle();
        if (!s) throw new Error('Usuario no encontrado');
        const { error } = await db.auth.admin.updateUserById(target, { password: String(body.password) });
        if (error) throw error;
        return json({ ok: true });
      }
      case 'delete': {
        notSelf();
        const { error } = await db.from('staff').delete().eq('user_id', target);
        if (error) throw error;
        await db.auth.admin.deleteUser(target);
        return json({ ok: true });
      }
      default:
        return json({ error: 'Acción desconocida' }, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: /already|registered/i.test(msg) ? 'Ya existe una cuenta con ese correo' : msg }, 400);
  }
});
