import { getAdmin } from '../../lib/supabaseAdmin.js';
import { json, jetonDepuis, utilisateurAuthentifie, profilDe, UUID } from '../../lib/api.js';

// Seul un administrateur authentifié peut supprimer un compte (vérifié côté serveur).
export async function POST(request) {
  let admin;
  try {
    admin = getAdmin();
  } catch {
    return json({ error: 'Service indisponible.' }, 503);
  }

  const token = jetonDepuis(request);
  if (!token) return json({ error: 'Non autorisé.' }, 401);
  const body = await request.json().catch(() => null);
  const cible = body && typeof body.id === 'string' ? body.id : '';
  if (!UUID.test(cible)) return json({ error: 'Identifiant invalide.' }, 400);

  const user = await utilisateurAuthentifie(admin, token);
  if (!user) return json({ error: 'Session expirée. Reconnecte-toi.' }, 401);
  const moi = await profilDe(admin, user.id);
  if (!moi || moi.role !== 'admin') return json({ error: 'Accès refusé.' }, 403);

  if (cible === user.id) return json({ error: 'Tu ne peux pas supprimer ton propre compte.' }, 400);
  const profilCible = await profilDe(admin, cible);
  if (!profilCible) return json({ error: 'Utilisateur introuvable.' }, 404);
  if (profilCible.role === 'admin') return json({ error: 'Un administrateur ne peut pas être supprimé ici.' }, 403);

  // Les paiements sont conservés (anonymisés) pour la comptabilité.
  const { error } = await admin.auth.admin.deleteUser(cible);
  if (error) {
    console.error('[supprimer-utilisateur] échec');
    return json({ error: 'Suppression impossible pour le moment.' }, 500);
  }
  return json({ ok: true });
}
