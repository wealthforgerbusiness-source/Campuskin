import { json } from '../../lib/api.js';
import { prixAbonnement, dureeJours } from '../../lib/saspay.js';

// Affichage uniquement : le navigateur ne peut jamais choisir le montant.
export function GET() {
  const usd = prixAbonnement('USD');
  const cdf = prixAbonnement('CDF');
  return json({ USD: usd ? usd.prix : null, CDF: cdf ? cdf.prix : null, duree_jours: dureeJours() });
}
