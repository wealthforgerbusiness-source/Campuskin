// SERVEUR UNIQUEMENT : clé service_role, ne jamais l'exposer au navigateur.
import { createClient } from '@supabase/supabase-js';

let client = null;

export function getAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('config_supabase_admin');
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
