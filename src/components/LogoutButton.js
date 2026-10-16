// src/components/LogoutButton.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { purgerDonneesLocales } from '../lib/session';

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const sortir = async () => {
    if (busy) return;
    if (!window.confirm('Te déconnecter ?')) return;
    // Les notes et le budget ne sont stockés que sur ce téléphone : on demande avant d'effacer.
    const effacer = window.confirm(
      'Effacer aussi les notes, le budget et les dépenses enregistrés sur ce téléphone ?\n\nIls ne sont pas sauvegardés en ligne.\nOK = effacer (téléphone partagé) · Annuler = garder'
    );
    setBusy(true);
    try {
      if (supabase) await supabase.auth.signOut();
    } catch {}
    if (effacer) purgerDonneesLocales();
    router.replace('/login');
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={sortir}
      disabled={busy}
      aria-label="Se déconnecter"
      title="Se déconnecter"
      className="fixed right-3 z-[60] flex h-10 w-10 items-center justify-center rounded-full bg-[#0F172A]/90 text-white/80 ring-1 ring-white/10 backdrop-blur transition active:scale-90 disabled:opacity-50"
      style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 0.75rem) + 5.25rem)' }}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]">
        <path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9M15 8l4 4-4 4M19 12H9" />
      </svg>
    </button>
  );
}
