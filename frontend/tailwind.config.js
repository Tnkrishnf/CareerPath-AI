const v = (n) => `rgb(var(--${n}) / <alpha-value>)`
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { bg: v('bg'), surface: v('surface'), line: v('line'), fg: v('fg'), muted: v('muted') },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      boxShadow: { glow: '0 0 40px -10px rgb(139 92 246 / 0.5)' },
    },
  },
  plugins: [],
}
