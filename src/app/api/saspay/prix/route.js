import { NextResponse } from 'next/server';
import { prixAbonnement, dureeJours } from '../../../../lib/saspay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Affichage uniquement : le montant réellement facturé est toujours recalculé côté serveur dans /initier.
export async function GET() {
  const usd = prixAbonnement('USD');
  const cdf = prixAbonnement('CDF');
  return NextResponse.json(
    {
      USD: usd ? usd.prix : null,
      CDF: cdf ? cdf.prix : null,
      duree_jours: dureeJours(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
