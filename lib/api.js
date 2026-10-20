// Outils communs des fonctions /api (serveur uniquement).
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function jetonDepuis(request) {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  return m ? m[1].trim() : '';
}

// Vérifie le jeton auprès de Supabase : jamais de confiance au navigateur.
export async function utilisateurAuthentifie(admin, token) {
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error || !data || !data.user ? null : data.user;
}

export async function profilDe(admin, id) {
  const { data } = await admin.from('profiles').select('id, nom, email, promotion, role').eq('id', id).maybeSingle();
  return data || null;
}
