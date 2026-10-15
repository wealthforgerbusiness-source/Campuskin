// src/app/login/page.js
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

function LoginForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState('login'); // login | signup
  const [nom, setNom] = useState('');
  const [promotion, setPromotion] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (params.get('mode') === 'signup') setMode('signup');
  }, [params]);

  const translate = (msg = '') => {
    const m = msg.toLowerCase();
    if (m.includes('invalid login')) return 'Email ou mot de passe incorrect.';
    if (m.includes('already registered')) return 'Cet email a déjà un compte. Connecte-toi.';
    if (m.includes('password should be')) return 'Le mot de passe doit avoir au moins 6 caractères.';
    if (m.includes('email not confirmed')) return "Confirme d'abord ton email (regarde ta boîte de réception).";
    if (m.includes('rate limit')) return 'Trop de tentatives. Réessaie dans quelques minutes.';
    if (m.includes('fetch') || m.includes('network')) return 'Pas de connexion internet.';
    return msg || 'Une erreur est survenue.';
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!supabase) return setError('Configuration Supabase manquante.');

    if (mode === 'signup') {
      if (nom.trim().length < 2) return setError('Entre ton nom complet.');
      if (!promotion.trim()) return setError('Entre ta promotion (ex : L1 Informatique).');
    }
    if (password.length < 6) return setError('Le mot de passe doit avoir au moins 6 caractères.');

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { nom: nom.trim(), promotion: promotion.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo('Compte créé ! Confirme ton email avec le lien reçu, puis connecte-toi.');
          setMode('login');
        }
        // Si une session existe, AppGate redirige automatiquement vers l'accueil
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (err) {
      setError(translate(err.message));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) return setError("Entre ton email d'abord.");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) return setError(translate(error.message));
    setInfo('Email de réinitialisation envoyé.');
  };

  const signup = mode === 'signup';

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0F172A] px-5 pb-10 pt-[max(env(safe-area-inset-top),2.5rem)] text-white">
      <style>{`
        @keyframes lFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        @keyframes lUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-32 -right-24 h-[400px] w-[400px] rounded-full bg-[#2563EB]/40 blur-[110px]"
          style={{ animation: 'lFloat 7s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-[-120px] -left-20 h-[340px] w-[340px] rounded-full bg-[#1d4ed8]/30 blur-[100px]"
          style={{ animation: 'lFloat 7s ease-in-out infinite', animationDelay: '-3s' }}
        />
      </div>

      <div className="relative mx-auto max-w-md" style={{ animation: 'lUp .7s cubic-bezier(.2,.7,.2,1) both' }}>
        <p className="text-[11px] uppercase tracking-[0.35em] text-white/60">CampusKin · Kinshasa</p>
        <h1 className="mt-4 text-4xl font-light uppercase leading-[1.05] tracking-tight">
          {signup ? (
            <>
              Rejoins ta <span className="font-semibold text-[#60a5fa]">promotion.</span>
            </>
          ) : (
            <>
              Content de te <span className="font-semibold text-[#60a5fa]">revoir.</span>
            </>
          )}
        </h1>

        {/* Onglets */}
        <div className="mt-8 grid grid-cols-2 rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
          {[
            ['login', 'Connexion'],
            ['signup', 'Inscription'],
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setMode(k);
                setError('');
                setInfo('');
              }}
              className={`rounded-lg py-2.5 text-xs font-semibold uppercase tracking-widest transition ${
                mode === k ? 'bg-[#2563EB] text-white shadow-lg' : 'text-white/60'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {signup && (
            <>
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Nom complet"
                autoComplete="name"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none transition placeholder:text-white/40 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40"
              />
              <input
                value={promotion}
                onChange={(e) => setPromotion(e.target.value)}
                placeholder="Promotion (ex : L1 Informatique)"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none transition placeholder:text-white/40 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40"
              />
            </>
          )}
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Adresse email"
            autoComplete="email"
            required
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none transition placeholder:text-white/40 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40"
          />
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe (6 caractères min.)"
              autoComplete={signup ? 'new-password' : 'current-password'}
              required
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 pr-20 outline-none transition placeholder:text-white/40 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-widest text-white/60"
            >
              {show ? 'Cacher' : 'Voir'}
            </button>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
          {info && (
            <div role="status" className="rounded-xl border border-[#60a5fa]/40 bg-[#2563EB]/15 px-4 py-3 text-sm text-blue-100">
              {info}
            </div>
          )}

          <button disabled={loading} className="ck-btn w-full !py-3.5">
            {loading ? 'Un instant…' : signup ? 'Créer mon compte' : 'Me connecter'}
          </button>

          {!signup && (
            <button
              type="button"
              onClick={resetPassword}
              className="w-full pt-1 text-center text-xs uppercase tracking-widest text-white/50 hover:text-white"
            >
              Mot de passe oublié ?
            </button>
          )}
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
