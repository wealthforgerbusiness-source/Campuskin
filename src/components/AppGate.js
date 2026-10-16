// src/components/AppGate.js
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import Welcome from './Welcome';
import LogoutButton from './LogoutButton';

function Splash() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]">
      <span className="text-xs uppercase tracking-[0.4em] text-white/60 animate-pulse">CampusKin</span>
    </div>
  );
}

export default function AppGate({ children, nav }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState({ ready: false, seen: false, session: null });

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem('ck_welcome_seen') === '1';
    } catch {}

    // Sans clés Supabase : l'app reste utilisable en mode local
    if (!supabase) {
      setState({ ready: true, seen: true, session: { local: true } });
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setState({ ready: true, seen, session: data.session });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setState((s) => ({ ...s, session }));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Service worker (mode hors ligne), uniquement en production
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const { ready, seen, session } = state;
  const onLoginPage = pathname.startsWith('/login');

  // Redirection vers /login si non connecté (après la bienvenue)
  useEffect(() => {
    if (ready && seen && !session && !onLoginPage) router.replace('/login');
  }, [ready, seen, session, onLoginPage, router]);

  // Déjà connecté et sur /login → accueil
  useEffect(() => {
    if (ready && session && onLoginPage) router.replace('/');
  }, [ready, session, onLoginPage, router]);

  const finishWelcome = (mode) => {
    try {
      localStorage.setItem('ck_welcome_seen', '1');
    } catch {}
    setState((s) => ({ ...s, seen: true }));
    router.push(mode === 'signup' ? '/login?mode=signup' : '/login');
  };

  if (!ready) return <Splash />;

  if (!seen && !session) {
    return <Welcome onSignup={() => finishWelcome('signup')} onLogin={() => finishWelcome('login')} />;
  }

  if (onLoginPage) return <>{children}</>;
  if (!session) return <Splash />;

  return (
    <>
      {children}
      {session && !session.local && <LogoutButton />}
      {nav}
    </>
  );
}
