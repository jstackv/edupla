module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand — dark orange. Replaces the old indigo scale so any
        // remaining `primary-*` utility classes (spinners, badges, buttons
        // on pages that hadn't been hand-converted yet) resolve to the
        // same dark-orange brand as the rest of the app instead of indigo.
        primary: {
          50:  '#fed7aa',
          100: '#fdba74',
          200: '#fb923c',
          300: '#f97316',
          400: '#ea580c',
          500: '#c2410c',
          600: '#9a3412',
          700: '#7c2d12',
          800: '#431407',
          900: '#2a0c03',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'slide-up':  'slide-up 0.25s ease both',
        'scale-in':  'scale-in 0.2s ease both',
        'fade-in':   'fade-in 0.2s ease both',
      },
      keyframes: {
        'slide-up':  { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'scale-in':  { from: { opacity: 0, transform: 'scale(0.95)' },       to: { opacity: 1, transform: 'scale(1)' } },
        'fade-in':   { from: { opacity: 0 },                                  to: { opacity: 1 } },
      },
    },
  },
  plugins: [],
};
