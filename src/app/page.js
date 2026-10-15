// src/app/page.js
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as sb from '../lib/supabase';

const supabase = sb.supabase || sb.default;

/* ---------- Hooks utilitaires ---------- */

function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, delay = 0, className = '' }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
    >
      {children}
    </div>
  );
}

function Typewriter({ words }) {
  const [i, setI] = useState(0);
  const [txt, setTxt] = useState('');
  const [del, setDel] = useState(false);
  useEffect(() => {
    const w = words[i % words.length];
    const t = setTimeout(
      () => {
        if (!del) {
          setTxt(w.slice(0, txt.length + 1));
          if (txt.length + 1 === w.length) setTimeout(() => setDel(true), 1400);
        } else {
          setTxt(w.slice(0, txt.length - 1));
          if (txt.length - 1 === 0) {
            setDel(false);
            setI((v) => v + 1);
          }
        }
      },
      del ? 40 : 85
    );
    return () => clearTimeout(t);
  }, [txt, del, i, words]);
  return (
    <span className="text-[#2563EB]">
      {txt}
      <span className="ml-1 inline-block w-[3px] h-[0.9em] align-middle bg-[#2563EB] animate-caret" />
    </span>
  );
}

function CountUp({ value, decimals = 0, duration = 900 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const from = 0;
    const tick = (t) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

/* Carte avec effet tilt 3D au toucher / survol */
function TiltCard({ children, className = '' }) {
  const ref = useRef(null);
  const move = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 8;
    const y = ((e.clientY - r.top) / r.height - 0.5) * -8;
    el.style.transform = `perspective(900px) rotateX(${y}deg) rotateY(${x}deg) translateY(-2px)`;
  };
  const leave = () => {
    if (ref.current) ref.current.style.transform = '';
  };
  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={leave}
      onPointerUp={leave}
      className={`transition-transform duration-200 will-change-transform ${className}`}
    >
      {children}
    </div>
  );
}

/* ---------- Page ---------- */

const fmt = (n, d = 0) =>
  Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

