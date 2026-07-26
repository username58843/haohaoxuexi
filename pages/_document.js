import { Html, Head, Main, NextScript } from 'next/document'

/**
 * Pre-paint boot script: applies saved theme + accent before first paint.
 * Mirrors lib/contexts/SettingsContext (localStorage key xue_settings_v2).
 */
const themeBootScript = `
(function () {
  try {
    var colors = {
      cinnabar: '#e0533d', orange: '#ff9500', gold: '#eab308', jade: '#34c759',
      blue: '#0a84ff', violet: '#af52de', pink: '#ff2d55', cyan: '#5ac8fa'
    };
    var aliases = { red: 'cinnabar', yellow: 'gold', green: 'jade', purple: 'violet' };
    var s = {};
    try { s = JSON.parse(localStorage.getItem('xue_settings_v2') || '{}') || {}; } catch (e) {}
    var theme = s.theme === 'light' || s.theme === 'dark' ? s.theme
      : s.theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light'
      : 'dark';
    var colorKey = aliases[s.themeColor] || s.themeColor;
    var hex = colors[colorKey] || colors.jade;
    var m = /^#([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
    var r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--accent-rgb', r + ', ' + g + ', ' + b);
    var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    root.style.setProperty('--on-accent', lum > 0.6 ? '#1a1a1a' : '#ffffff');
    if (s.language) root.lang = s.language;
  } catch (e) {}
})();
`

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/logo-32.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo-180.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0e1113" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#f7f5f0" media="(prefers-color-scheme: light)" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&family=JetBrains+Mono:wght@400;500&family=Noto+Serif+SC:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
