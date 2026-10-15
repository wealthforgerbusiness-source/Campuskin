'use client';

import React, { useState, useEffect } from 'react';

/**
 * Fonction d'assainissement et d'échappement des entrées textuelles (Anti-XSS)
 */
const sanitizeText = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

const STORAGE_VOTES_KEY = 'campuskin_user_votes_v1';
const STORAGE_QUESTIONS_KEY = 'campuskin_delegue_questions_v1';
const MAX_QUESTION_CHARS = 500;

export default function CampusKinGroupesPage() {
  // États de données initiales sécurisés
  const [announcements, setAnnouncements] = useState([
    {
      id: 1,
      title: 'Planning des examens de session de rattrapage',
      category: 'Officiel Administration',
      content: 'Le calendrier officiel des examens de rattrapage est disponible. Veuillez consulter le secrétariat pour les détails par département.',
      date: 'Il y a 2 heures',
      urgent: true
    },
    {
      id: 2,
      title: 'Séminaire Pratique : Développement Cloud & DevOps',
      category: 'Conférence Promotion',
      content: 'Un atelier pratique sur le déploiement de conteneurs Docker et l\'utilisation de Render se tiendra ce samedi à l\'amphithéâtre principal.',
      date: 'Hier',
      urgent: false
    }
  ]);

  const [polls, setPolls] = useState([
    {
      id: 101,
      question: 'Quel jour préférez-vous pour la remise du TP d\'Architecture Web ?',
      options: [
        { id: 1, text: 'Vendredi à 23h59', votes: 42 },
        { id: 2, text: 'Samedi à 18h00', votes: 18 },
        { id: 3, text: 'Dimanche à 23h59', votes: 31 }
      ],
      totalVotes: 91
    }
  ]);

  const [deadlines, setDeadlines] = useState([
    {
      id: 201,
      title: 'TP d\'Architecture Web (Node.js & API Sécurisées)',
      dueDate: '2026-06-25T23:59:00Z',
      course: 'Génie Logiciel L3',
      status: 'En cours'
    },
    {
      id: 202,
      title: 'Projet de Sécurité des Réseaux',
      dueDate: '2026-06-30T18:00:00Z',
      course: 'Cybersécurité',
      status: 'À venir'
    }
  ]);

  // États pour les votes et questions posées au délégué
  const [userVotes, setUserVotes] = useState({});
  const [delegateQuestion, setDelegateQuestion] = useState('');
  const [userQuestions, setUserQuestions] = useState([]);
  
  // États de l'interface (Fail-safe UI)
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Chargement initial sécurisé des votes et questions depuis localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedVotes = localStorage.getItem(STORAGE_VOTES_KEY);
        if (savedVotes) {
          const parsedVotes = JSON.parse(savedVotes);
          if (parsedVotes && typeof parsedVotes === 'object') {
            setUserVotes(parsedVotes);
          }
        }

        const savedQuestions = localStorage.getItem(STORAGE_QUESTIONS_KEY);
        if (savedQuestions) {
          const parsedQ = JSON.parse(savedQuestions);
          if (Array.isArray(parsedQ)) {
            setUserQuestions(parsedQ.filter(q => q && typeof q.text === 'string'));
          }
        }
      } catch (err) {
        setError("Erreur lors de la récupération des données locales.");
      }
    }
  }, []);

  // Validation rigoureuse du format de date pour les deadlines
  const formatDeadlineDate = (dateString) => {
    try {
      const dateObj = new Date(dateString);
      if (isNaN(dateObj.getTime())) {
        return 'Date non spécifiée';
      }
      return new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(dateObj);
    } catch (e) {
      return 'Format de date invalide';
    }
  };

  // Gestionnaire de vote sécurisé (Anti-votes multiples)
  const handleVote = (pollId, optionId) => {
    setError(null);
    setSuccessMsg(null);

    if (typeof pollId !== 'number' || typeof optionId !== 'number') {
      setError('Paramètres de vote invalides.');
      return;
    }

    // Vérifier si l'utilisateur a déjà voté pour ce sondage
    if (userVotes[pollId]) {
      setError('Vous avez déjà exprimé votre vote pour ce sondage.');
      return;
    }

    try {
      const updatedPolls = polls.map((poll) => {
        if (poll.id === pollId) {
          const updatedOptions = poll.options.map((opt) =>
            opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
          );
          return {
            ...poll,
            options: updatedOptions,
            totalVotes: poll.totalVotes + 1
          };
        }
        return poll;
      });

      const updatedVotesState = { ...userVotes, [pollId]: optionId };
      setUserVotes(updatedVotesState);
      setPolls(updatedPolls);

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_VOTES_KEY, JSON.stringify(updatedVotesState));
      }

      setSuccessMsg('Votre vote a été enregistré avec succès !');
    } catch (err) {
      setError("Impossible d'enregistrer le vote pour le moment.");
    }
  };

  // Soumission d'une question au délégué avec limites de caractères et anti-spam
  const handleSubmitQuestion = (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (typeof delegateQuestion !== 'string') {
      setError('Format de question invalide.');
      return;
    }

    const trimmedQ = delegateQuestion.trim();

    if (!trimmedQ) {
      setError('Veuillez saisir votre question avant de l\'envoyer.');
      return;
    }

    if (trimmedQ.length > MAX_QUESTION_CHARS) {
      setError(`La question dépasse la limite autorisée de ${MAX_QUESTION_CHARS} caractères.`);
      return;
    }

    setIsLoading(true);

    try {
      const sanitizedQ = sanitizeText(trimmedQ);
      const newEntry = {
        id: Date.now(),
        text: sanitizedQ,
        date: 'À l\'instant',
        status: 'Transmis au délégué'
      };

      const updatedList = [newEntry, ...userQuestions];
      setUserQuestions(updatedList);
      setDelegateQuestion('');
      setSuccessMsg('Votre question a été transmise au délégué de promotion.');

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_QUESTIONS_KEY, JSON.stringify(updatedList));
      }
    } catch (err) {
      setError("Une erreur est survenue lors de l'envoi de la question.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0F172A] font-sans antialiased selection:bg-[#2563EB] selection:text-white">
      
      {/* Barre de navigation supérieure */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center text-white font-bold text-xl shadow-md shadow-blue-500/20">
              CK
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[#0F172A]">CampusKin</h1>
              <span className="text-xs text-slate-500 font-medium">Espace Groupes & Promotion</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#2563EB]">
              Promotion L3 GL
            </span>
            <a
              href="/"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#0F172A] text-xs font-semibold rounded-xl transition-all"
            >
              Tableau de bord
            </a>
          </div>
        </div>
      </header>

      {/* Contenu Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Notifications d'état (Fail-safe UI) */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-2xl font-medium animate-fadeIn shadow-sm">
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl font-medium animate-fadeIn shadow-sm">
            ✨ {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Colonne Principale : Annonces Officielles & Sondages (2 Colonnes sur Large) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Section Alertes & Annonces Officielles */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#0F172A]">Annonces & Alertes Officielles</h2>
                <span className="text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                  {announcements.length} annonce{announcements.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-4">
                {announcements.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-100/50 hover:border-blue-200 transition-all duration-200 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-[#2563EB]"></div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-[#2563EB] mb-2">
                          {item.category}
                        </span>
                        <h3 className="text-base font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                          {item.title}
                        </h3>
                      </div>
                      {item.urgent && (
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                          Important
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                      {item.content}
                    </p>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <span>Publié par le secrétariat académique</span>
                      <span>{item.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section Sondages Interactifs */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#0F172A]">Sondages de la Promotion</h2>
                <span className="text-xs text-slate-500 font-medium">Votes en temps réel</span>
              </div>

              <div className="space-y-4">
                {polls.map((poll) => {
                  const hasVoted = userVotes[poll.id] !== undefined;
                  return (
                    <div
                      key={poll.id}
                      className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-100/50"
                    >
                      <h3 className="text-base font-bold text-[#0F172A] mb-4">{poll.question}</h3>
                      
                      <div className="space-y-3">
                        {poll.options.map((option) => {
                          const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                          const isSelected = userVotes[poll.id] === option.id;

                          return (
                            <div key={option.id} className="space-y-1">
                              <button
                                onClick={() => handleVote(poll.id, option.id)}
                                disabled={hasVoted}
                                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between group ${
                                  isSelected
                                    ? 'border-[#2563EB] bg-blue-50/50 shadow-sm'
                                    : 'border-slate-200 hover:border-[#2563EB] bg-slate-50/50'
                                } ${hasVoted ? 'cursor-default' : 'cursor-pointer'}`}
                              >
                                <span className="text-sm font-semibold text-[#0F172A] flex items-center space-x-2">
                                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#2563EB] bg-[#2563EB]' : 'border-slate-300'}`}>
                                    {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                                  </span>
                                  <span>{option.text}</span>
                                </span>
                                <span className="text-xs font-bold text-[#2563EB]">
                                  {percentage}% ({option.votes} votes)
                                </span>
                              </button>
                              
                              {/* Barre de progression visuelle */}
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-[#2563EB] h-full transition-all duration-500 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {hasVoted && (
                        <p className="mt-4 text-xs font-medium text-emerald-600 flex items-center space-x-1">
                          <span>✓ Votre vote a été pris en compte.</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

          </div>

          {/* Colonne Latérale : Suivi Deadlines & Canal Délégué */}
          <div className="space-y-8">
            
            {/* Suivi des Deadlines de TP */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-100/50">
              <h2 className="text-lg font-bold text-[#0F172A] mb-1">Échéances & Deadlines TP</h2>
              <p className="text-xs text-slate-500 mb-6">Suivi personnel des remises de travaux.</p>

              <div className="space-y-4">
                {deadlines.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded">
                        {item.course}
                      </span>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                        {item.status}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-[#0F172A]">{item.title}</h4>
                    <p className="text-xs text-slate-500 font-medium">
                      📅 Limite : {formatDeadlineDate(item.dueDate)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Formulaire de question au délégué */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-100/50">
              <h2 className="text-lg font-bold text-[#0F172A] mb-1">Poser une question au Délégué</h2>
              <p className="text-xs text-slate-500 mb-4">Besoin d'éclaircissements sur un cours ou un TP ? Envoyez votre message.</p>

              <form onSubmit={handleSubmitQuestion} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Votre message</label>
                    <span className={`text-[11px] font-medium ${delegateQuestion.length > MAX_QUESTION_CHARS * 0.9 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                      {delegateQuestion.length} / {MAX_QUESTION_CHARS}
                    </span>
                  </div>
                  <textarea
                    value={delegateQuestion}
                    onChange={(e) => setDelegateQuestion(e.target.value)}
                    placeholder="Posez votre question ici..."
                    rows={4}
                    maxLength={MAX_QUESTION_CHARS}
                    required
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all text-[#0F172A] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {isLoading ? <span>Envoi en cours...</span> : <span>Transmettre au délégué</span>}
                </button>
              </form>

              {/* Historique des questions posées */}
              {userQuestions.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Mes questions transmises</h3>
                  <div className="space-y-2">
                    {userQuestions.map((q) => (
                      <div key={q.id} className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                        <p className="font-medium text-[#0F172A]">{q.text}</p>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>{q.status}</span>
                          <span>{q.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