export default function Dashboard() {
  /* Convertisseur */
  const [rate, setRate] = useState(2800);
  const [amount, setAmount] = useState('100');
  const [dir, setDir] = useState('USD'); // devise saisie

  /* Budget */
  const [budget, setBudget] = useState(200); // en USD
  const [expenses, setExpenses] = useState([]);
  const [label, setLabel] = useState('');
  const [exp, setExp] = useState('');
  const [expCur, setExpCur] = useState('USD');

  /* Données */
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [notes, setNotes] = useState([]);
  const [ready, setReady] = useState(false);

  /* Chargement local */
  useEffect(() => {
    try {
      const r = localStorage.getItem('ck_rate');
      const b = localStorage.getItem('ck_budget');
      const e = localStorage.getItem('ck_expenses');
      if (r) setRate(Number(r));
      if (b) setBudget(Number(b));
      if (e) setExpenses(JSON.parse(e));

      const raw = localStorage.getItem('campuskin_notes');
      if (raw) {
        const obj = JSON.parse(raw);
        const list = Array.isArray(obj)
          ? obj
          : Object.entries(obj).map(([matiere, texte]) => ({ matiere, texte }));
        setNotes(list.filter((n) => n.texte).slice(0, 3));
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem('ck_rate', String(rate));
      localStorage.setItem('ck_budget', String(budget));
      localStorage.setItem('ck_expenses', JSON.stringify(expenses));
    } catch {}
  }, [rate, budget, expenses, ready]);

  /* Alertes Supabase (table "annonces" : titre, contenu, urgent, created_at) */
  useEffect(() => {
    (async () => {
      try {
        if (!supabase) throw new Error('no client');
        const { data, error } = await supabase
          .from('annonces')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);
        if (error) throw error;
        setAlerts(data || []);
      } catch {
        setAlerts([]);
      } finally {
        setLoadingAlerts(false);
      }
    })();
  }, []);

  /* Calculs */
  const converted = useMemo(() => {
    const a = parseFloat(String(amount).replace(',', '.')) || 0;
    return dir === 'USD' ? a * rate : a / rate;
  }, [amount, rate, dir]);

  const spentUSD = useMemo(
    () => expenses.reduce((s, x) => s + (x.cur === 'USD' ? x.amount : x.amount / rate), 0),
    [expenses, rate]
  );
  const pct = Math.min((spentUSD / (budget || 1)) * 100, 100);
  const left = budget - spentUSD;
  const danger = pct >= 85;

  const addExpense = (e) => {
    e.preventDefault();
    const v = parseFloat(String(exp).replace(',', '.'));
    if (!label.trim() || !v || v <= 0) return;
    setExpenses((p) => [{ id: Date.now(), label: label.trim(), amount: v, cur: expCur }, ...p].slice(0, 30));
    setLabel('');
    setExp('');
  };

  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <main className="relative min-h-screen bg-white text-[#0F172A] pb-32 overflow-x-hidden">
      {/* Animations intégrées */}
      <style>{`
        @keyframes caret { 0%,50%{opacity:1} 51%,100%{opacity:0} }
        @keyframes floaty { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        @keyframes pulseRing { 0%{box-shadow:0 0 0 0 rgba(37,99,235,.45)} 100%{box-shadow:0 0 0 14px rgba(37,99,235,0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gradientMove { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        .animate-caret{animation:caret 1s steps(1) infinite}
        .animate-floaty{animation:floaty 7s ease-in-out infinite}
        .animate-ring{animation:pulseRing 1.8s ease-out infinite}
        .hero-line{opacity:0;animation:slideUp .9s cubic-bezier(.2,.7,.2,1) forwards}
        .text-shine{background:linear-gradient(90deg,#fff,#93c5fd,#fff,#93c5fd);background-size:200% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:gradientMove 6s linear infinite}
        .skeleton{background:linear-gradient(90deg,#eef2ff 25%,#dbe5ff 50%,#eef2ff 75%);background-size:800px 100%;animation:shimmer 1.4s infinite linear}
        .glass{background:rgba(255,255,255,.08);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.14)}
        .btn-press{transition:transform .15s ease, box-shadow .2s ease}
        .btn-press:active{transform:scale(.96)}
        input,select{font-size:16px}
        @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
      `}</style>

      {/* ============ HERO ============ */}
      <section className="relative isolate overflow-hidden bg-[#0F172A] text-white">
        {/* Décor */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-32 -right-24 h-[420px] w-[420px] rounded-full bg-[#2563EB]/40 blur-[110px] animate-floaty" />
          <div
            className="absolute bottom-[-140px] -left-20 h-[360px] w-[360px] rounded-full bg-[#1d4ed8]/30 blur-[100px] animate-floaty"
            style={{ animationDelay: '-3s' }}
          />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0F172A]/40 to-[#0F172A]" />
        </div>

        <div className="mx-auto max-w-5xl px-5 pt-14 pb-24 sm:pt-20 sm:pb-28">
          <p
            className="hero-line text-[11px] sm:text-xs tracking-[0.35em] uppercase text-white/60"
            style={{ animationDelay: '0.1s' }}
          >
            CampusKin · Kinshasa
          </p>

          <h1
            className="hero-line mt-4 text-[2.4rem] leading-[1.05] sm:text-6xl font-light uppercase tracking-tight"
            style={{ animationDelay: '0.3s' }}
          >
            {hello}, <span className="text-shine font-semibold">étudiant.</span>
            <br />
            Ta promo, <Typewriter words={['tes notes.', 'ton budget.', 'tes groupes.', 'ta réussite.']} />
          </h1>

          <p
            className="hero-line mt-6 max-w-xl text-sm sm:text-base uppercase tracking-wide text-white/75"
            style={{ animationDelay: '0.55s' }}
          >
            Tout ton quotidien universitaire au même endroit, simple, rapide et utilisable même hors-ligne.
          </p>

          <div className="hero-line mt-9 flex flex-wrap gap-3" style={{ animationDelay: '0.8s' }}>
            <a
              href="/notes"
              className="btn-press border border-white/80 px-6 py-3 text-sm font-medium tracking-wide hover:bg-white hover:text-[#0F172A] transition-colors"
            >
              Mes notes
            </a>
            <a
              href="/groupes"
              className="btn-press bg-[#2563EB] px-6 py-3 text-sm font-medium tracking-wide shadow-[0_10px_30px_-8px_rgba(37,99,235,.8)] hover:bg-[#1d4ed8] transition-colors"
            >
              Ma promotion
            </a>
          </div>

          {/* Chiffres clés */}
          <div className="hero-line mt-12 grid grid-cols-3 gap-3 max-w-lg" style={{ animationDelay: '1s' }}>
            {[
              { k: 'Taux', v: <CountUp value={rate} /> , s: 'CDF / USD' },
              { k: 'Budget', v: <CountUp value={Math.max(left, 0)} decimals={0} />, s: 'USD restants' },
              { k: 'Notes', v: <CountUp value={notes.length} />, s: 'récentes' },
            ].map((c) => (
              <div key={c.k} className="glass rounded-xl px-3 py-3">
                <div className="text-[10px] uppercase tracking-widest text-white/50">{c.k}</div>
                <div className="mt-1 text-xl sm:text-2xl font-semibold">{c.v}</div>
                <div className="text-[10px] text-white/50">{c.s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CONTENU ============ */}
      <section className="relative z-10 mx-auto -mt-10 max-w-5xl px-4 sm:px-5 space-y-6">
        {/* Alertes prioritaires */}
        <Reveal>
          <div className="rounded-2xl bg-white p-5 shadow-[0_20px_50px_-20px_rgba(15,23,42,.35)] ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#2563EB] animate-ring" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
                </span>
                Alertes de la promotion
              </h2>
              <a href="/groupes" className="text-xs font-medium text-[#2563EB] hover:underline">
                Tout voir →
              </a>
            </div>

            <div className="mt-4 space-y-3">
              {loadingAlerts &&
                [0, 1].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}

              {!loadingAlerts && alerts.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                  Aucune annonce pour le moment. Le délégué n'a rien publié.
                </div>
              )}

              {alerts.map((a, i) => (
                <TiltCard key={a.id ?? i}>
                  <div
                    className="rounded-xl border-l-4 border-[#2563EB] bg-[#2563EB]/5 p-4"
                    style={{ animation: `slideUp .6s ${i * 0.1}s both` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold leading-snug">{a.titre || 'Annonce'}</h3>
                      {a.urgent && (
                        <span className="shrink-0 rounded-full bg-[#0F172A] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Urgent
                        </span>
                      )}
                    </div>
                    {a.contenu && <p className="mt-1 text-sm text-slate-600 line-clamp-2">{a.contenu}</p>}
                    {a.created_at && (
                      <p className="mt-2 text-[11px] uppercase tracking-wider text-slate-400">
                        {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                      </p>
                    )}
                  </div>
                </TiltCard>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Convertisseur */}
          <Reveal delay={80}>
            <TiltCard className="h-full">
              <div className="h-full rounded-2xl bg-[#0F172A] p-5 text-white shadow-xl">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70">
                  Convertisseur CDF ⇄ USD
                </h2>

                <div className="mt-4 flex gap-2">
                  <input
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-lg font-semibold outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40"
                    placeholder="Montant"
                  />
                  <button
                    onClick={() => setDir((d) => (d === 'USD' ? 'CDF' : 'USD'))}
                    className="btn-press rounded-xl bg-[#2563EB] px-4 text-sm font-semibold hover:bg-[#1d4ed8]"
                    aria-label="Inverser"
                  >
                    {dir} ⇄
                  </button>
                </div>

                <div className="mt-5 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
                  <div className="text-[11px] uppercase tracking-widest text-white/50">
                    Équivaut à
                  </div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight">
                    <CountUp
                      key={`${dir}-${amount}-${rate}`}
                      value={converted}
                      decimals={dir === 'USD' ? 0 : 2}
                      duration={500}
                    />{' '}
                    <span className="text-lg text-[#60a5fa]">{dir === 'USD' ? 'CDF' : 'USD'}</span>
                  </div>
                </div>

                <label className="mt-4 block text-[11px] uppercase tracking-widest text-white/50">
                  Taux du jour (1 USD = … CDF)
                  <input
                    inputMode="numeric"
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value.replace(/\D/g, '')) || 0)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-base normal-case tracking-normal outline-none focus:border-[#2563EB]"
                  />
                </label>
              </div>
            </TiltCard>
          </Reveal>

          {/* Budget */}
          <Reveal delay={160}>
            <TiltCard className="h-full">
              <div className="h-full rounded-2xl bg-white p-5 shadow-[0_20px_50px_-20px_rgba(15,23,42,.35)] ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-widest">Suivi du budget</h2>
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    Budget $
                    <input
                      inputMode="numeric"
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value.replace(/\D/g, '')) || 0)}
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right font-semibold text-[#0F172A] outline-none focus:border-[#2563EB]"
                    />
                  </label>
                </div>

                <div className="mt-4">
                  <div className="flex items-end justify-between">
                    <div className="text-3xl font-semibold tracking-tight">
                      <CountUp value={Math.max(left, 0)} decimals={2} duration={600} />{' '}
                      <span className="text-base text-slate-400">$ restants</span>
                    </div>
                    <div className={`text-sm font-semibold ${danger ? 'text-red-600' : 'text-[#2563EB]'}`}>
                      {fmt(pct)}%
                    </div>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        danger ? 'bg-red-500' : 'bg-gradient-to-r from-[#2563EB] to-[#60a5fa]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Dépensé : {fmt(spentUSD, 2)} $ ≈ {fmt(spentUSD * rate)} CDF
                  </p>
                </div>

                <form onSubmit={addExpense} className="mt-4 flex flex-wrap gap-2">
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Dépense (ex : transport)"
                    className="min-w-0 flex-1 basis-32 rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                  <input
                    inputMode="decimal"
                    value={exp}
                    onChange={(e) => setExp(e.target.value)}
                    placeholder="0"
                    className="w-20 rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                  <select
                    value={expCur}
                    onChange={(e) => setExpCur(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-2 py-2.5 outline-none focus:border-[#2563EB]"
                  >
                    <option>USD</option>
                    <option>CDF</option>
                  </select>
                  <button className="btn-press rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] transition-colors">
                    Ajouter
                  </button>
                </form>

                <ul className="mt-4 max-h-40 space-y-2 overflow-auto pr-1">
                  {expenses.length === 0 && (
                    <li className="text-sm text-slate-400">Aucune dépense enregistrée.</li>
                  )}
                  {expenses.slice(0, 6).map((x) => (
                    <li
                      key={x.id}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                      style={{ animation: 'slideUp .4s both' }}
                    >
                      <span className="truncate">{x.label}</span>
                      <span className="ml-3 flex items-center gap-3 font-semibold">
                        {fmt(x.amount, x.cur === 'USD' ? 2 : 0)} {x.cur}
                        <button
                          onClick={() => setExpenses((p) => p.filter((e) => e.id !== x.id))}
                          className="text-slate-300 hover:text-red-500"
                          aria-label="Supprimer"
                        >
                          ✕
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </TiltCard>
          </Reveal>
        </div>

        {/* Notes récentes */}
        <Reveal delay={120}>
          <div className="rounded-2xl bg-white p-5 shadow-[0_20px_50px_-20px_rgba(15,23,42,.35)] ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Notes récentes</h2>
              <a href="/notes" className="text-xs font-medium text-[#2563EB] hover:underline">
                Ouvrir →
              </a>
            </div>

            {notes.length === 0 ? (
              <a
                href="/notes"
                className="btn-press mt-4 block rounded-xl border border-dashed border-[#2563EB]/40 bg-[#2563EB]/5 p-6 text-center text-sm font-medium text-[#2563EB] hover:bg-[#2563EB]/10"
              >
                + Rédige ton premier résumé de cours
              </a>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {notes.map((n, i) => (
                  <TiltCard key={i}>
                    <a
                      href="/notes"
                      className="block h-full rounded-xl bg-gradient-to-br from-[#0F172A] to-[#1e3a8a] p-4 text-white"
                    >
                      <div className="text-[10px] uppercase tracking-widest text-[#93c5fd]">
                        {n.matiere || 'Matière'}
                      </div>
                      <p className="mt-2 text-sm text-white/80 line-clamp-4">{n.texte}</p>
                    </a>
                  </TiltCard>
                ))}
              </div>
            )}
          </div>
        </Reveal>

        {/* Accès rapide */}
        <Reveal>
          <div className="grid grid-cols-3 gap-3">
            {[
              { t: 'Notes', h: '/notes', i: '✎' },
              { t: 'Groupes', h: '/groupes', i: '◎' },
              { t: 'Admin', h: '/admin', i: '⚙' },
            ].map((q) => (
              <a
                key={q.t}
                href={q.h}
                className="btn-press group flex flex-col items-center gap-1 rounded-2xl bg-white py-4 text-sm font-semibold ring-1 ring-slate-200 transition hover:-translate-y-1 hover:bg-[#2563EB] hover:text-white hover:shadow-lg"
              >
                <span className="text-2xl text-[#2563EB] transition group-hover:text-white">{q.i}</span>
                {q.t}
              </a>
            ))}
          </div>
        </Reveal>
      </section>
    </main>
  );
}
