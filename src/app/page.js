'use client';

import React, { useState } from 'react';

/**
 * Fonction de nettoyage et d'échappement des entrées textuelles (Prévention XSS)
 * Élimine tout risque d'injection en transformant les caractères spéciaux.
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

export default function CampusKinDashboard() {
  // États locaux avec typage implicite sécurisé
  const [notes, setNotes] = useState([
    {
      id: 1,
      title: 'Architecture Web Avancée',
      content: 'Rappel sur les serveurs Node.js, les routes API sécurisées et la gestion des sessions JWT.',
      date: "Aujourd'hui, 09:30"
    },
    {
      id: 2,
      title: 'Sécurité des Systèmes d\'Information',
      content: 'Principes de défense en profondeur, hachage des mots de passe (bcrypt) et prévention des injections SQL.',
      date: 'Hier, 14:15'
    }
  ]);

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Gestionnaire de soumission sécurisé
  const handleAddSummary = (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // 1. Vérification de type stricte
    if (typeof newTitle !== 'string' || typeof newContent !== 'string') {
      setError('Erreur système : Format de données invalide.');
      return;
    }

    const trimmedTitle = newTitle.trim();
    const trimmedContent = newContent.trim();

    // 2. Validation des champs vides
    if (!trimmedTitle || !trimmedContent) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    // 3. Contrôle strict de la limite de caractères
    if (trimmedContent.length > MAX_CHARS) {
      setError(`Le résumé dépasse la limite autorisée de ${MAX_CHARS} caractères.`);
      return;
    }

    setIsLoading(true);

    try {
      // 4. Sanctuarisation des données avant l'enregistrement dans l'état (ou la base de données)
      const secureNote = {
        id: Date.now(),
        title: sanitizeText(trimmedTitle),
        content: sanitizeText(trimmedContent),
        date: "À l'instant"
      };

      setNotes([secureNote, ...notes]);
      setNewTitle('');
      setNewContent('');
      setSuccessMessage('Résumé enregistré et sécurisé avec succès !');
    } catch (err) {
      // 5. Gestion des erreurs fail-safe sans fuite de stack trace
      setError("Une erreur inattendue est survenue lors de l'enregistrement. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0F172A] font-sans antialiased selection:bg-[#2563EB] selection:text-white">
      {/* Barre de Navigation Supérieure */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center text-white font-bold text-xl shadow-md shadow-blue-500/20">
              CK
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[#0F172A]">CampusKin</h1>
              <span className="text-xs text-slate-500 font-medium">Tableau de Bord Étudiant</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#2563EB]">
              Promotion L3 GL
            </span>
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[#2563EB] text-sm">
              ET
            </div>
          </div>
        </div>
      </header>

      {/* Contenu Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Section supérieure : Statistiques & Widgets Budget */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Widget Budget USD */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-100/50 relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:border-blue-100 group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-blue-100 transition-colors"></div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Solde Compte (USD)</p>
            <h3 className="text-3xl font-extrabold text-[#0F172A] mt-2">$ 145.50</h3>
            <div className="mt-4 flex items-center text-xs text-emerald-600 font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
              Mis à jour aujourd'hui
            </div>
          </div>

          {/* Widget Budget CDF */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-100/50 relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:border-blue-100 group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-blue-100 transition-colors"></div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Solde Compte (CDF)</p>
            <h3 className="text-3xl font-extrabold text-[#0F172A] mt-2">CDF 395,000</h3>
            <div className="mt-4 flex items-center text-xs text-blue-600 font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-[#2563EB] mr-2"></span>
              Taux indicatif bancaire
            </div>
          </div>

          {/* Widget Alertes TP / Échéances */}
          <div className="bg-[#0F172A] text-white rounded-2xl p-6 shadow-xl relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#2563EB]/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Alerte Promotion</p>
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500 text-white animate-pulse">Urgent</span>
            </div>
            <h4 className="text-lg font-bold mt-2">TP Architecture Web</h4>
            <p className="text-xs text-slate-300 mt-1">Date limite de soumission : Vendredi à 23h59</p>
          </div>
        </div>

        {/* Grille principale : Formulaire d'ajout sécurisé & Liste des résumés */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Formulaire d'ajout de résumé (Sécurisé & Limité) */}
          <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-100/50">
            <h2 className="text-lg font-bold text-[#0F172A] mb-1">Nouveau Résumé</h2>
            <p className="text-xs text-slate-500 mb-6">Ajoutez et sécurisez vos notes de cours instantanément.</p>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium animate-fadeIn">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-medium animate-fadeIn">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleAddSummary} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Titre du cours / sujet</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Réseaux Avancés"
                  maxLength={100}
                  required
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all text-[#0F172A]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Résumé textuel</label>
                  <span className={`text-[11px] font-medium ${newContent.length > MAX_CHARS * 0.9 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                    {newContent.length} / {MAX_CHARS}
                  </span>
                </div>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Saisissez les points clés..."
                  rows={5}
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
                  <span>Traitement sécurisé...</span>
                ) : (
                  <span>Enregistrer le résumé</span>
                )}
              </button>
            </form>
          </div>

          {/* Liste des résumés de cours */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0F172A]">Résumés de Cours Récents</h2>
              <span className="text-xs text-slate-500 font-medium">{notes.length} éléments sauvegardés</span>
            </div>

            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-white rounded-2xl p-5 border border-slate-100 shadow-lg shadow-slate-100/50 hover:border-blue-200 transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-base font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                      {note.title}
                    </h3>
                    <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                      {note.date}
                    </span>
                  </div>
                  {/* Affichage sécurisé sans dangerouslySetInnerHTML */}
                  <p className="text-sm text-slate-600 mt-3 leading-relaxed whitespace-pre-wrap">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
