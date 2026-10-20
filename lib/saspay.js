// SERVEUR UNIQUEMENT. Aucune clé n'est jamais loguée.
const BASE = process.env.SASPAY_API_URL || 'https://api.saspay.me/api/v1';

// Accepte l'enveloppe { success, data, code } ET une réponse « à plat ».
export function unwrap(body) {
  return body && typeof body === 'object' && body.data && typeof body.data === 'object' && !Array.isArray(body.data)
    ? body.data
    : body;
}

export async function saspay(path, { method = 'GET', body, timeoutMs = 8000 } = {}) {
  const key = process.env.SASPAY_SECRET_KEY;
  if (!key) throw new Error('config_saspay');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
      cache: 'no-store',
    });
    let json = null;
    try { json = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, code: (json && json.code) || null, data: unwrap(json) };
  } finally {
    clearTimeout(timer);
  }
}

export const normPromo = (p) => String(p || '').trim().replace(/\s+/g, ' ').toLowerCase();

export function siteUrl() {
  const u = String(process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  return /^https:\/\/[^\s/]+/i.test(u) || /^http:\/\/localhost(:\d+)?$/i.test(u) ? u : '';
}

export function dureeJours() {
  const n = parseInt(process.env.ABONNEMENT_DUREE_JOURS || '180', 10);
  return Number.isInteger(n) && n >= 1 && n <= 3650 ? n : 180;
}

// Le prix vient TOUJOURS du serveur. `prix` = ce que tu veux recevoir ; `envoye` = montant transmis à SasPay.
export function prixAbonnement(devise) {
  const raw = devise === 'USD' ? process.env.ABONNEMENT_PRIX_USD : devise === 'CDF' ? process.env.ABONNEMENT_PRIX_CDF : null;
  const prix = Math.round(parseFloat(String(raw || '').replace(',', '.')) * 100) / 100;
  if (!Number.isFinite(prix) || prix <= 0) return null;
  let envoye = prix;
  if ((process.env.SASPAY_FEE_MODE || 'ADD_ON').toUpperCase() === 'DEDUCTED') {
    // DEDUCTED : SasPay retire ses frais du montant → on majore : envoye = prix / (1 - taux)
    const pct = parseFloat(String(process.env.SASPAY_FEE_PERCENT || '').replace(',', '.'));
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 50) return null;
    envoye = Math.ceil((prix / (1 - pct / 100)) * 100 - 1e-9) / 100;
  }
  return { prix, envoye };
}
