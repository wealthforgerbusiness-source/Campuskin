export function unwrap(body) {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const d = body.data;
    if (d && typeof d === 'object' && !Array.isArray(d)) return d;
  }
  return body;
}

export async function saspay(path, { method = 'GET', body, timeoutMs = 8000 } = {}) {
  const key = process.env.SASPAY_SECRET_KEY;
  if (!key) return { ok: false, status: 0, code: 'no_key', data: null };

  const base = (process.env.SASPAY_API_URL || 'https://api.saspay.me/api/v1').replace(/\/+$/, '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = { Authorization: `Bearer ${key}`, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    const code =
      json && typeof json === 'object' && !Array.isArray(json) && json.code != null
        ? String(json.code)
        : null;
    return { ok: res.ok, status: res.status, code, data: unwrap(json) };
  } catch {
    // Erreur réseau ou délai dépassé : aucun détail loggé (jamais la clé ni les corps).
    return { ok: false, status: 0, code: 'network', data: null };
  } finally {
    clearTimeout(timer);
  }
}

// Identique à la fonction SQL norm_promo : btrim (espaces seulement), \s+ -> ' ', minuscules.
export function normPromo(p) {
  return String(p ?? '')
    .replace(/^ +| +$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function siteUrl() {
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (/^https:\/\/[^\s/]+/i.test(raw)) return raw;
  if (/^http:\/\/localhost(:\d+)?$/i.test(raw)) return raw;
  return '';
}

export function dureeJours() {
  const n = parseInt(process.env.ABONNEMENT_DUREE_JOURS || '', 10);
  if (Number.isInteger(n) && n >= 1 && n <= 3650) return n;
  return 180;
}

export function prixAbonnement(devise) {
  let raw;
  if (devise === 'USD') raw = process.env.ABONNEMENT_PRIX_USD;
  else if (devise === 'CDF') raw = process.env.ABONNEMENT_PRIX_CDF;
  else return null;

  const prix = Math.round(Number(raw) * 100) / 100;
  if (!Number.isFinite(prix) || prix <= 0) return null;

  const mode = String(process.env.SASPAY_FEE_MODE || 'ADD_ON').trim().toUpperCase();
  if (mode === 'DEDUCTED') {
    const rawPct = process.env.SASPAY_FEE_PERCENT;
    if (rawPct === undefined || String(rawPct).trim() === '') return null;
    const pct = Number(rawPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) return null;
    const envoye = Math.ceil((prix / (1 - pct / 100)) * 100) / 100;
    return { prix, envoye };
  }
  return { prix, envoye: prix };
}
