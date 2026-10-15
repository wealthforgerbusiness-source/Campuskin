import './globals.css';

export const metadata = {
  title: 'CampusKin - L\'Université dans votre poche',
  description: 'Plateforme SaaS et PWA dédiée aux étudiants et délégués de promotion à Kinshasa. Gestion des résumés, annonces et finances.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#2563EB',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className="h-full">
      <body className="h-full bg-white text-[#0F172A] flex flex-col justify-between antialiased selection:bg-[#2563EB] selection:text-white">
        
        {/* Contenu principal de l'application */}
        <div className="flex-1 pb-20 md:pb-0">
          {children}
        </div>

        {/* Barre de navigation mobile inférieure (Style PWA / SaaS) */}
        <nav aria-label="Navigation principale" className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-lg md:hidden">
          <div className="grid grid-cols-4 h-16 px-2">
            
            {/* Accueil */}
            <a
              href="/"
              className="flex flex-col items-center justify-center space-y-1 text-slate-500 hover:text-[#2563EB] transition-colors"
            >
              <span className="text-lg">🏠</span>
              <span className="text-[10px] font-semibold tracking-tight">Accueil</span>
            </a>

            {/* Notes */}
            <a
              href="/notes"
              className="flex flex-col items-center justify-center space-y-1 text-slate-500 hover:text-[#2563EB] transition-colors"
            >
              <span className="text-lg">📝</span>
              <span className="text-[10px] font-semibold tracking-tight">Notes</span>
            </a>

            {/* Groupes */}
            <a
              href="/groupes"
              className="flex flex-col items-center justify-center space-y-1 text-slate-500 hover:text-[#2563EB] transition-colors"
            >
              <span className="text-lg">👥</span>
              <span className="text-[10px] font-semibold tracking-tight">Groupes</span>
            </a>

            {/* Admin */}
            <a
              href="/admin"
              className="flex flex-col items-center justify-center space-y-1 text-slate-500 hover:text-[#2563EB] transition-colors"
            >
              <span className="text-lg">⚙️</span>
              <span className="text-[10px] font-semibold tracking-tight">Admin</span>
            </a>

          </div>
        </nav>

        {/* Pied de page discret (Visible sur écrans desktop) */}
        <footer className="hidden md:block bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400">
          <p>© 2026 CampusKin — L'Université dans votre poche. Tous droits réservés.</p>
        </footer>

      </body>
    </html>
  );
}
