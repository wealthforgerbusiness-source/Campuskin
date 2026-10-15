// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    '[CampusKin] Variables Supabase manquantes : vérifie .env.local (ou les variables Netlify).'
  );
}

// Si les clés manquent, on exporte null au lieu de faire planter toute l'application.
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

export default supabase;
