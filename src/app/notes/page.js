// src/app/notes/page.js
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const KEY = 'campuskin_notes'; // même clé que le dashboard : { matière: texte }
const MAX = 2500;
const SUGGESTIONS = ['Mathématiques', 'Informatique', 'Anglais', 'Droit', 'Économie', 'Physique'];

/* ---------- Stockage local ---------- */
function readNotes() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      const obj = {};
      data.forEach((n) => n?.matiere && (obj[n.matiere] = String(n.texte || '').slice(0, MAX)));
      return obj;
    }
    const obj = {};
    Object.entries(data || {}).forEach(([k, v]) => (obj[k] = String(v || '').slice(0, MAX)));
    return obj;
  } catch {
    return {};
  }
}

/* ---------- Anneau du compteur ---------- */
function Ring({ count }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const ratio = Math.min(count / MAX, 1);
  const danger = ratio >= 0.9;
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" className="stroke-slate-200" strokeWidth="3.5" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - ratio)}
        className={`transition-all duration-300 ${danger ? 'stroke-red-500' : 'stroke-[#2563EB]'}`}
      />
    </svg>
  );
}

export default function NotesPage() {
  const [notes, setNotes] = useState({});
  const [active, setActive] = useState('');
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const [adding, setAdding] = useState(false);
  const [newSub, setNewSub] = useState('');
  const [toast, setToast] = useState('');
  const lastEdited = useRef('');

  /* Chargement */
  useEffect(() => {
    const data = readNotes();
    setNotes(data);
    const first = Object.keys(data)[0] || '';
    setActive(first);
    lastEdited.current = first;
    setAdding(Object.keys(data).length === 0);
    setReady(true);
  }, []);

  /* Sauvegarde automatique (la matière modifiée passe en premier : elle apparaît sur le dashboard) */
  useEffect(() => {
    if (!ready) return;
    setStatus('saving');
    const t = setTimeout(() => {
      try {
        const last = lastEdited.current;
        const ordered = {};
        if (last && last in notes) ordered[last] = notes[last];
        Object.keys(notes).forEach((k) => {
          if (k !== last) ordered[k] = notes[k];
        });
        localStorage.setItem(KEY, JSON.stringify(ordered));
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [notes, ready]);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  /* Actions */
  const subjects = Object.keys(notes);
  const text = notes[active] || '';
  const count = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const left = MAX - count;
  const danger = count >= MAX * 0.9;

  const edit = (e) => {
    const v = e.target.value.slice(0, MAX);
    lastEdited.current = active;
    setNotes((p) => ({ ...p, [active]: v }));
  };

  const addSubject = (name) => {
    const n = name.trim().slice(0, 30);
    if (!n) return;
    const exists = subjects.find((s) => s.toLowerCase() === n.toLowerCase());
    if (exists) {
      setActive(exists);
    } else {
      setNotes((p) => ({ ...p, [n]: '' }));
      setActive(n);
      lastEdited.current = n;
    }
    setNewSub('');
    setAdding(false);
  };

  const removeSubject = () => {
    if (!active) return;
    if (!window.confirm(`Supprimer « ${active} » et son résumé ?`)) return;
    const next = { ...notes };
    delete next[active];
    setNotes(next);
    const rest = Object.keys(next);
    setActive(rest[0] || '');
    lastEdited.current = rest[0] || '';
    if (rest.length === 0) setAdding(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      flash('Résumé copié.');
    } catch {
      flash('Copie impossible sur ce navigateur.');
    }
  };

  const statusLabel = useMemo(() => {
    if (status === 'saving') return 'Enregistrement…';
    if (status === 'saved') return 'Enregistré sur ce téléphone';
    if (status === 'error') return 'Stockage plein : non enregistré';
    return '';
  }, [status]);

  const suggestions = SUGGESTIONS.filter((s) => !subjects.some((x) => x.toLowerCase() === s.toLowerCase()));

  return (
    <main className="min-h-screen bg-slate-50 pb-36">
      <style>{`
        @keyframes nUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes nToast{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
        .n-in{animation:nUp .5s cubic-bezier(.2,.7,.2,1) both}
      `}</style>

      {/* En-tête */}
      <header className="relative overflow-hidden bg-[#0F172A] px-5 pb-16 pt-[max(env(safe-area-inset-top),2rem)] text-white">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#2563EB]/40 blur-[90px]" />
        <div className="relative mx-auto max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/60">Résumés de cours</p>
          <h1 className="mt-3 text-3xl font-light uppercase tracking-tight sm:text-4xl">
            Tes <span className="font-semibold text-[#60a5fa]">notes.</span>
          </h1>
          <p className="mt-3 text-xs uppercase tracking-wide text-white/60">
            {subjects.length} matière{subjects.length > 1 ? 's' : ''} · fonctionne sans internet
          </p>
        </div>
      </header>

      <div className="relative z-10 mx-auto -mt-8 max-w-3xl space-y-4 px-4 sm:px-5">
        {/* Matières */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-[0_20px_50px_-20px_rgba(15,23,42,.35)] ring-1 ring-slate-200">
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => {
                setActive(s);
                setAdding(false);
              }}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition active:scale-95 ${
                s === active && !adding ? 'bg-[#0F172A] text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {s}
              {notes[s] ? <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#2563EB]" /> : null}
            </button>
          ))}
          <button
            onClick={() => setAdding(true)}
            className={`shrink-0 rounded-xl border border-dashed px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition active:scale-95 ${
              adding ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB]' : 'border-slate-300 text-slate-400 hover:text-[#2563EB]'
            }`}
          >
            + Matière
          </button>
        </div>

        {/* Ajout d'une matière */}
        {adding && (
          <div key="add" className="ck-card n-in">
            <h2 className="ck-title">Nouvelle matière</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addSubject(newSub);
              }}
              className="mt-3 flex gap-2"
            >
              <input
                autoFocus
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                maxLength={30}
                placeholder="Ex : Algorithmique"
                className="ck-input"
              />
              <button className="ck-btn !px-5">Ajouter</button>
            </form>
            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => addSubject(s)}
                    className="rounded-full bg-[#2563EB]/10 px-3 py-1.5 text-xs font-semibold text-[#2563EB] transition hover:bg-[#2563EB] hover:text-white active:scale-95"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Éditeur */}
        {!adding && active && (
          <div key={active} className="ck-card n-in">
            <div className="flex items-center justify-between gap-3">
              <h2 className="truncate text-lg font-semibold uppercase tracking-tight">{active}</h2>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={copy}
                  disabled={!text}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#2563EB] transition hover:bg-[#2563EB]/10 disabled:opacity-30"
                >
                  Copier
                </button>
                <button
                  onClick={removeSubject}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  Supprimer
                </button>
              </div>
            </div>

            <textarea
              value={text}
              onChange={edit}
              maxLength={MAX}
              rows={12}
              placeholder="Écris ton résumé ici : définitions, formules, points clés du cours…"
              className="mt-4 min-h-[16rem] w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 leading-relaxed outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
            />

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Ring count={count} />
                  <span
                    className={`absolute inset-0 flex items-center justify-center text-[9px] font-semibold ${
                      danger ? 'text-red-500' : 'text-slate-500'
                    }`}
                  >
                    {Math.round((count / MAX) * 100)}%
                  </span>
                </div>
                <div>
                  <div className={`text-sm font-semibold tabular-nums ${danger ? 'text-red-600' : 'text-[#0F172A]'}`}>
                    {count.toLocaleString('fr-FR')} / {MAX.toLocaleString('fr-FR')}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {left === 0 ? 'Limite atteinte' : `${left.toLocaleString('fr-FR')} restants`} · {words} mot
                    {words > 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              <span
                role="status"
                className={`text-right text-[11px] ${status === 'error' ? 'font-semibold text-red-600' : 'text-slate-400'}`}
              >
                {status === 'saved' && <span className="mr-1 text-emerald-500">✓</span>}
                {statusLabel}
              </span>
            </div>
          </div>
        )}

        {/* Aucun contenu */}
        {!adding && !active && ready && (
          <div className="ck-card n-in text-center">
            <p className="text-sm text-slate-500">Aucune matière pour le moment.</p>
            <button onClick={() => setAdding(true)} className="ck-btn mt-4">
              Ajouter ma première matière
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div
          role="status"
          style={{ animation: 'nToast .3s ease-out both' }}
          className="fixed bottom-28 left-1/2 z-[130] -translate-x-1/2 rounded-xl bg-[#0F172A] px-5 py-3 text-sm font-medium text-white shadow-2xl"
        >
          {toast}
        </div>
      )}
    </main>
  );
}
