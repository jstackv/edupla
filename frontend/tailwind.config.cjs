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
          50:  '#ffedd5',
          100: '#fed7aa',
          200: '#fdba74',
          300: '#fb923c',
          400: '#f97316',
          500: '#ea580c',
          600: '#c2410c',
          700: '#9a3412',
          800: '#7c2d12',
          900: '#431407',
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
