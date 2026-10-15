'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

const FEE = 0.025; // 2,5 % de frais SasPay

const TABS = [
  { id: 'apercu', label: 'Aperçu' },
  { id: 'annonces', label: 'Annonces' },
  { id: 'questions', label: 'Questions' },
  { id: 'etudiants', label: 'Étudiants' },
  { id: 'paiement', label: 'Paiement' },
];

const fmt = (n, d = 0) =>
  Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

const dateFr = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export default function AdminPage() {
  const router = useRouter();

  const [phase, setPhase] = useState('check'); // check | denied | ok
  const [me, setMe] = useState(null); // { id, nom, role }
  const [token, setToken] = useState('');
  const [tab, setTab] = useState('apercu');
  const [toast, setToast] = useState(null);
  const [dbError, setDbError] = useState('');

  const [annonces, setAnnonces] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [profils, setProfils] = useState([]);
  const [paiements, setPaiements] = useState([]);

  /* Formulaires */
  const [titre, setTitre] = useState('');
  const [contenu, setContenu] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reponses, setReponses] = useState({});
  const [search, setSearch] = useState('');

  /* Paiement */
  const [montant, setMontant] = useState('10');
  const [devise, setDevise] = useState('USD');
  const [tel, setTel] = useState('');
  const [payMsg, setPayMsg] = useState('');

  const notify = (text, type = 'ok') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3200);
  };

  /* ---------- Contrôle d'accès (RBAC) ---------- */
  useEffect(() => {
    (async () => {
      if (!supabase) return setPhase('denied');
      const { data: sess } = await supabase.auth.getSession();
      const user = sess?.session?.user;
      if (!user) return setPhase('denied');
      setToken(sess.session.access_token);

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, nom, role')
        .eq('id', user.id)
        .single();

      if (!prof || !['delegue', 'admin'].includes(prof.role)) {
        setPhase('denied');
        setTimeout(() => router.replace('/'), 2200);
        return;
      }
      setMe(prof);
      setPhase('ok');
    })();
  }, [router]);

  /* ---------- Chargement des données ---------- */
  const load = useCallback(async () => {
    setDbError('');
    const [a, q, p, pay] = await Promise.all([
      supabase.from('annonces').select('*').order('created_at', { ascending: false }),
      supabase.from('questions').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('paiements').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    const err = [a, q, p, pay].find((r) => r.error);
    if (err) setDbError(`Erreur Supabase : ${err.error.message}. As-tu exécuté tout le SQL ?`);
    setAnnonces(a.data || []);
    setQuestions(q.data || []);
    setProfils(p.data || []);
    setPaiements(pay.data || []);
  }, []);

  useEffect(() => {
    if (phase === 'ok') load();
  }, [phase, load]);

  /* ---------- Annonces ---------- */
  const publier = async (e) => {
    e.preventDefault();
    if (titre.trim().length < 3) return notify('Le titre est trop court.', 'err');
    setBusy(true);
    const { error } = await supabase.from('annonces').insert({
      titre: titre.trim(),
      contenu: contenu.trim() || null,
      urgent,
      auteur: me.id,
    });
    setBusy(false);
    if (error) return notify(error.message, 'err');
    setTitre('');
    setContenu('');
    setUrgent(false);
    notify('Annonce publiée.');
    load();
  };

  const supprimer = async (id) => {
    if (!window.confirm('Supprimer cette annonce ?')) return;
    const { error } = await supabase.from('annonces').delete().eq('id', id);
    if (error) return notify(error.message, 'err');
    notify('Annonce supprimée.');
    load();
  };

  /* ---------- Questions ---------- */
  const repondre = async (id) => {
    const txt = (reponses[id] || '').trim();
    if (!txt) return;
    const { error } = await supabase
      .from('questions')
      .update({ reponse: txt, repondu_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return notify(error.message, 'err');
    setReponses((r) => ({ ...r, [id]: '' }));
    notify('Réponse envoyée.');
    load();
  };

  /* ---------- Paiement SasPay ---------- */
  const calc = useMemo(() => {
    const base = parseFloat(String(montant).replace(',', '.')) || 0;
    const frais =
      devise === 'USD'
        ? Math.ceil(base * FEE * 100 - 1e-9) / 100
        : Math.ceil(base * FEE - 1e-9);
    return { base, frais, total: base + frais };
  }, [montant, devise]);

  const payer = async () => {
    setPayMsg('');
    if (calc.base <= 0) return setPayMsg('Entre un montant valide.');
    setBusy(true);
    try {
      const { data: row, error } = await supabase
        .from('paiements')
        .insert({
          user_id: me.id,
          montant: calc.base,
          frais: calc.frais,
          total: calc.total,
          devise,
          telephone: tel.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;

      const res = await fetch('/api/saspay/initier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paiement_id: row.id }),
      });

      if (res.status === 404) {
        setPayMsg("La passerelle SasPay n'est pas encore branchée côté serveur. Le paiement est enregistré « en attente ».");
      } else {
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || 'Échec SasPay.');
        if (out.url) {
          window.location.href = out.url;
          return;
        }
        notify('Paiement initié.');
      }
      load();
    } catch (err) {
      setPayMsg(err.message || 'Erreur de paiement.');
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Statistiques ---------- */
  const sansReponse = questions.filter((q) => !q.reponse).length;
  const confirmes = paiements.filter((p) => p.statut === 'confirme');
  const filtres = profils.filter((p) =>
    `${p.nom || ''} ${p.email || ''} ${p.promotion || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  /* ---------- Écrans d'attente / refus ---------- */
  if (phase === 'check')
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0F172A]">
        <span className="animate-pulse text-xs uppercase tracking-[0.4em] text-white/60">Vérification…</span>
      </main>
    );

  if (phase === 'denied')
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0F172A] px-8 text-center text-white">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2563EB]/20 ring-1 ring-[#2563EB]/50">
          <svg viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-[#60a5fa] stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <h1 className="text-2xl font-light uppercase tracking-tight">Accès réservé</h1>
        <p className="mt-3 max-w-xs text-sm text-white/60">
          Cette console est réservée au délégué et à l'administrateur. Retour à l'accueil…
        </p>
      </main>
    );

  /* ---------- Console ---------- */
  return (
    <main className="min-h-screen bg-slate-50 pb-36">
      <style>{`
        @keyframes aUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes aToast{from{opacity:0;transform:translate(-50%,-12px)}to{opacity:1;transform:translate(-50%,0)}}
        .a-in{animation:aUp .5s cubic-bezier(.2,.7,.2,1) both}
      `}</style>

      {/* En-tête */}
      <header className="relative overflow-hidden bg-[#0F172A] px-5 pb-16 pt-[max(env(safe-area-inset-top),2rem)] text-white">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#2563EB]/40 blur-[90px]" />
        <div className="relative mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/60">Console · CampusKin</p>
            <span className="rounded-full bg-[#2563EB] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest">
              {me.role}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-light uppercase tracking-tight sm:text-4xl">
            Salut, <span className="font-semibold text-[#60a5fa]">{(me.nom || 'délégué').split(' ')[0]}.</span>
          </h1>
        </div>
      </header>

      <div className="relative z-10 mx-auto -mt-8 max-w-5xl px-4 sm:px-5">
        {/* Onglets */}
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-[0_20px_50px_-20px_rgba(15,23,42,.35)] ring-1 ring-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-widest transition ${
                tab === t.id ? 'bg-[#0F172A] text-white' : 'text-slate-500 hover:text-[#0F172A]'
              }`}
            >
              {t.label}
              {t.id === 'questions' && sansReponse > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2563EB] px-1 text-[9px] text-white">
                  {sansReponse}
                </span>
              )}
            </button>
          ))}
        </div>

        {dbError && (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {dbError}
          </div>
        )}

        <div key={tab} className="a-in mt-5 space-y-5">
          {/* ===== APERÇU ===== */}
          {tab === 'apercu' && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { k: 'Étudiants', v: profils.length, s: 'inscrits' },
                  { k: 'Annonces', v: annonces.length, s: 'publiées' },
                  { k: 'Questions', v: sansReponse, s: 'sans réponse' },
                  { k: 'Paiements', v: confirmes.length, s: 'confirmés' },
                ].map((c) => (
                  <div key={c.k} className="ck-card !p-4">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400">{c.k}</div>
                    <div className="mt-1 text-3xl font-semibold tracking-tight text-[#0F172A]">{fmt(c.v)}</div>
                    <div className="text-[11px] text-slate-400">{c.s}</div>
                  </div>
                ))}
              </div>

              <div className="ck-card">
                <h2 className="ck-title">Actions rapides</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <button onClick={() => setTab('annonces')} className="ck-btn">Publier une annonce</button>
                  <button onClick={() => setTab('questions')} className="ck-btn-outline">
                    Répondre aux questions
                  </button>
                  <button onClick={() => setTab('paiement')} className="ck-btn-outline">
                    Abonnement du groupe
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ===== ANNONCES ===== */}
          {tab === 'annonces' && (
            <>
              <form onSubmit={publier} className="ck-card space-y-3">
                <h2 className="ck-title">Nouvelle annonce officielle</h2>
                <input
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  placeholder="Titre (ex : Examen de Programmation reporté)"
                  maxLength={120}
                  className="ck-input"
                />
                <textarea
                  value={contenu}
                  onChange={(e) => setContenu(e.target.value)}
                  placeholder="Détails (optionnel)"
                  rows={4}
                  maxLength={1000}
                  className="ck-input resize-none"
                />
                <div className="flex items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={urgent}
                      onChange={(e) => setUrgent(e.target.checked)}
                      className="h-5 w-5 accent-[#2563EB]"
                    />
                    Marquer comme urgent
                  </label>
                  <button disabled={busy} className="ck-btn">
                    {busy ? 'Envoi…' : 'Publier'}
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                {annonces.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
                    Aucune annonce publiée.
                  </p>
                )}
                {annonces.map((a) => (
                  <div key={a.id} className="ck-card !p-4 border-l-4 !border-l-[#2563EB]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold leading-snug">{a.titre}</h3>
                          {a.urgent && <span className="ck-badge">Urgent</span>}
                        </div>
                        {a.contenu && <p className="mt-1 text-sm text-slate-600">{a.contenu}</p>}
                        <p className="mt-2 text-[11px] uppercase tracking-wider text-slate-400">
                          {dateFr(a.created_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => supprimer(a.id)}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ===== QUESTIONS ===== */}
          {tab === 'questions' && (
            <div className="space-y-3">
              {questions.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
                  Aucune question pour le moment.
                </p>
              )}
              {questions.map((q) => (
                <div key={q.id} className="ck-card !p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#2563EB]">
                      {q.auteur_nom || 'Étudiant'}
                    </span>
                    <span className="text-[11px] text-slate-400">{dateFr(q.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{q.texte}</p>

                  {q.reponse ? (
                    <div className="mt-3 rounded-xl bg-[#2563EB]/5 p-3 text-sm text-slate-700">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#2563EB]">
                        Ta réponse
                      </div>
                      {q.reponse}
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <input
                        value={reponses[q.id] || ''}
                        onChange={(e) => setReponses((r) => ({ ...r, [q.id]: e.target.value }))}
                        placeholder="Ta réponse…"
                        className="ck-input"
                      />
                      <button onClick={() => repondre(q.id)} className="ck-btn !px-4">
                        Envoyer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ===== ÉTUDIANTS ===== */}
          {tab === 'etudiants' && (
            <div className="ck-card">
              <div className="flex items-center justify-between gap-3">
                <h2 className="ck-title">{fmt(profils.length)} inscrits</h2>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="ck-input !w-44 !py-2"
                />
              </div>
              <ul className="mt-4 divide-y divide-slate-100">
                {filtres.length === 0 && <li className="py-6 text-center text-sm text-slate-400">Aucun résultat.</li>}
                {filtres.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0F172A] text-sm font-semibold uppercase text-white">
                        {(p.nom || p.email || '?').charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{p.nom || 'Sans nom'}</div>
                        <div className="truncate text-xs text-slate-400">
                          {p.promotion || '—'} · {p.email}
                        </div>
                      </div>
                    </div>
                    <span className={p.role === 'etudiant' ? 'text-[10px] uppercase tracking-wider text-slate-400' : 'ck-badge'}>
                      {p.role}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ===== PAIEMENT SASPAY ===== */}
          {tab === 'paiement' && (
            <>
              <div className="ck-card-dark">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70">
                  Abonnement du groupe · SasPay
                </h2>

                <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
                  {['USD', 'CDF'].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDevise(d)}
                      className={`rounded-lg py-2 text-xs font-semibold uppercase tracking-widest transition ${
                        devise === d ? 'bg-[#2563EB]' : 'text-white/60'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                <label className="mt-4 block text-[11px] uppercase tracking-widest text-white/50">
                  Montant de l'abonnement ({devise})
                  <input
                    inputMode="decimal"
                    value={montant}
                    onChange={(e) => setMontant(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xl font-semibold normal-case tracking-normal outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40"
                  />
                </label>

                <label className="mt-3 block text-[11px] uppercase tracking-widest text-white/50">
                  Numéro Mobile Money (si demandé)
                  <input
                    inputMode="tel"
                    value={tel}
                    onChange={(e) => setTel(e.target.value)}
                    placeholder="+243…"
                    className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 normal-case tracking-normal outline-none placeholder:text-white/30 focus:border-[#2563EB]"
                  />
                </label>

                <dl className="mt-5 space-y-2 rounded-xl bg-white/5 p-4 text-sm ring-1 ring-white/10">
                  <div className="flex justify-between">
                    <dt className="text-white/60">Abonnement</dt>
                    <dd className="font-semibold">{fmt(calc.base, devise === 'USD' ? 2 : 0)} {devise}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-white/60">Frais SasPay (2,5 %)</dt>
                    <dd className="font-semibold">{fmt(calc.frais, devise === 'USD' ? 2 : 0)} {devise}</dd>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2 text-base">
                    <dt className="font-semibold">Total à payer</dt>
                    <dd className="font-semibold text-[#60a5fa]">
                      {fmt(calc.total, devise === 'USD' ? 2 : 0)} {devise}
                    </dd>
                  </div>
                </dl>

                {payMsg && (
                  <div role="status" className="mt-4 rounded-xl border border-[#60a5fa]/40 bg-[#2563EB]/15 px-4 py-3 text-sm text-blue-100">
                    {payMsg}
                  </div>
                )}

                <button onClick={payer} disabled={busy} className="ck-btn mt-5 w-full !py-3.5">
                  {busy ? 'Un instant…' : `Payer ${fmt(calc.total, devise === 'USD' ? 2 : 0)} ${devise}`}
                </button>
              </div>

              <div className="ck-card">
                <h2 className="ck-title">Derniers paiements</h2>
                <ul className="mt-3 divide-y divide-slate-100">
                  {paiements.length === 0 && (
                    <li className="py-5 text-center text-sm text-slate-400">Aucun paiement.</li>
                  )}
                  {paiements.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <div className="font-semibold">
                          {fmt(p.total, p.devise === 'USD' ? 2 : 0)} {p.devise}
                        </div>
                        <div className="text-xs text-slate-400">{dateFr(p.created_at)}</div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          p.statut === 'confirme'
                            ? 'bg-emerald-50 text-emerald-600'
                            : p.statut === 'echoue'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {p.statut.replace('_', ' ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notification */}
      {toast && (
        <div
          role="status"
          style={{ animation: 'aToast .3s ease-out both' }}
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
