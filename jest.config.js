/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/$1'
  },
  testMatch: ['**/__tests__/**/*.test.js'],
  transform: {
    '^.+\\.js$': ['babel-jest', {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
    }]
  },
  transformIgnorePatterns: ['/node_modules/(?!node-fetch)'],
}
