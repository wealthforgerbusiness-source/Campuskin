import { getAdmin } from '../../lib/supabaseAdmin.js';
import { json, jetonDepuis, utilisateurAuthentifie, profilDe } from '../../lib/api.js';
import { saspay, normPromo, prixAbonnement, siteUrl } from '../../lib/saspay.js';

export async function POST(request) {
  let admin;
  try {
    admin = getAdmin();
  } catch {
    console.error('[initier] configuration Supabase manquante');
    return json({ error: 'Service indisponible.' }, 503);
  }

  // 1) Authentification + devise (seule donnée envoyée par le navigateur)
  const token = jetonDepuis(request);
  if (!token) return json({ error: 'Non autorisé.' }, 401);
  const body = await request.json().catch(() => null);
  const devise = body && body.devise;
  if (devise !== 'USD' && devise !== 'CDF') return json({ error: 'Devise invalide.' }, 400);

  const user = await utilisateurAuthentifie(admin, token);
  if (!user) return json({ error: 'Session expirée. Reconnecte-toi.' }, 401);

  // 2) Rôle et promotion lus côté serveur
  const prof = await profilDe(admin, user.id);
  if (!prof || !['delegue', 'admin'].includes(prof.role)) return json({ error: 'Accès refusé.' }, 403);
  const promotion = normPromo(prof.promotion);
  if (!promotion) return json({ error: 'Ta promotion n’est pas renseignée.' }, 400);
  const email = prof.email || user.email;
  if (!email) return json({ error: 'Adresse e-mail introuvable sur ton profil.' }, 400);
  const nom = String(prof.nom || '').trim().slice(0, 80) || 'Délégué CampusKin';

  // 3) Prix et URL de retour : configuration serveur
  const cfg = prixAbonnement(devise);
  const site = siteUrl();
  if (!cfg || !site) {
    console.error('[initier] prix ou SITE_URL mal configuré');
    return json({ error: 'Service indisponible.' }, 503);
  }

  // 4) Abandonne les paiements « en_attente » de plus de 30 min (un succès tardif reste confirmable)
  await admin.from('paiements').update({ statut: 'echoue' }).eq('user_id', prof.id).eq('statut', 'en_attente')
    .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

  // 5) Ligne paiement : écrite uniquement par le serveur
  const { data: row, error: ie } = await admin.from('paiements').insert({
    user_id: prof.id, promotion, devise, montant: cfg.prix, frais: 0, total: cfg.envoye,
    montant_envoye: cfg.envoye, statut: 'en_attente',
  }).select('id').single();

  if (ie) {
    if (ie.code === '23505') {
      // double clic : on renvoie la même session
      const { data: ex } = await admin.from('paiements').select('id, saspay_checkout_url').eq('user_id', prof.id)
        .eq('promotion', promotion).eq('devise', devise).eq('statut', 'en_attente').maybeSingle();
      if (ex && ex.saspay_checkout_url) return json({ url: ex.saspay_checkout_url, paiement_id: ex.id });
      return json({ error: 'Un paiement est déjà en cours de création. Réessaie dans quelques secondes.' }, 409);
    }
    console.error('[initier] insertion refusée, code', ie.code);
    return json({ error: 'Paiement impossible pour le moment.' }, 500);
  }

  // 6) Session de paiement SasPay. Le marqueur CK:<id> relie la transaction à notre ligne.
  let r;
  try {
    r = await saspay('/checkout-sessions/', {
      method: 'POST',
      body: {
        amount: cfg.envoye.toFixed(2),
        currency: devise,
        description: `CampusKin abonnement CK:${row.id}`,
        country: 'CD',
        customer_email: email,
        customer_name: nom,
        return_url: `${site}/admin/?paiement=retour`,
        metadata: { paiement_id: row.id, promotion },
      },
    });
  } catch {
    r = { ok: false, status: 0, code: 'reseau', data: null };
  }

  const d = r.data || {};
  let url = null;
  try {
    const parsed = new URL(String(d.checkout_url || ''));
    if (parsed.protocol === 'https:' && /(^|\.)saspay\.me$/i.test(parsed.hostname)) url = parsed.toString();
  } catch {}

  if (!r.ok || !d.id || !url) {
    console.error('[initier] échec session, http', r.status, 'code', r.code);
    await admin.from('paiements').update({ statut: 'echoue', anomalie: `creation_session_${r.status || 'reseau'}` }).eq('id', row.id);
    return json({ error: 'Le paiement est momentanément indisponible. Réessaie plus tard.' }, 502);
  }

  await admin.from('paiements').update({
    saspay_id: String(d.id), saspay_slug: d.slug ? String(d.slug) : null, saspay_checkout_url: url,
  }).eq('id', row.id);

  return json({ url, paiement_id: row.id });
}
