import { $, fmt, enregistrerSW } from './ui.js';
import { sessionCourante, profilCourant, destination } from './supabase.js';

enregistrerSW();

// Prix fixés par le serveur (jamais par le navigateur)
(async () => {
  try {
    const r = await fetch('/api/saspay/prix', { cache: 'no-store' });
    const p = r.ok ? await r.json() : null;
    if (p) {
      if (p.USD) $('#prix-usd').textContent = fmt(p.USD, 2);
      if (p.CDF) $('#prix-cdf').textContent = fmt(p.CDF, 0);
      if (p.duree_jours) $('#duree').textContent = p.duree_jours;
    }
  } catch {}
})();

// Visiteur déjà connecté : le bouton mène à son espace
(async () => {
  try {
    if (!(await sessionCourante())) return;
    const profil = await profilCourant();
    const href = destination(profil && profil.role);
    for (const a of document.querySelectorAll('[data-cta]')) {
      a.setAttribute('href', href);
      a.textContent = 'Mon espace';
    }
  } catch {}
})();
