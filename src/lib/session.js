// src/lib/session.js
// Efface les données personnelles gardées sur l'appareil (téléphone partagé).
const CLES_LOCALES = ['ck_rate', 'ck_budget', 'ck_expenses', 'campuskin_notes'];
const CLES_SESSION = ['ck_pay_id'];

export function purgerDonneesLocales() {
  try {
    CLES_LOCALES.forEach((k) => localStorage.removeItem(k));
  } catch {}
  try {
    CLES_SESSION.forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}
