/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pink: {
          DEFAULT: 'var(--pink)',
          light: 'var(--pink-light)',
          mid: 'var(--pink-mid)',
          pale: 'var(--pink-pale)',
          tint: 'var(--pink-tint)',
          border: 'var(--pink-border)',
          label: 'var(--pink-label)',
        },
        plum: {
          dark: 'var(--plum-dark)',
          mid: 'var(--plum-mid)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          mid: 'var(--ink-mid)',
          muted: 'var(--ink-muted)',
        },
        green: {
          DEFAULT: 'var(--green)',
          light: 'var(--green-light)',
          border: 'var(--green-border)',
          text: 'var(--green-text)',
        },
        amber: {
          DEFAULT: 'var(--amber)',
          light: 'var(--amber-light)',
          text: 'var(--amber-text)',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        ui: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: 'var(--r-card)',
        input: 'var(--r-input)',
        badge: 'var(--r-badge)',
        sheet: 'var(--r-sheet)',
        pill: 'var(--r-pill)',
      },
      backgroundImage: {
        'grad-pink': 'var(--grad-pink)',
        'grad-hero': 'var(--grad-hero)',
        'grad-action': 'var(--grad-action)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        fab: 'var(--shadow-fab)',
      },
    },
  },
  plugins: [],
};
