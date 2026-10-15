// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
    './src/lib/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        night: '#0F172A',   // Bleu nuit
        royal: {
          DEFAULT: '#2563EB', // Bleu roi
          dark: '#1d4ed8',
          soft: '#60a5fa',
        },
        pure: '#FFFFFF',    // Blanc pur
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 20px 50px -20px rgba(15,23,42,.35)',
        glow: '0 10px 30px -8px rgba(37,99,235,.8)',
      },
      screens: {
        xs: '380px',
      },
    },
  },
  plugins: [],
};
