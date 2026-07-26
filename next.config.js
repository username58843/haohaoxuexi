const path = require('path');

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // lib/server/words.js reads words/*.json with fs at runtime; static tracing
  // can't see the dynamic path, so force-include the packs in the serverless
  // bundle (without this, word packs 500 on Vercel).
  outputFileTracingIncludes: {
    '/api/**/*': ['./words/*.json'],
  },
  // Prevent Next/Turbopack from picking a parent lockfile as workspace root
  turbopack: {
    root: __dirname,
    resolveAlias: {
      '~': __dirname,
      '~/*': './*',
    },
  },
  sassOptions: {
    includePaths: [path.join(__dirname, 'styles')],
    quietDeps: true,
    silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
  },
  webpack: (config) => {
    config.resolve.alias['~'] = path.resolve(__dirname);
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
