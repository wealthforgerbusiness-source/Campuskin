// src/components/Welcome.js
'use client';

import { useRef, useState } from 'react';

const SLIDES = [
  {
    title: 'Tes notes, toujours avec toi',
    text: 'Rédige tes résumés de cours par matière. Ils restent disponibles même sans internet.',
    icon: (
      <>
        <path d="M5 4h10l4 4v12H5z" />
        <path d="M14 4v5h5M8.5 13h7M8.5 16.5h5" />
      </>
    ),
  },
  {
    title: 'Ton budget en CDF et en USD',
    text: 'Convertis en un geste et suis tes dépenses du mois sans te perdre dans les calculs.',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v10M14.5 9.5c-.5-.9-1.4-1.3-2.5-1.3-1.5 0-2.5.8-2.5 1.9 0 2.7 5 1.2 5 3.9 0 1.1-1 1.9-2.5 1.9-1.1 0-2-.4-2.6-1.3" />
      </>
    ),
  },
  {
    title: 'Ta promotion connectée',
    text: 'Annonces officielles du délégué, sondages, dates limites des TP et questions, au même endroit.',
    icon: (
      <>
        <circle cx="9" cy="9" r="3" />
        <circle cx="17" cy="10" r="2.4" />
        <path d="M3.5 19c.5-3 2.7-4.8 5.5-4.8s5 1.8 5.5 4.8M15 14.6c2.6-.3 4.8 1 5.5 3.9" />
      </>
    ),
  },
];

export default function Welcome({ onSignup, onLogin }) {
  const [i, setI] = useState(0);
  const startX = useRef(null);
  const last = i === SLIDES.length - 1;

  const next = () => setI((v) => Math.min(v + 1, SLIDES.length - 1));
  const prev = () => setI((v) => Math.max(v - 1, 0));

  const onTouchEnd = (e) => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (dx < -50) next();
    if (dx > 50) prev();
    startX.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#0F172A] text-white"
      onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
      onTouchEnd={onTouchEnd}
    >
      <style>{`
        @keyframes wFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}
        @keyframes wIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        .w-in{animation:wIn .6s cubic-bezier(.2,.7,.2,1) both}
      `}</style>

      {/* Décor */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-32 -right-24 h-[420px] w-[420px] rounded-full bg-[#2563EB]/40 blur-[110px]"
          style={{ animation: 'wFloat 7s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-[-140px] -left-20 h-[360px] w-[360px] rounded-full bg-[#1d4ed8]/30 blur-[100px]"
          style={{ animation: 'wFloat 7s ease-in-out infinite', animationDelay: '-3s' }}
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
      </div>

      {/* Haut */}
      <div className="relative flex items-center justify-between px-6 pt-[max(env(safe-area-inset-top),1.5rem)]">
        <span className="text-[11px] uppercase tracking-[0.35em] text-white/60">CampusKin · Kinshasa</span>
        {!last && (
          <button onClick={() => setI(SLIDES.length - 1)} className="text-xs uppercase tracking-widest text-white/60">
            Passer
          </button>
        )}
      </div>

      {/* Slide */}
      <div className="relative flex flex-1 flex-col justify-center px-7">
        <div key={i} className="w-in">
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#2563EB] shadow-[0_20px_50px_-10px_rgba(37,99,235,.9)]">
            <svg
              viewBox="0 0 24 24"
              className="h-10 w-10 fill-none stroke-white stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]"
            >
              {SLIDES[i].icon}
            </svg>
          </div>
          <h1 className="text-4xl font-light uppercase leading-[1.1] tracking-tight sm:text-5xl">
            {SLIDES[i].title}
          </h1>
          <p className="mt-5 max-w-md text-sm uppercase tracking-wide text-white/70">{SLIDES[i].text}</p>
        </div>
      </div>

      {/* Bas */}
      <div className="relative px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="mb-6 flex gap-2">
          {SLIDES.map((_, k) => (
            <button
              key={k}
              aria-label={`Slide ${k + 1}`}
              onClick={() => setI(k)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                k === i ? 'w-8 bg-[#2563EB]' : 'w-1.5 bg-white/30'
              }`}
            />
          ))}
        </div>

        {last ? (
          <div className="w-in space-y-3">
            <button onClick={onSignup} className="ck-btn w-full">
              Créer mon compte
            </button>
            <button
              onClick={onLogin}
              className="w-full rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold transition hover:bg-white hover:text-[#0F172A] active:scale-95"
            >
              J'ai déjà un compte
            </button>
          </div>
        ) : (
          <button onClick={next} className="ck-btn w-full">
            Suivant
          </button>
        )}
      </div>
    </div>
  );
}
