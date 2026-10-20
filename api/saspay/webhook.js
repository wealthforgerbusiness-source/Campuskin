import crypto from 'node:crypto';
import { getAdmin } from '../../lib/supabaseAdmin.js';
import { json, UUID } from '../../lib/api.js';
import { saspay, dureeJours } from '../../lib/saspay.js';

// Signature = HMAC-SHA256(secret, `${timestamp}.${corps_brut}`) en hexadécimal.
function signatureValide(raw, ts, sig, secret) {
  if (!ts || !sig || !/^\d{1,13}$/.test(String(ts))) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // rejeu > 5 min
  const attendu = crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
  const a = Buffer.from(attendu, 'utf8');
  const b = Buffer.from(String(sig).trim().toLowerCase(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request) {
  const secret = process.env.SASPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook] SASPAY_WEBHOOK_SECRET manquant');
    return json({ error: 'config' }, 500);
  }

  const raw = await request.text(); // corps BRUT, jamais re-sérialisé
  if (raw.length > 100000) return json({ error: 'trop_gros' }, 413);

  if (!signatureValide(raw, request.headers.get('x-webhook-timestamp'), request.headers.get('x-webhook-signature'), secret)) {
    return json({ error: 'signature_invalide' }, 403);
  }

  let evt;
  try { evt = JSON.parse(raw); } catch { return json({ error: 'json' }, 400); }
  const event = evt && evt.event;

  if (event === 'webhook.test') return json({ ok: true });
  if (!['transaction.success', 'transaction.failed', 'transaction.cancelled'].includes(event)) return json({ ok: true });

  const txId = evt.data && typeof evt.data.id === 'string' ? evt.data.id : '';
  if (!UUID.test(txId)) return json({ ok: true });

  let admin;
  try { admin = getAdmin(); } catch { return json({ error: 'config' }, 500); }

  // On ne fait JAMAIS confiance au contenu du webhook : on revérifie auprès de SasPay.
  let v;
  try { v = await saspay(`/payments/${txId}/verify/`, { timeoutMs: 8000 }); } catch { return json({ error: 'verify_reseau' }, 500); }
  if (v.status === 404) return json({ ok: true });
  if (!v.ok) { console.error('[webhook] verify http', v.status); return json({ error: 'verify' }, 500); } // SasPay réessaiera
  const d = v.data || {};

  // Retrouver notre ligne : par id de transaction connu, sinon par le marqueur CK:<uuid>
  let { data: row } = await admin.from('paiements').select('*').eq('saspay_transaction_id', txId).maybeSingle();
  if (!row) {
    const m = /CK:([0-9a-f-]{36})/i.exec(String(d.description || ''));
    if (m && UUID.test(m[1])) {
      const r2 = await admin.from('paiements').select('*').eq('id', m[1]).maybeSingle();
      row = r2.data || null;
    }
  }
  if (!row) { console.warn('[webhook] aucun paiement pour la transaction', txId); return json({ ok: true }); }

  // Seconde transaction sur une session déjà réglée : on garde une trace, sans rien créditer.
  if (row.saspay_transaction_id && row.saspay_transaction_id !== txId) {
    await admin.from('paiements').update({ anomalie: `transaction_en_double_${txId}` }).eq('id', row.id);
    return json({ ok: true });
  }

  if (event !== 'transaction.success') {
    await admin.from('paiements').update({ statut: 'echoue', saspay_transaction_id: txId }).eq('id', row.id).eq('statut', 'en_attente');
    return json({ ok: true });
  }

  // Succès : SUCCESS côté SasPay + bonne devise + montant net suffisant
  if (String(d.status).toUpperCase() !== 'SUCCESS') return json({ error: 'pas_encore_success' }, 500); // SasPay réessaiera
  const net = Number(d.net_amount);
  if (String(d.currency).toUpperCase() !== row.devise) {
    await admin.from('paiements').update({ anomalie: 'devise_differente' }).eq('id', row.id);
    return json({ ok: true });
  }
  if (!Number.isFinite(net) || net + 0.005 < Number(row.montant)) {
    await admin.from('paiements').update({ anomalie: `montant_insuffisant_${d.net_amount}` }).eq('id', row.id);
    return json({ ok: true });
  }

  // Confirmation atomique et idempotente (rejouer le webhook ne prolonge rien)
  const { data: res, error } = await admin.rpc('confirmer_paiement', {
    p_id: row.id, p_tx: txId, p_net: net,
    p_fee_mode: d.fee_charge_mode ? String(d.fee_charge_mode) : null,
    p_ref: d.reference ? String(d.reference) : null,
    p_jours: dureeJours(),
  });
  if (error) { console.error('[webhook] confirmer_paiement', error.code); return json({ error: 'db' }, 500); }
  return json({ ok: true, resultat: res });
}
