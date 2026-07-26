import React from 'react'
import Head from 'next/head'
import AppShell from '~/components/AppShell'
import DocsLayout from '~/components/docs/DocsLayout'
import { useSettings } from '~/lib/contexts/SettingsContext'

const CONTACT_EMAIL = 'bobby.minecrafter06@gmail.com'

/** Public privacy policy for the web app and the Android app. */
export default function PrivacyPage() {
  const { t } = useSettings()
  const title = t('docsPrivacyTitle', 'Privacy Policy')

  return (
    <AppShell>
      <Head>
        <title>{`${title} · 好好学习`}</title>
        <meta
          name="description"
          content="Privacy Policy for 好好学习 (HaoHao XueXi): what data the web and Android apps collect, how it is stored and protected, and how to delete your account and data."
        />
      </Head>

      <DocsLayout title={title} current="privacy">
        <p className="docs__lede">
          This policy explains what information{' '}
          <span className="hanzi" lang="zh">
            好好学习
          </span>{' '}
          (HaoHao XueXi, “we”, “us”) collects when you use our website and our
          Android app, why we collect it, and how you can delete it. We have
          tried to keep it short and honest: the service is free, shows no ads,
          and collects only what it needs to work.
        </p>

        <h2>1. Information we collect</h2>
        <p>When you create an account and study, we store:</p>
        <ul>
          <li>
            <strong>Account information</strong> — your email address, your
            display name, and your password. The password is stored only as a
            bcrypt hash; we never store or have access to your plain-text
            password.
          </li>
          <li>
            <strong>Study data</strong> — the decks and words you save, your
            review history and spaced-repetition progress, streaks and daily
            goals, and your app settings (theme, accent color, interface
            language, display preferences).
          </li>
          <li>
            <strong>Technical data</strong> — transient server logs created
            when the app communicates with our servers. These may include an IP
            address and browser/device identifier (user agent) and are used
            only for security (such as rate limiting), abuse prevention, and
            debugging. They are rotated and discarded automatically after a
            short period and are not used to build profiles.
          </li>
        </ul>

        <h2>2. Information we do not collect</h2>
        <ul>
          <li>We do not collect your location or your contacts.</li>
          <li>We do not use advertising identifiers, and the apps show no ads.</li>
          <li>We do not embed third-party analytics or tracking SDKs.</li>
          <li>
            We do not sell your data, and we do not share it with third parties
            for marketing or any purpose other than the infrastructure services
            listed below.
          </li>
        </ul>

        <h2>3. How we use your information</h2>
        <ul>
          <li>To operate your account and sync your data between the web and Android apps.</li>
          <li>
            To run the learning features: scheduling reviews, computing streaks,
            daily goals, and progress statistics.
          </li>
          <li>To keep the service secure (rate limiting, abuse prevention).</li>
          <li>To respond when you contact us or send feedback.</li>
        </ul>

        <h2>4. Third-party services</h2>
        <p>
          We rely on a small set of infrastructure providers. Each processes
          only what is technically necessary to provide its function:
        </p>
        <ul>
          <li>
            <strong>MongoDB Atlas</strong> — database hosting. Stores the
            account and study data described above.
          </li>
          <li>
            <strong>Vercel</strong> — application hosting. Serves the website
            and the API that both apps use.
          </li>
          <li>
            <strong>Google Fonts</strong> — delivers the interface and serif
            fonts to your browser.
          </li>
          <li>
            <strong>jsDelivr CDN</strong> — delivers the stroke-order animation
            library and character data.
          </li>
        </ul>
        <p>
          When your device requests files from Google Fonts or jsDelivr, those
          services receive standard connection data such as your IP address, as
          with any web request. We never send them your account or study data.
        </p>

        <h2>5. Data retention</h2>
        <p>
          Your account and study data are kept for as long as your account
          exists. Transient technical logs are kept only briefly. When you
          delete your account, all of your personal data is removed permanently.
        </p>

        <h2>6. Deleting your account and data</h2>
        <p>You can delete your account yourself at any time:</p>
        <ul>
          <li>
            <strong>Web app:</strong> Profile → Delete account.
          </li>
          <li>
            <strong>Android app:</strong> Settings → Delete account.
          </li>
        </ul>
        <p>
          Deletion is immediate and permanent: it removes your email address,
          name, password hash, decks, review history, progress, and settings.
          If you cannot access your account, email us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the
          address associated with the account and we will delete it for you.
        </p>

        <h2>7. Children</h2>
        <p>
          The service is not directed at children under 13, and we do not
          knowingly collect personal information from them. If you believe a
          child under 13 has created an account, please contact us and we will
          delete it.
        </p>

        <h2>8. Security</h2>
        <p>
          All traffic between the apps and our servers is encrypted with HTTPS.
          Passwords are stored only as bcrypt hashes, and access to production
          data is restricted by access controls. That said, no internet service
          can guarantee absolute security; please use a unique password for
          your account.
        </p>

        <h2>9. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. When we do, we will
          change the “Last updated” date at the top of this page, and for
          material changes we will give notice in the app or on the website.
          Continuing to use the service after a change means you accept the
          updated policy.
        </p>

        <h2>10. Contact</h2>
        <p>
          Questions about privacy or your data? Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </DocsLayout>
    </AppShell>
  )
}
