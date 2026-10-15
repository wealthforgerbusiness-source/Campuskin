// src/app/layout.js
'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import AppGate from '../components/AppGate';

const NAV = [
  {
    href: '/',
    label: 'Accueil',
    icon: (
      <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h4.5v-5h4v5h4.5V10" />
    ),
  },
  {
    href: '/notes',
    label: 'Notes',
    icon: (
      <>
        <path d="M5 4h10l4 4v12H5z" />
        <path d="M14 4v5h5M8.5 13h7M8.5 16.5h5" />
      </>
    ),
  },
  {
    href: '/groupes',
    label: 'Groupes',
    icon: (
      <>
        <circle cx="9" cy="9" r="3" />
        <circle cx="17" cy="10" r="2.4" />
        <path d="M3.5 19c.5-3 2.7-4.8 5.5-4.8s5 1.8 5.5 4.8M15 14.6c2.6-.3 4.8 1 5.5 3.9" />
      </>
    ),
  },
  {
    href: '/admin',
    label: 'Admin',
    icon: (
      <>
        <path d="M12 3 4.5 6v5.5c0 4.5 3.1 7.8 7.5 9.5 4.4-1.7 7.5-5 7.5-9.5V6z" />
        <path d="m9 12 2.2 2.2L15.5 10" />
      </>
    ),
  },
];

function BottomNav() {
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    NAV.findIndex((n) => (n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)))
  );

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-[#0F172A]/95 p-1.5 shadow-[0_20px_50px_-10px_rgba(15,23,42,.7)] ring-1 ring-white/10 backdrop-blur-xl">
        {/* Indicateur glissant */}
        <span
          aria-hidden
          className="absolute top-1.5 bottom-1.5 left-1.5 rounded-xl bg-[#2563EB] shadow-[0_8px_24px_-6px_rgba(37,99,235,.9)] transition-transform duration-300 ease-[cubic-bezier(.3,1.3,.5,1)]"
          style={{
            width: `calc((100% - 0.75rem) / ${NAV.length})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
        <ul className="relative grid grid-cols-4">
          {NAV.map((item, i) => {
            const active = i === activeIndex;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="flex flex-col items-center gap-0.5 rounded-xl py-2.5 transition-transform active:scale-90"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-[22px] w-[22px] fill-none stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round] transition-colors duration-300 ${
                      active ? 'stroke-white' : 'stroke-white/50'
                    }`}
                  >
                    {item.icon}
                  </svg>
                  <span
                    className={`text-[10px] font-medium uppercase tracking-wider transition-colors duration-300 ${
                      active ? 'text-white' : 'text-white/50'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-0 z-[120] overflow-hidden bg-[#2563EB] text-center text-[11px] font-medium uppercase tracking-widest text-white transition-all duration-300 ${
        offline ? 'max-h-10 py-2 opacity-100' : 'max-h-0 py-0 opacity-0'
      }`}
    >
      Mode hors-ligne · tes notes restent disponibles
    </div>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <title>CampusKin · Ta vie d'étudiant, simplifiée</title>
        <meta
          name="description"
          content="CampusKin : notes, budget CDF/USD, annonces et groupes de promotion pour les étudiants de Kinshasa."
        />

        {/* Mobile & PWA */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0F172A" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="CampusKin" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />

        {/* Partage sur les réseaux sociaux */}
        <meta property="og:title" content="CampusKin" />
        <meta
          property="og:description"
          content="Notes, budget, annonces et groupes de ta promotion, au même endroit."
        />
        <meta property="og:image" content="/logo.png" />
        <meta property="og:type" content="website" />

        {/* Police */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="bg-white text-[#0F172A] antialiased"
        style={{
          fontFamily:
            "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <OfflineBanner />
        <AppGate nav={<BottomNav />}>{children}</AppGate>
      </body>
    </html>
  );
}
