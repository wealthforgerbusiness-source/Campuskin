'use client';

import React, { useState, useEffect } from 'react';

/**
 * Fonction d'assainissement et d'échappement des entrées textuelles (Anti-XSS)
 * Neutralise les caractères spéciaux pour empêcher toute exécution de script malveillant.
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

const MAX_CHARS = 2500;
const STORAGE_KEY = 'campuskin_student_notes_v1';

export default function CampusKinNotesPage() {
  // États sécurisés
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState(null);
  
  // États de connectivité et de synchronisation (Offline-first)
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState('Synchronisé');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialisation au montage (Chargement sécurisé depuis le localStorage avec gestion d'erreurs)
  useEffect(() => {
    // Gestion du statut réseau en temps réel
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => {
        setIsOnline(true);
        triggerSync();
      };
      const handleOffline = () => {
        setIsOnline(false);
        setSyncStatus('Mode hors-ligne (Enregistrement local)');
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      try {
        const savedNotes = localStorage.getItem(STORAGE_KEY);
        if (savedNotes) {
          const parsed = JSON.parse(savedNotes);
          if (Array.isArray(parsed)) {
            // Validation stricte du type de chaque élément chargé
            const validNotes = parsed.filter(
              (item) => item && typeof item.id === 'number' && typeof item.title === 'string' && typeof item.content === 'string'
            );
            setNotes(validNotes);
          }
        }
      } catch (err) {
        setError("Erreur lors de la récupération des notes stockées localement.");
      }

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Fonction de sauvegarde locale sécurisée (Fail-safe & Offline-first)
  const persistNotesLocally = (updatedNotes) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNotes));
      setSyncStatus(isOnline ? 'Synchronisé' : 'Modifications sauvegardées hors-ligne');
    } catch (err) {
      throw new Error("Échec de la persistance locale : espace de stockage saturé ou indisponible.");
    }
  };

  // Simulation de synchronisation réseau lors du retour en ligne
  const triggerSync = () => {
    setSyncStatus('Synchronisation en cours...');
    setTimeout(() => {
      setSyncStatus('Synchronisé');
    }, 1200);
  };

  // Gestionnaire de soumission (Création ou Édition)
  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // 1. Validation de type stricte
    if (typeof title !== 'string' || typeof content !== 'string') {
      setError('Format de données non valide.');
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle || !trimmedContent) {
      setError('Veuillez renseigner à la fois le titre et le contenu du résumé.');
      return;
    }

    // 2. Contrôle strict de la limite de caractères (Rate limiting / Data cap)
    if (trimmedContent.length > MAX_CHARS) {
      setError(`Le résumé dépasse la limite autorisée de ${MAX_CHARS} caractères.`);
      return;
    }

    setIsLoading(true);

    try {
      // 3. Sanitisation rigoureuse anti-XSS
      const sanitizedTitle = sanitizeText(trimmedTitle);
      const sanitizedContent = sanitizeText(trimmedContent);

      let updatedNotes;

      if (editingId !== null) {
        // Mode Édition
        updatedNotes = notes.map((note) =>
          note.id === editingId
            ? { ...note, title: sanitizedTitle, content: sanitizedContent, date: 'Modifié à l\'instant' }
            : note
        );
        setSuccessMsg('Résumé de cours mis à jour avec succès.');
        setEditingId(null);
      } else {
        // Mode Création
        const newNote = {
          id: Date.now(),
          title: sanitizedTitle,
          content: sanitizedContent,
          date: 'Créé à l\'instant'
        };
        updatedNotes = [newNote, ...notes];
        setSuccessMsg('Nouveau résumé enregistré avec succès.');
      }

      // 4. Persistance
      persistNotesLocally(updatedNotes);
      setNotes(updatedNotes);
      setTitle('');
      setContent('');
    } catch (err) {
      // 5. Gestion défensive des erreurs sans fuite technique
      setError(err.message || "Une erreur est survenue lors de l'enregistrement de la note.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction de préparation à l'édition d'une note
  const handleEdit = (note) => {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setError(null);
    setSuccessMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Suppression sécurisée d'une note
  const handleDelete = (id) => {
    if (typeof id !== 'number') return;
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce résumé de cours ?')) {
      try {
        const updatedNotes = notes.filter((n) => n.id !== id);
        persistNotesLocally(updatedNotes);
        setNotes(updatedNotes);
        setSuccessMsg('Résumé supprimé avec succès.');
        if (editingId === id) {
          setEditingId(null);
          setTitle('');
          setContent('');
        }
      } catch (err) {
        setError("Impossible de supprimer cette note pour le moment.");
      }
    }
  };

  // Annulation de l'édition en cours
  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setError(null);
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
              <span className="text-xs text-slate-500 font-medium">Espace Notes & Résumés de Cours</span>
            </div>
          </div>

          {/* Indicateur de statut réseau & synchronisation */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs font-medium text-slate-600">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              <span>{syncStatus}</span>
            </div>
            <a
              href="/"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#0F172A] text-xs font-semibold rounded-xl transition-all"
            >
              Retour Tableau de bord
            </a>
          </div>
        </div>
      </header>

      {/* Contenu Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Messages d'alerte ou de succès (Fail-safe UI) */}
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
          
          {/* Formulaire de rédaction / édition sécurisé */}
          <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-100/50 h-fit sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">
                  {editingId !== null ? 'Modifier le résumé' : 'Nouveau Résumé'}
                </h2>
                <p className="text-xs text-slate-500">Rédigez et stockez vos cours en toute sécurité.</p>
              </div>
              {editingId !== null && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-slate-400 hover:text-slate-600 underline font-medium"
                >
                  Annuler
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Titre du cours</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Architecture Microservices"
                  maxLength={120}
                  required
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all text-[#0F172A]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Contenu du résumé</label>
                  <span className={`text-[11px] font-medium ${content.length > MAX_CHARS * 0.9 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                    {content.length} / {MAX_CHARS} caractères
                  </span>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Synthétisez les points essentiels du cours..."
                  rows={8}
                  maxLength={MAX_CHARS}
                  required
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all text-[#0F172A] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isLoading ? (
                  <span>Enregistrement en cours...</span>
                ) : (
                  <span>{editingId !== null ? 'Mettre à jour le résumé' : 'Enregistrer le résumé'}</span>
                )}
              </button>
            </form>
          </div>

          {/* Liste des résumés de l'étudiant */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0F172A]">Mes Notes de Cours Enregistrées</h2>
              <span className="text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                {notes.length} document{notes.length > 1 ? 's' : ''} disponible{notes.length > 1 ? 's' : ''}
              </span>
            </div>

            {notes.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-xl shadow-slate-100/50">
                <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                  📝
                </div>
                <h3 className="text-base font-bold text-[#0F172A]">Aucun résumé pour le moment</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Commencez par rédiger votre premier résumé de cours via le formulaire pour le conserver en local et hors-ligne.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-white rounded-2xl p-6 border border-slate-100 shadow-lg shadow-slate-100/50 hover:border-blue-200 transition-all duration-200 group relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-[#2563EB] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                          {note.title}
                        </h3>
                        <span className="text-[11px] font-medium text-slate-400 mt-0.5 inline-block">
                          {note.date}
                        </span>
                      </div>
                      
                      {/* Actions sur la note */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(note)}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-[#2563EB] text-xs font-semibold rounded-lg transition-colors border border-slate-100"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(note.id)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-lg transition-colors border border-rose-100"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>

                    {/* Affichage sécurisé du contenu (sans HTML brut / sans dangerouslySetInnerHTML) */}
                    <p className="text-sm text-slate-600 mt-4 leading-relaxed whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
