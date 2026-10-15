import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getAdmin } from '../../../../lib/supabaseAdmin';
import { saspay, dureeJours } from '../../../../lib/saspay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 100000;
const MAX_AGE_S = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENTS = new Set(['transaction.success', 'transaction.failed', 'transaction.cancelled']);

const rep = (status, body = {}) => NextResponse.json(body, { status });

function signatureValide(secret, ts, raw, recue) {
  const attendue = crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
  const a = Buffer.from(attendue, 'utf8');
  const b = Buffer.from(String(recue || '').trim().replace(/^sha256=/i, '').toLowerCase(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function marquerAnomalie(admin, id, code) {
  const { error } = await admin
    .from('paiements')
    .update({ anomalie: code })
    .eq('id', id)
    .neq('statut', 'confirme');
  return !error;
}

export async function POST(request) {
  // 1. Corps brut, taille limitée
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BYTES) return rep(413, { error: 'Trop volumineux.' });
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BYTES) return rep(413, { error: 'Trop volumineux.' });

  // 2. Signature, âge, temps constant
  const secret = process.env.SASPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('saspay/webhook: SASPAY_WEBHOOK_SECRET manquant');
    return rep(500, { error: 'Configuration manquante.' });
  }
  const ts = (request.headers.get('x-webhook-timestamp') || '').trim();
  if (!/^\d{1,13}$/.test(ts)) return rep(403, { error: 'Refusé.' });
  if (Math.abs(Date.now() / 1000 - Number(ts)) > MAX_AGE_S) return rep(403, { error: 'Refusé.' });
  if (!signatureValide(secret, ts, raw, request.headers.get('x-webhook-signature'))) {
    return rep(403, { error: 'Refusé.' });
  }

  // 3. Analyse
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return rep(400, { error: 'JSON invalide.' });
  }
  const event =
    body && typeof body.event === 'string'
      ? body.event
      : request.headers.get('x-webhook-event') || '';
  if (event === 'webhook.test') return rep(200, { ok: true });
  if (!EVENTS.has(event)) return rep(200, { ignored: true });

  // 4. data.id = UUID de la transaction
  const data = body && typeof body.data === 'object' && body.data ? body.data : {};
  const txId = typeof data.id === 'string' ? data.id.trim() : '';
  if (!UUID.test(txId)) return rep(200, { ignored: true });

  let admin;
  try {
    admin = getAdmin();
  } catch {
    return rep(500, { error: 'Configuration manquante.' });
  }

  // 5. Le contenu du webhook n'est jamais cru : revérification côté SasPay
  const vr = await saspay(`/payments/${encodeURIComponent(txId)}/verify/`);
  if (vr.status === 404) return rep(200, { ignored: true });
  if (!vr.ok) {
    console.error('saspay/webhook: verify échoué', 'status=' + vr.status, 'code=' + (vr.code || ''));
    return rep(500, { error: 'Réessaie.' });
  }
  const v = vr.data && typeof vr.data === 'object' ? vr.data : {};

  // 6. Retrouver la ligne paiements
  const cols = 'id, devise, montant, statut, saspay_transaction_id';
  let row = null;
  const r1 = await admin.from('paiements').select(cols).eq('saspay_transaction_id', txId).maybeSingle();
  if (r1.error) {
    console.error('saspay/webhook: lecture paiement échouée', r1.error.code || '');
    return rep(500, { error: 'Réessaie.' });
  }
  row = r1.data;

  if (!row) {
    const mk = /CK:([0-9a-f-]{36})/i.exec(String(v.description || ''));
    if (mk && UUID.test(mk[1])) {
      const r2 = await admin.from('paiements').select(cols).eq('id', mk[1]).maybeSingle();
      if (r2.error) {
        console.error('saspay/webhook: lecture paiement (marqueur) échouée', r2.error.code || '');
        return rep(500, { error: 'Réessaie.' });
      }
      row = r2.data;
    }
  }
  if (!row) {
    console.warn('saspay/webhook: paiement introuvable pour une transaction');
    return rep(200, { ignored: true });
  }
  if (row.saspay_transaction_id && row.saspay_transaction_id !== txId) {
    await marquerAnomalie(admin, row.id, 'transaction_differente');
    return rep(200, { ignored: true });
  }

  const statutVerify = String(v.status || '').toUpperCase();

  // 7. Échec / annulation
  if (event === 'transaction.failed' || event === 'transaction.cancelled') {
    if (statutVerify === 'SUCCESS') return rep(200, { ignored: true }); // incohérent : on ne marque pas échoué
    const { error } = await admin
      .from('paiements')
      .update({ statut: 'echoue', saspay_transaction_id: txId })
      .eq('id', row.id)
      .eq('statut', 'en_attente');
    if (error) {
      console.error('saspay/webhook: mise à jour échec impossible', error.code || '');
      return rep(500, { error: 'Réessaie.' });
    }
    return rep(200, { ok: true });
  }

  // 8. Succès
  if (statutVerify !== 'SUCCESS') {
    console.warn('saspay/webhook: succès annoncé mais verify =', statutVerify || 'vide');
    return rep(500, { error: 'Réessaie.' });
  }
  if (String(v.currency || '').toUpperCase() !== String(row.devise || '').toUpperCase()) {
    await marquerAnomalie(admin, row.id, 'devise_differente');
    return rep(200, { ignored: true });
  }
  const net = Number(v.net_amount);
  if (!Number.isFinite(net) || net + 0.005 < Number(row.montant)) {
    await marquerAnomalie(admin, row.id, `montant_insuffisant_${Number.isFinite(net) ? net : 'inconnu'}`);
    return rep(200, { ignored: true });
  }

  const { error: rpcErr } = await admin.rpc('confirmer_paiement', {
    p_id: row.id,
    p_tx: txId,
    p_net: net,
    p_fee_mode: v.fee_charge_mode != null ? String(v.fee_charge_mode) : null,
    p_ref: v.reference != null ? String(v.reference) : null,
    p_jours: dureeJours(),
  });
  if (rpcErr) {
    console.error('saspay/webhook: confirmer_paiement échoué', rpcErr.code || '');
    return rep(500, { error: 'Réessaie.' });
  }

  // 9. Rejeu : la fonction SQL renvoie 'deja_traite' sans prolonger l'abonnement.
  return rep(200, { ok: true });
}
