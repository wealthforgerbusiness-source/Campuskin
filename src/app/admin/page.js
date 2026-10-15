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

// Validation stricte des numéros Mobile Money RDC (Orange, M-Pesa/Vodacom, Airtel, Africell)
const validateRDCPhone = (phone) => {
  const cleaned = phone.replace(/\s+/g, '');
  // Formats acceptés : +243XXXXXXXXX ou 0XXXXXXXXX (9 chiffres après l'indicatif ou le 0)
  const rdcRegex = /^(?:\+243|0)[1-9]\d{8}$/;
  return rdcRegex.test(cleaned);
};

const STORAGE_ADMIN_ANNOUNCEMENTS = 'campuskin_admin_announcements_v1';
const STORAGE_ADMIN_QUESTIONS = 'campuskin_admin_questions_v1';
const SASPAY_FEE_PERCENT = 2.5;

export default function CampusKinAdminPage() {
  // Contrôle d'accès (RBAC simulé / vérification de session admin)
  // Dans un cas réel, cette valeur provient d'un token JWT ou d'une session serveur sécurisée.
  const [isAdmin, setIsAdmin] = useState(true);

  // États pour les annonces officielles
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementCategory, setAnnouncementCategory] = useState('Officiel Administration');
  const [isUrgent, setIsUrgent] = useState(false);
  const [announcements, setAnnouncements] = useState([
    {
      id: 1,
      title: 'Planning des examens de session de rattrapage',
      category: 'Officiel Administration',
      content: 'Le calendrier officiel est disponible auprès du secrétariat.',
      date: 'Aujourd’hui',
      urgent: true
    }
  ]);

  // États pour les questions des étudiants (Q&A)
  const [studentQuestions, setStudentQuestions] = useState([
    {
      id: 101,
      studentName: 'Étudiant Anonyme',
      text: 'Le délai pour le TP d\'Architecture Web peut-il être prolongé de 24h ?',
      date: 'Il y a 1 heure',
      reply: ''
    }
  ]);
  const [replyText, setReplyText] = useState({});

  // États pour le module SasPay (Abonnement officiel du groupe)
  const [planAmount, setPlanAmount] = useState(15); // En USD par exemple
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // États généraux d'interface (Fail-safe UI)
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Chargement initial sécurisé depuis localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedAnnouncements = localStorage.getItem(STORAGE_ADMIN_ANNOUNCEMENTS);
        if (savedAnnouncements) {
          const parsed = JSON.parse(savedAnnouncements);
          if (Array.isArray(parsed)) setAnnouncements(parsed);
        }

        const savedQuestions = localStorage.getItem(STORAGE_ADMIN_QUESTIONS);
        if (savedQuestions) {
          const parsedQ = JSON.parse(savedQuestions);
          if (Array.isArray(parsedQ)) setStudentQuestions(parsedQ);
        }
      } catch (err) {
        setError("Erreur lors du chargement des données administratives.");
      }
    }
  }, []);

  // Calcul automatique des frais SasPay (2,5%)
  const calculatedFee = (planAmount * SASPAY_FEE_PERCENT) / 100;
  const totalAmountToPay = Number(planAmount) + calculatedFee;

  // Publication d'une annonce officielle
  const handlePublishAnnouncement = (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!isAdmin) {
      setError("Accès refusé : Privilèges administrateur requis.");
      return;
    }

    if (typeof announcementTitle !== 'string' || typeof announcementContent !== 'string') {
      setError('Format de données invalide.');
      return;
    }

    const trimmedTitle = announcementTitle.trim();
    const trimmedContent = announcementContent.trim();

    if (!trimmedTitle || !trimmedContent) {
      setError('Veuillez remplir tous les champs de l\'annonce.');
      return;
    }

    if (trimmedTitle.length > 150 || trimmedContent.length > 2000) {
      setError('L\'annonce dépasse les limites de caractères autorisées.');
      return;
    }

    setIsLoading(true);

    try {
      const newAnnouncement = {
        id: Date.now(),
        title: sanitizeText(trimmedTitle),
        content: sanitizeText(trimmedContent),
        category: sanitizeText(announcementCategory),
        date: 'À l’instant',
        urgent: isUrgent
      };

      const updatedList = [newAnnouncement, ...announcements];
      setAnnouncements(updatedList);
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setIsUrgent(false);
      setSuccessMsg('Annonce officielle publiée avec succès !');

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_ADMIN_ANNOUNCEMENTS, JSON.stringify(updatedList));
      }
    } catch (err) {
      setError("Impossible de publier l'annonce pour le moment.");
    } finally {
      setIsLoading(false);
    }
  };

  // Réponse aux questions des étudiants
  const handleReplyQuestion = (questionId) => {
    setError(null);
    setSuccessMsg(null);

    const reply = replyText[questionId];
    if (!reply || !reply.trim()) {
      setError('La réponse ne peut pas être vide.');
      return;
    }

    try {
      const sanitizedReply = sanitizeText(reply.trim());
      const updatedQuestions = studentQuestions.map((q) =>
        q.id === questionId ? { ...q, reply: sanitizedReply } : q
      );

      setStudentQuestions(updatedQuestions);
      setSuccessMsg('Réponse transmise à l\'étudiant avec succès.');
      setReplyText({ ...replyText, [questionId]: '' });

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_ADMIN_QUESTIONS, JSON.stringify(updatedQuestions));
      }
    } catch (err) {
      setError("Erreur lors de l'enregistrement de la réponse.");
    }
  };

  // Paiement SasPay sécurisé (Abonnement officiel groupe)
  const handleSasPayCheckout = (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!validateRDCPhone(phoneNumber)) {
      setError('Numéro Mobile Money invalide. Veuillez utiliser un format RDC valide (ex: 0812345678 ou +243812345678).');
      return;
    }

    setPaymentLoading(true);

    // Simulation d'une transaction sécurisée SasPay (API Gateway)
    setTimeout(() => {
      setPaymentLoading(false);
      setSuccessMsg(`Paiement de $${totalAmountToPay.toFixed(2)} (incluant ${SASPAY_FEE_PERCENT}% de frais) initié avec succès sur le numéro ${phoneNumber}. Veuillez valider sur votre téléphone.`);
      setPhoneNumber('');
    }, 2000);
  };

  // Si l'utilisateur n'est pas admin (Barrière RBAC)
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white rounded-2xl p-8 border border-slate-100 shadow-2xl space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto font-bold text-lg">
            ⛔
          </div>
          <h1 className="text-xl font-bold text-[#0F172A]">Accès Restreint</h1>
          <p className="text-xs text-slate-500">
            Cet espace est strictement réservé au Délégué de promotion ou aux administrateurs autorisés de CampusKin.
          </p>
          <a
            href="/"
            className="inline-block w-full py-3 px-4 bg-[#2563EB] text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-500/20"
          >
            Retour au tableau de bord
          </a>
        </div>
      </div>
    );
  }

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
              <span className="text-xs text-slate-500 font-medium">Console d'Administration & Délégué</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#2563EB]">
              Mode Admin / Délégué
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
          
          {/* Colonne Principale : Publication d'Annonces & Gestion Q&A */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Formulaire de Publication d'Annonces Officielles */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-100/50">
              <h2 className="text-lg font-bold text-[#0F172A] mb-1">Publier une Annonce Officielle</h2>
              <p className="text-xs text-slate-500 mb-6">Diffusez des alertes ou informations importantes à toute la promotion.</p>

              <form onSubmit={handlePublishAnnouncement} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Titre de l'annonce</label>
                    <input
                      type="text"
                      value={announcementTitle}
                      onChange={(e) => setAnnouncementTitle(e.target.value)}
                      placeholder="Ex: Calendrier des examens"
                      maxLength={150}
                      required
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all text-[#0F172A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Catégorie</label>
                    <select
                      value={announcementCategory}
                      onChange={(e) => setAnnouncementCategory(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all text-[#0F172A]"
                    >
                      <option value="Officiel Administration">Officiel Administration</option>
                      <option value="Conférence Promotion">Conférence / Séminaire</option>
                      <option value="Rappel TP">Rappel TP / Examen</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contenu détaillé</label>
                  <textarea
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    placeholder="Saisissez le texte complet de l'annonce..."
                    rows={4}
                    maxLength={2000}
                    required
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all text-[#0F172A] resize-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUrgent}
                      onChange={(e) => setIsUrgent(e.target.checked)}
                      className="w-4 h-4 text-[#2563EB] border-slate-300 rounded focus:ring-[#2563EB]"
                    />
                    <span className="text-xs font-semibold text-slate-700">Marquer comme URGENT / Important</span>
                  </label>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="py-2.5 px-6 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading ? 'Publication...' : 'Publier l\'annonce'}
                  </button>
                </div>
              </form>
            </div>

            {/* Gestion des Questions des Étudiants (Q&A) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-100/50 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#0F172A]">Questions des Étudiants (Q&A)</h2>
                  <p className="text-xs text-slate-500">Répondez aux préoccupations envoyées par les membres de la promotion.</p>
                </div>
                <span className="text-xs font-medium bg-blue-50 text-[#2563EB] px-3 py-1 rounded-full">
                  {studentQuestions.length} message{studentQuestions.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-4">
                {studentQuestions.map((q) => (
                  <div key={q.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded">
                          {q.studentName}
                        </span>
                        <p className="text-sm font-semibold text-[#0F172A] mt-1">{q.text}</p>
                      </div>
                      <span className="text-[11px] text-slate-400">{q.date}</span>
                    </div>

                    {q.reply ? (
                      <div className="mt-2 pl-4 border-l-2 border-[#2563EB] py-1 text-xs text-slate-600 bg-white rounded-r-xl p-2">
                        <strong className="text-[#0F172A]">Votre réponse :</strong> {q.reply}
                      </div>
                    ) : (
                      <div className="pt-2 flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder="Écrire une réponse officielle..."
                          value={replyText[q.id] || ''}
                          onChange={(e) => setReplyText({ ...replyText, [q.id]: e.target.value })}
                          className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
                        />
                        <button
                          onClick={() => handleReplyQuestion(q.id)}
                          className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                        >
                          Répondre
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Colonne Latérale : Intégration SasPay (Paiement abonnement officiel groupe) */}
          <div className="space-y-8">
            
            <div className="bg-[#0F172A] text-white rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#2563EB]/30 rounded-full blur-3xl -mr-10 -mt-10"></div>
              
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#2563EB] text-white">SasPay Gateway</span>
                <span className="text-xs text-blue-300">Sécurisé RDC</span>
              </div>

              <h2 className="text-lg font-bold">Abonnement Officiel Groupe</h2>
              <p className="text-xs text-slate-300 mt-1 mb-6">
                Réglez les frais de gestion et de maintenance de la plateforme officielle de votre promotion via Mobile Money.
              </p>

              <form onSubmit={handleSasPayCheckout} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">Montant de l'abonnement (USD)</label>
                  <input
                    type="number"
                    min="1"
                    value={planAmount}
                    onChange={(e) => setPlanAmount(Number(e.target.value))}
                    required
                    className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-[#2563EB] text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">Numéro Mobile Money (RDC)</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Ex: 0812345678"
                    required
                    className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-[#2563EB] text-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Orange, M-Pesa, Airtel ou Africell acceptés.</span>
                </div>

                {/* Récapitulatif des frais calculés (2.5%) */}
                <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Montant de base :</span>
                    <span className="font-semibold">$ {Number(planAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Frais SasPay ({SASPAY_FEE_PERCENT}%) :</span>
                    <span className="font-semibold">$ {calculatedFee.toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-700 flex justify-between text-sm font-bold text-white">
                    <span>Total à régler :</span>
                    <span className="text-blue-400">$ {totalAmountToPay.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={paymentLoading}
                  className="w-full py-3 px-4 bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {paymentLoading ? (
                    <span>Traitement SasPay...</span>
                  ) : (
                    <span>Payer $ {totalAmountToPay.toFixed(2)}</span>
                  )}
                </button>
              </form>
            </div>

            {/* Statistiques rapides Admin */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-100/50 space-y-4">
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">Indicateurs de Promotion</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                  <span className="text-xs text-slate-600">Étudiants Inscrits</span>
                  <span className="text-sm font-bold text-[#0F172A]">124</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                  <span className="text-xs text-slate-600">Annonces Actives</span>
                  <span className="text-sm font-bold text-[#2563EB]">{announcements.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                  <span className="text-xs text-slate-600">Statut Financier Groupe</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">À jour</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
