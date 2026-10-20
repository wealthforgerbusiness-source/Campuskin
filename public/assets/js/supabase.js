import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export async function sessionCourante() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function profilCourant() {
  const session = await sessionCourante();
  if (!session) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, nom, email, promotion, role')
    .eq('id', session.user.id)
    .maybeSingle();
  return data || null;
}

export const destination = (role) => (role === 'admin' ? '/admin/' : '/app/');
