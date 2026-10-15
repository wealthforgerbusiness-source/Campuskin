// Usage : SASPAY_SECRET_KEY=sk_test_xxx node scripts/saspay-discover.mjs [--checkout]
// Node 18+. Refuse toute clé qui ne commence pas par sk_test_. N'affiche aucun secret.

const KEY = process.env.SASPAY_SECRET_KEY || '';
if (!KEY.startsWith('sk_test_')) {
  console.error('Refus : définis SASPAY_SECRET_KEY avec une clé sk_test_… (jamais sk_live_).');
  process.exit(1);
}
const BASE = (process.env.SASPAY_API_URL || 'https://api.saspay.me/api/v1').replace(/\/+$/, '');
const DO_CHECKOUT = process.argv.includes('--checkout');

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (auth) headers.Authorization = `Bearer ${KEY}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch { /* corps non JSON */ }
  return { status: res.status, json };
}

const unwrap = (j) => (j && typeof j === 'object' && !Array.isArray(j) && j.data && typeof j.data === 'object' && !Array.isArray(j.data) ? j.data : j);

// Tolérant sur la forme de pagination (tableau, {results,next}, {data:{results,next}}, {data:[…]}).
function extraire(json) {
  const u = unwrap(json);
  if (Array.isArray(u)) return { items: u, next: null };
  if (u && Array.isArray(u.results)) return { items: u.results, next: u.next || null };
  if (u && Array.isArray(u.items)) return { items: u.items, next: u.next || null };
  if (json && Array.isArray(json.data)) return { items: json.data, next: json.next || null };
  return { items: [], next: null };
}

async function toutesPages(path, auth = true) {
  const tout = [];
  for (let page = 1; page <= 50; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await api(`${path}${sep}page=${page}&page_size=100`, { auth });
    if (r.status < 200 || r.status >= 300) {
      console.log(`  HTTP ${r.status} sur ${path} (page ${page})`);
      break;
    }
    const { items, next } = extraire(r.json);
    tout.push(...items);
    if (!next || items.length === 0) break;
  }
  return tout;
}

const titre = (t) => console.log(`\n=== ${t} ===`);

// --- 1. Pays ---
titre('GET /countries/ (public)');
const pays = await toutesPages('/countries/', false);
console.log(`  ${pays.length} pays reçus`);
const cd = pays.find((p) =>
  ['code', 'iso2', 'iso_code', 'alpha2', 'country_code'].some((k) => String(p?.[k] || '').toUpperCase() === 'CD')
) || pays.find((p) => /congo/i.test(JSON.stringify(p)) && /d[eé]mocratic|rdc|kinshasa/i.test(JSON.stringify(p)));
if (!cd) {
  console.log('  Pays CD introuvable : inspecte la structure ci-dessous.');
  console.log(JSON.stringify(pays.slice(0, 2), null, 2));
  process.exit(1);
}
console.log('  Pays CD :', JSON.stringify(cd));
const cdId = cd.id;

// --- 2. Réseaux ---
titre('GET /networks/ filtré sur CD');
const reseaux = await toutesPages('/networks/');
const estCD = (n) => n?.country === cdId || n?.country?.id === cdId || n?.country_id === cdId ||
  String(n?.country_code || n?.country?.code || '').toUpperCase() === 'CD';
const reseauxCD = reseaux.filter(estCD);
console.log(`  ${reseaux.length} réseaux au total, ${reseauxCD.length} pour CD`);
for (const n of reseauxCD) {
  console.log(`  - code=${n.code ?? n.slug ?? '?'} | nom=${n.name ?? n.nom ?? '?'} | actif=${n.is_active ?? n.active ?? n.status ?? '?'}`);
}
const idsReseauxCD = new Set(reseauxCD.map((n) => n.id));

// --- 3. Tarifs ---
titre('GET /pricing/my-rates/ (lignes RDC, JSON brut)');
const tarifs = await toutesPages('/pricing/my-rates/');
const lignesCD = tarifs.filter((t) =>
  idsReseauxCD.has(t?.network) || idsReseauxCD.has(t?.network?.id) || idsReseauxCD.has(t?.network_id) || estCD(t) || estCD(t?.network)
);
console.log(`  ${tarifs.length} lignes au total, ${lignesCD.length} pour la RDC`);
console.log(JSON.stringify(lignesCD, null, 2));

// --- 4. Checkout (optionnel) ---
if (DO_CHECKOUT) {
  titre('Sessions de checkout test');
  for (const [devise, montant] of [['USD', '1.00'], ['CDF', '2000.00']]) {
    console.log(`\n-- ${devise} ${montant}`);
    const r = await api('/checkout-sessions/', {
      method: 'POST',
      body: {
        amount: montant,
        currency: devise,
        description: 'Test CK:00000000-0000-0000-0000-000000000000',
        country: 'CD',
        customer_email: 'test.campuskin@example.com',
        customer_name: 'Test CampusKin',
        metadata: { paiement_id: 'test' },
      },
    });
    const enveloppe = !!(r.json && typeof r.json === 'object' && 'success' in r.json && 'data' in r.json);
    const d = unwrap(r.json);
    console.log(`  HTTP ${r.status} | enveloppe {success,data} : ${enveloppe ? 'oui' : 'non'}`);
    if (r.status < 200 || r.status >= 300) {
      console.log('  Refus (devise/pays non acceptés ?) :', JSON.stringify(r.json));
      continue;
    }
    console.log('  Champs :', Object.keys(d || {}).join(', '));
    let hote = '?';
    try { hote = new URL(d.checkout_url).hostname; } catch { /* url absente */ }
    console.log('  Hôte checkout_url :', hote);
    console.log('  status :', d.status, '| transaction :', JSON.stringify(d.transaction ?? null));
    console.log('  metadata renvoyée :', JSON.stringify(d.metadata ?? null));

    if (d.id) {
      const g = await api(`/checkout-sessions/${encodeURIComponent(d.id)}/`);
      if (g.status >= 200 && g.status < 300) {
        const s = unwrap(g.json);
        console.log(`  Relecture HTTP ${g.status} | champs :`, Object.keys(s || {}).join(', '));
        console.log('  transaction :', JSON.stringify(s?.transaction ?? null), '| fee_charge_mode :', s?.fee_charge_mode ?? 'absent');
        console.log('  metadata :', JSON.stringify(s?.metadata ?? null));
      } else {
        console.log(`  Relecture : HTTP ${g.status} (endpoint de lecture non confirmé dans la doc)`);
      }
    }
  }
}
console.log('\nTerminé.');
