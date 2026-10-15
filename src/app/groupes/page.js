// src/app/groupes/page.js
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

const TABS = [
  { id: 'annonces', label: 'Annonces' },
  { id: 'sondages', label: 'Sondages' },
  { id: 'tp', label: 'TP' },
  { id: 'questions', label: 'Questions' },
];

const dateFr = (d) =>
  d
    ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

function timeLeft(d, now) {
  const ms = new Date(d).getTime() - now;
  const abs = Math.abs(ms);
  const j = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const txt = j > 0 ? `${j} j ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
  return { late: ms < 0, txt, soon: ms >= 0 && ms < 2 * 86400000 };
}

export default function GroupesPage() {
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('annonces');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [dbError, setDbError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const [annonces, setAnnonces] = useState([]);
  const [sondages, setSondages] = useState([]);
  const [myVotes, setMyVotes] = useState({}); // { sondage_id: option_index }
  const [results, setResults] = useState({}); // { sondage_id: [counts] }
  const [tps, setTps] = useState([]);
  const [questions, setQuestions] = useState([]);

  /* Formulaires */
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [spQ, setSpQ] = useState('');
  const [spOpts, setSpOpts] = useState('');
  const [tpMat, setTpMat] = useState('');
  const [tpTitre, setTpTitre] = useState('');
  const [tpDate, setTpDate] = useState('');

  const isStaff = me && ['delegue', 'admin'].includes(me.role);

  const notify = (text, type = 'ok') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* Horloge pour les comptes à rebours */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  /* Profil */
  useEffect(() => {
    (async () => {
      if (!supabase) return setLoading(false);
      const { data: u } = await supabase.auth.getUser();
      const user = u?.user;
      if (!user) return setLoading(false);
      const { data: prof } = await supabase.from('profiles').select('id, nom, role').eq('id', user.id).single();
      setMe(prof || { id: user.id, nom: user.user_metadata?.nom || 'Étudiant', role: 'etudiant' });
    })();
  }, []);

  /* Résultats des sondages */
  const loadResults = useCallback(async (list) => {
    const { data, error } = await supabase.rpc('resultats_sondages');
    if (error) return;
    const map = {};
    (list || []).forEach((s) => (map[s.id] = Array(s.options.length).fill(0)));
    (data || []).forEach((r) => {
      if (map[r.sondage_id] && r.option_index < map[r.sondage_id].length) {
        map[r.sondage_id][r.option_index] = Number(r.total);
      }
    });
    setResults(map);
  }, []);

  /* Chargement général */
  const load = useCallback(async () => {
    if (!supabase || !me) return;
    setDbError('');
    const [a, s, v, t, q] = await Promise.all([
      supabase.from('annonces').select('*').order('created_at', { ascending: false }),
      supabase.from('sondages').select('*').order('created_at', { ascending: false }),
      supabase.from('votes').select('sondage_id, option_index').eq('user_id', me.id),
      supabase.from('tp_deadlines').select('*').order('date_limite', { ascending: true }),
      supabase.from('questions').select('*').order('created_at', { ascending: false }),
    ]);
    const err = [a, s, v, t, q].find((r) => r.error);
    if (err) setDbError(`Erreur Supabase : ${err.error.message}. As-tu exécuté tout le SQL ?`);

    const polls = s.data || [];
    setAnnonces(a.data || []);
    setSondages(polls);
    const mv = {};
    (v.data || []).forEach((x) => (mv[x.sondage_id] = x.option_index));
    setMyVotes(mv);
    setTps(t.data || []);
    setQuestions(q.data || []);
    await loadResults(polls);
    setLoading(false);
  }, [me, loadResults]);

  useEffect(() => {
    if (me) load();
  }, [me, load]);

  /* Actualisation des sondages toutes les 10 s (quasi temps réel) */
  useEffect(() => {
    if (!me || tab !== 'sondages') return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') loadResults(sondages);
    }, 10000);
    return () => clearInterval(t);
  }, [me, tab, sondages, loadResults]);

  /* ---------- Sondages ---------- */
  const voter = async (s, idx) => {
    if (myVotes[s.id] !== undefined || !s.actif) return;
    const { error } = await supabase
      .from('votes')
      .insert({ sondage_id: s.id, user_id: me.id, option_index: idx });
    if (error) {
      if (error.code === '23505') {
        notify('Tu as déjà voté pour ce sondage.', 'err');
        load();
      } else notify(error.message, 'err');
      return;
    }
    setMyVotes((p) => ({ ...p, [s.id]: idx }));
    await loadResults(sondages);
    notify('Vote enregistré.');
  };

  const creerSondage = async (e) => {
    e.preventDefault();
    const opts = spOpts
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean)
      .slice(0, 5);
    if (spQ.trim().length < 5) return notify('Question trop courte.', 'err');
    if (opts.length < 2) return notify('Mets au moins 2 options (une par ligne).', 'err');
    setBusy(true);
    const { error } = await supabase
      .from('sondages')
      .insert({ question: spQ.trim(), options: opts, auteur: me.id });
    setBusy(false);
    if (error) return notify(error.message, 'err');
    setSpQ('');
    setSpOpts('');
    notify('Sondage publié.');
    load();
  };

  const fermerSondage = async (id) => {
    const { error } = await supabase.from('sondages').update({ actif: false }).eq('id', id);
    if (error) return notify(error.message, 'err');
    notify('Sondage clôturé.');
    load();
  };

  const supprimerSondage = async (id) => {
    if (!window.confirm('Supprimer ce sondage et tous ses votes ?')) return;
    const { error } = await supabase.from('sondages').delete().eq('id', id);
    if (error) return notify(error.message, 'err');
    load();
  };

  /* ---------- TP ---------- */
  const ajouterTp = async (e) => {
    e.preventDefault();
    if (!tpMat.trim() || !tpTitre.trim() || !tpDate) return notify('Remplis tous les champs.', 'err');
    setBusy(true);
    const { error } = await supabase.from('tp_deadlines').insert({
      matiere: tpMat.trim(),
      titre: tpTitre.trim(),
      date_limite: new Date(tpDate).toISOString(),
      auteur: me.id,
    });
    setBusy(false);
    if (error) return notify(error.message, 'err');
    setTpMat('');
    setTpTitre('');
    setTpDate('');
    notify('Date limite ajoutée.');
    load();
  };

  const supprimerTp = async (id) => {
    const { error } = await supabase.from('tp_deadlines').delete().eq('id', id);
    if (error) return notify(error.message, 'err');
    load();
  };

  /* ---------- Questions ---------- */
  const poserQuestion = async (e) => {
    e.preventDefault();
    const txt = question.trim();
    if (txt.length < 5) return notify('Ta question est trop courte.', 'err');
    setBusy(true);
    const { error } = await supabase
      .from('questions')
      .insert({ auteur: me.id, auteur_nom: me.nom || 'Étudiant', texte: txt });
    setBusy(false);
    if (error) return notify(error.message, 'err');
    setQuestion('');
    notify('Question envoyée au délégué.');
    load();
  };

  /* Badges */
  const sondagesAVoter = sondages.filter((s) => s.actif && myVotes[s.id] === undefined).length;
  const tpProches = useMemo(
    () => tps.filter((t) => timeLeft(t.date_limite, now).soon).length,
    [tps, now]
  );

  const Empty = ({ children }) => (
    <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
      {children}
    </p>
  );

  return (
    <main className="min-h-screen bg-slate-50 pb-36">
      <style>{`
        @keyframes gUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes gToast{from{opacity:0;transform:translate(-50%,-12px)}to{opacity:1;transform:translate(-50%,0)}}
        @keyframes gGrow{from{width:0}}
        .g-in{animation:gUp .5s cubic-bezier(.2,.7,.2,1) both}
        .g-bar{animation:gGrow .8s cubic-bezier(.2,.7,.2,1) both}
      `}</style>

      {/* En-tête */}
      <header className="relative overflow-hidden bg-[#0F172A] px-5 pb-16 pt-[max(env(safe-area-inset-top),2rem)] text-white">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#2563EB]/40 blur-[90px]" />
        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/60">Ma promotion</p>
            {isStaff && (
              <span className="rounded-full bg-[#2563EB] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest">
                {me.role}
              </span>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-light uppercase tracking-tight sm:text-4xl">
            Tes <span className="font-semibold text-[#60a5fa]">groupes.</span>
          </h1>
          <p className="mt-3 text-xs uppercase tracking-wide text-white/60">
            Annonces, sondages, TP et questions
          </p>
        </div>
      </header>

      <div className="relative z-10 mx-auto -mt-8 max-w-3xl px-4 sm:px-5">
        {/* Onglets */}
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-[0_20px_50px_-20px_rgba(15,23,42,.35)] ring-1 ring-slate-200">
          {TABS.map((t) => {
            const badge = t.id === 'sondages' ? sondagesAVoter : t.id === 'tp' ? tpProches : 0;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex-1 shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-widest transition active:scale-95 ${
                  tab === t.id ? 'bg-[#0F172A] text-white' : 'text-slate-500 hover:text-[#0F172A]'
                }`}
              >
                {t.label}
                {badge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2563EB] px-1 text-[9px] text-white">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {dbError && (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {dbError}
          </div>
        )}

        {loading ? (
          <div className="mt-5 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : (
          <div key={tab} className="g-in mt-5 space-y-4">
            {/* ===== ANNONCES ===== */}
            {tab === 'annonces' && (
              <>
                {annonces.length === 0 && <Empty>Aucune annonce pour le moment.</Empty>}
                {annonces.map((a) => (
                  <div key={a.id} className="ck-card !p-4 border-l-4 !border-l-[#2563EB]">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold leading-snug">{a.titre}</h3>
                      {a.urgent && <span className="ck-badge">Urgent</span>}
                    </div>
                    {a.contenu && <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">{a.contenu}</p>}
                    <p className="mt-2 text-[11px] uppercase tracking-wider text-slate-400">
                      Officiel · {dateFr(a.created_at)}
                    </p>
                  </div>
                ))}
                {isStaff && (
                  <p className="text-center text-xs text-slate-400">
                    Pour publier une annonce, va dans l'onglet <b>Admin</b>.
                  </p>
                )}
              </>
            )}

            {/* ===== SONDAGES ===== */}
            {tab === 'sondages' && (
              <>
                {sondages.length === 0 && <Empty>Aucun sondage pour le moment.</Empty>}
                {sondages.map((s) => {
                  const mine = myVotes[s.id];
                  const voted = mine !== undefined;
                  const counts = results[s.id] || Array(s.options.length).fill(0);
                  const total = counts.reduce((x, y) => x + y, 0);
                  const showResults = voted || !s.actif || isStaff;

                  return (
                    <div key={s.id} className="ck-card">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold leading-snug">{s.question}</h3>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            s.actif ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {s.actif ? 'Ouvert' : 'Clos'}
                        </span>
                      </div>

                      <div className="mt-4 space-y-2.5">
                        {s.options.map((opt, i) => {
                          const pct = total ? Math.round((counts[i] / total) * 100) : 0;
                          const isMine = mine === i;
                          const canVote = s.actif && !voted;

                          return (
                            <button
                              key={i}
                              disabled={!canVote}
                              onClick={() => voter(s, i)}
                              className={`relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left text-sm transition ${
                                canVote
                                  ? 'border-slate-200 hover:border-[#2563EB] active:scale-[.98]'
                                  : isMine
                                  ? 'border-[#2563EB]'
                                  : 'border-slate-200'
                              }`}
                            >
                              {showResults && (
                                <span
                                  className={`g-bar absolute inset-y-0 left-0 ${
                                    isMine ? 'bg-[#2563EB]/20' : 'bg-slate-100'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              )}
                              <span className="relative flex items-center justify-between gap-3">
                                <span className={`font-medium ${isMine ? 'text-[#2563EB]' : ''}`}>
                                  {isMine && '✓ '}
                                  {opt}
                                </span>
                                {showResults && (
                                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">
                                    {pct}% · {counts[i]}
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          {total} vote{total > 1 ? 's' : ''}
                          {!showResults && ' · résultats visibles après ton vote'}
                          {voted && s.actif && ' · vote définitif'}
                        </span>
                        {isStaff && (
                          <span className="flex gap-3">
                            {s.actif && (
                              <button onClick={() => fermerSondage(s.id)} className="font-semibold text-[#2563EB]">
                                Clôturer
                              </button>
                            )}
                            <button
                              onClick={() => supprimerSondage(s.id)}
                              className="font-semibold text-slate-400 hover:text-red-600"
                            >
                              Supprimer
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isStaff && (
                  <form onSubmit={creerSondage} className="ck-card-dark space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70">
                      Nouveau sondage
                    </h2>
                    <input
                      value={spQ}
                      onChange={(e) => setSpQ(e.target.value)}
                      maxLength={150}
                      placeholder="Question"
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none placeholder:text-white/40 focus:border-[#2563EB]"
                    />
                    <textarea
                      value={spOpts}
                      onChange={(e) => setSpOpts(e.target.value)}
                      rows={4}
                      placeholder={'Une option par ligne (2 à 5)\nOui\nNon'}
                      className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none placeholder:text-white/40 focus:border-[#2563EB]"
                    />
                    <button disabled={busy} className="ck-btn w-full">
                      {busy ? 'Publication…' : 'Publier le sondage'}
                    </button>
                  </form>
                )}
              </>
            )}

            {/* ===== TP ===== */}
            {tab === 'tp' && (
              <>
                {tps.length === 0 && <Empty>Aucune date limite enregistrée.</Empty>}
                {tps.map((t) => {
                  const tl = timeLeft(t.date_limite, now);
                  return (
                    <div
                      key={t.id}
                      className={`ck-card !p-4 flex items-center justify-between gap-3 ${tl.late ? 'opacity-60' : ''}`}
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-[#2563EB]">
                          {t.matiere}
                        </div>
                        <h3 className="mt-0.5 font-semibold leading-snug">{t.titre}</h3>
                        <p className="mt-1 text-xs text-slate-400">{dateFr(t.date_limite)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                            tl.late
                              ? 'bg-slate-100 text-slate-500'
                              : tl.soon
                              ? 'bg-[#0F172A] text-white'
                              : 'bg-[#2563EB]/10 text-[#2563EB]'
                          }`}
                        >
                          {tl.late ? `Passé · ${tl.txt}` : tl.txt}
                        </span>
                        {isStaff && (
                          <button
                            onClick={() => supprimerTp(t.id)}
                            className="text-[11px] font-semibold text-slate-400 hover:text-red-600"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isStaff && (
                  <form onSubmit={ajouterTp} className="ck-card space-y-3">
                    <h2 className="ck-title">Nouvelle date limite</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={tpMat}
                        onChange={(e) => setTpMat(e.target.value)}
                        placeholder="Matière"
                        maxLength={40}
                        className="ck-input"
                      />
                      <input
                        type="datetime-local"
                        value={tpDate}
                        onChange={(e) => setTpDate(e.target.value)}
                        className="ck-input"
                      />
                    </div>
                    <input
                      value={tpTitre}
                      onChange={(e) => setTpTitre(e.target.value)}
                      placeholder="Intitulé du TP"
                      maxLength={100}
                      className="ck-input"
                    />
                    <button disabled={busy} className="ck-btn w-full">
                      {busy ? 'Ajout…' : 'Ajouter'}
                    </button>
                  </form>
                )}
              </>
            )}

            {/* ===== QUESTIONS ===== */}
            {tab === 'questions' && (
              <>
                <form onSubmit={poserQuestion} className="ck-card space-y-3">
                  <h2 className="ck-title">Poser une question au délégué</h2>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    maxLength={300}
                    rows={3}
                    placeholder="Ex : Le TP de réseau est-il à rendre en groupe ?"
                    className="ck-input resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs tabular-nums text-slate-400">{question.length} / 300</span>
                    <button disabled={busy} className="ck-btn">
                      {busy ? 'Envoi…' : 'Envoyer'}
                    </button>
                  </div>
                </form>

                {questions.length === 0 && <Empty>Aucune question pour le moment. Sois le premier !</Empty>}
                {questions.map((q) => (
                  <div key={q.id} className="ck-card !p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#2563EB]">
                        {q.auteur === me?.id ? 'Toi' : q.auteur_nom || 'Étudiant'}
                      </span>
                      <span className="text-[11px] text-slate-400">{dateFr(q.created_at)}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium">{q.texte}</p>
                    {q.reponse ? (
                      <div className="mt-3 rounded-xl bg-[#2563EB]/5 p-3 text-sm text-slate-700">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#2563EB]">
                          Réponse du délégué
                        </div>
                        {q.reponse}
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] uppercase tracking-wider text-slate-400">
                        En attente de réponse
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div
          role="status"
          style={{ animation: 'gToast .3s ease-out both' }}
          className={`fixed left-1/2 top-5 z-[130] max-w-[90vw] -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-2xl ${
            toast.type === 'err' ? 'bg-red-600' : 'bg-[#0F172A]'
          }`}
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}
