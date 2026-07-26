import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx)
    return { ...initialProps }
  }

  render() {
    // Apply saved theme before first paint (avoids blue flash)
    const themeBootScript = `
      (function () {
        try {
          var map = {
            red: '#ff3b30',
            orange: '#ff9500',
            yellow: '#ffcc00',
            green: '#34c759',
            blue: '#007AFF',
            purple: '#af52de',
            pink: '#ff2d55',
            cyan: '#5ac8fa'
          };
          var key = localStorage.getItem('themeColor') || 'blue';
          var color = map[key] || map.blue;
          var m = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(color);
          var r = m ? parseInt(m[1], 16) : 0;
          var g = m ? parseInt(m[2], 16) : 122;
          var b = m ? parseInt(m[3], 16) : 255;
          var rgb = r + ', ' + g + ', ' + b;
          var lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          var onAccent = lum > 0.62 ? '#0a0a0a' : '#ffffff';
          var root = document.documentElement;
          root.style.setProperty('--theme-color', color);
          root.style.setProperty('--theme-color-rgb', rgb);
          root.style.setProperty('--accent', color);
          root.style.setProperty('--on-accent', onAccent);
          root.style.setProperty('--accent-soft', 'rgba(' + rgb + ', 0.16)');
          root.style.setProperty('--accent-glow', 'rgba(' + rgb + ', 0.35)');
          root.style.setProperty('--body-glow', 'rgba(' + rgb + ', 0.1)');
          root.setAttribute('data-theme', key);
        } catch (e) {}
      })();
    `

    return (
      <Html lang="ru">
        <Head>
          <meta charSet="utf-8" />
          <link rel="icon" href="/logo-32.png" type="image/png" />
          <link rel="apple-touch-icon" href="/logo-180.png" />
          <meta name="theme-color" content="#0f1517" media="(prefers-color-scheme: dark)" />
          <meta name="theme-color" content="#f8faf3" media="(prefers-color-scheme: light)" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          {/*
            Inter + Noto Sans → Russian UI only
            Noto Serif SC → Songti-style web font when system Songti SC / SimSun missing
          */}
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans:wght@400;500;600;700&family=Noto+Serif+SC:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
          <style
            dangerouslySetInnerHTML={{
              __html: `
                .hanzi, [lang="zh"], [lang="zh-CN"], [lang="zh-Hans"],
                .hsk-vis__cell-hanzi, .hsk-vis-modal__hanzi,
                .word-detail-hanzi, .dict-word-hanzi, .selected-word-hanzi,
                .landing-preview__char, .landing-hero__title-grad,
                .landing-nav__mark, .landing .hanzi,
                .product-mark__glyph, .auth-page__brand,
                .study-prompt__main:not(.study-prompt__main--latin):not(.study-prompt__main--def),
                .study-answer__text.hanzi, .mistake-row__hanzi {
                  font-family: "Songti SC", "STSong", "SimSun", "NSimSun", "宋体", "Noto Serif SC", serif !important;
                  font-synthesis: none !important;
                }
              `,
            }}
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
}

export default MyDocument
