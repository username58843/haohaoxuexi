const path = require('path');

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prevent Next/Turbopack from picking a parent lockfile as workspace root
  turbopack: {
    root: __dirname,
    resolveAlias: {
      '~': __dirname,
      '~/*': './*',
    },
  },
  // Bootstrap SCSS + modern dart-sass need explicit include paths
  sassOptions: {
    includePaths: [
      path.join(__dirname, 'node_modules'),
      path.join(__dirname, 'node_modules/bootstrap/scss'),
      path.join(__dirname, 'styles'),
    ],
    quietDeps: true,
    silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
  },
  assetPrefix: process.env.BASE_URL || '',
  env: {
    base: process.env.BASE_URL || ''
  },
  webpack: (config) => {
    config.resolve.alias['~'] = path.resolve(__dirname);
    return config;
  },
  async headers() {
    return [
      {
        // Allow Android app and other clients to access API
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, Cookie' },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
