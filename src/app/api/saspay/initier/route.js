import { NextResponse } from 'next/server';
import { getAdmin } from '../../../../lib/supabaseAdmin';
import { saspay, normPromo, siteUrl, prixAbonnement } from '../../../../lib/saspay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (body, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function urlCheckoutValide(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && (x.hostname === 'saspay.me' || x.hostname.endsWith('.saspay.me'));
  } catch {
    return false;
  }
}

export async function POST(request) {
  // 1. Client service_role
  let admin;
  try {
    admin = getAdmin();
  } catch {
    return json({ error: 'Service indisponible.' }, 503);
  }

  // 2. Jeton + corps (seule la devise vient du navigateur)
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  if (!m) return json({ error: 'Connexion requise.' }, 401);
  const token = m[1].trim();

  let payload = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }
  const devise = payload && payload.devise;
  if (devise !== 'USD' && devise !== 'CDF') {
    return json({ error: 'Devise invalide.' }, 400);
  }

  // 3. Identité
  const { data: ud, error: ue } = await admin.auth.getUser(token);
  if (ue || !ud || !ud.user) return json({ error: 'Session invalide, reconnecte-toi.' }, 401);
  const user = ud.user;

  // 4. Profil : rôle et promotion viennent uniquement de la base
  const { data: profil, error: pe } = await admin
    .from('profiles')
    .select('id, nom, email, promotion, role')
    .eq('id', user.id)
    .maybeSingle();
  if (pe) {
    console.error('saspay/initier: lecture profil échouée', pe.code || '');
    return json({ error: 'Service indisponible.' }, 503);
  }
  if (!profil || (profil.role !== 'delegue' && profil.role !== 'admin')) {
    return json({ error: 'Réservé aux délégués.' }, 403);
  }
  const promotion = normPromo(profil.promotion);
  if (!promotion) {
    return json({ error: "Ta promotion n'est pas renseignée sur ton profil." }, 400);
  }
  const email = String(profil.email || user.email || '').trim();
  if (!email) return json({ error: "Aucune adresse e-mail n'est associée à ton compte." }, 400);

  // 5. Prix et URL du site
  const px = prixAbonnement(devise);
  const site = siteUrl();
  if (!px || !site) {
    console.error('saspay/initier: configuration prix ou site invalide');
    return json({ error: 'Le paiement est momentanément indisponible. Réessaie plus tard.' }, 503);
  }

  // 6. Expire les anciennes sessions en attente (> 30 min) de cet utilisateur
  const limite = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { error: ex } = await admin
    .from('paiements')
    .update({ statut: 'echoue' })
    .eq('user_id', user.id)
    .eq('statut', 'en_attente')
    .lt('created_at', limite);
  if (ex) console.error('saspay/initier: expiration échouée', ex.code || '');

  // 7. Insertion (idempotence via l'index unique paiements_un_en_attente)
  const { data: paiement, error: ie } = await admin
    .from('paiements')
    .insert({
      user_id: user.id,
      promotion,
      devise,
      montant: px.prix,
      frais: 0,
      total: px.envoye,
      montant_envoye: px.envoye,
      statut: 'en_attente',
    })
    .select('id')
    .single();

  if (ie || !paiement) {
    if (ie && ie.code === '23505') {
      const { data: existant } = await admin
        .from('paiements')
        .select('id, saspay_checkout_url')
        .eq('user_id', user.id)
        .eq('promotion', promotion)
        .eq('devise', devise)
        .eq('statut', 'en_attente')
        .maybeSingle();
      if (existant && existant.saspay_checkout_url && urlCheckoutValide(existant.saspay_checkout_url)) {
        return json({ url: existant.saspay_checkout_url, paiement_id: existant.id });
      }
      return json(
        { error: 'Un paiement est déjà en cours de création, réessaie dans quelques secondes.' },
        409
      );
    }
    console.error('saspay/initier: insertion paiement échouée', (ie && ie.code) || '');
    return json({ error: 'Service indisponible.' }, 503);
  }

  // 8. Création de la session SasPay (pas de téléphone, pas de fee_charge_mode)
  const nom = String(profil.nom || '').trim().slice(0, 80) || 'Délégué CampusKin';
  const r = await saspay('/checkout-sessions/', {
    method: 'POST',
    body: {
      amount: px.envoye.toFixed(2),
      currency: devise,
      description: `CampusKin abonnement CK:${paiement.id}`,
      country: 'CD',
      customer_email: email,
      customer_name: nom,
      return_url: `${site}/admin?paiement=retour`,
      metadata: { paiement_id: paiement.id, promotion },
    },
  });

  // 9. Validation de la réponse
  const d = r.data && typeof r.data === 'object' ? r.data : {};
  const sid = d.id != null ? String(d.id) : '';
  const url = typeof d.checkout_url === 'string' ? d.checkout_url : '';

  if (!r.ok || !sid || !url || !urlCheckoutValide(url)) {
    console.error('saspay/initier: création de session échouée', 'status=' + r.status, 'code=' + (r.code || ''));
    await admin
      .from('paiements')
      .update({ statut: 'echoue', anomalie: `creation_session_${r.status}` })
      .eq('id', paiement.id);
    return json({ error: 'Le paiement est momentanément indisponible. Réessaie plus tard.' }, 502);
  }

  // 10. Enregistrement (le webhook retrouve aussi la ligne via le marqueur CK: de la description)
  const { error: ue2 } = await admin
    .from('paiements')
    .update({
      saspay_id: sid,
      saspay_slug: typeof d.slug === 'string' ? d.slug : null,
      saspay_checkout_url: url,
    })
    .eq('id', paiement.id);
  if (ue2) console.error('saspay/initier: enregistrement session échoué', ue2.code || '');

  return json({ url, paiement_id: paiement.id });
}
