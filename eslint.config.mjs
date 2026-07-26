import coreWebVitals from 'eslint-config-next/core-web-vitals'

export default [
  {
    ignores: ['node_modules/**', '.next/**', 'mobile/**', 'scripts/**', 'words/**'],
  },
  ...coreWebVitals,
  {
    rules: {
      '@next/next/no-img-element': 'warn',
      'react/no-unescaped-entities': 'off',
    },
  },
]
