module.exports = {
  purge: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  darkMode: false, // или 'media' для поддержки тёмной темы через prefers-color-scheme
  theme: {
    extend: {
      colors: {
        'apple-dark': '#1C2526',
        'apple-gray': '#2D3A3A',
        'apple-text': '#F5F5F7',
        'apple-accent': '#0A84FF',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
        mono: ['Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
