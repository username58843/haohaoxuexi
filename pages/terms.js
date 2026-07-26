import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import AppShell from '~/components/AppShell'
import DocsLayout from '~/components/docs/DocsLayout'
import { useSettings } from '~/lib/contexts/SettingsContext'

const CONTACT_EMAIL = 'bobby.minecrafter06@gmail.com'

/** Public terms of service for the web app and the Android app. */
export default function TermsPage() {
  const { t } = useSettings()
  const title = t('docsTermsTitle', 'Terms of Service')

  return (
    <AppShell>
      <Head>
        <title>{`${title} · 好好学习`}</title>
        <meta
          name="description"
          content="Terms of Service for 好好学习 (HaoHao XueXi), the free Chinese vocabulary learning app: accounts, acceptable use, your content, disclaimers, and contact."
        />
      </Head>

      <DocsLayout title={title} current="terms">
        <p className="docs__lede">
          These Terms of Service (“Terms”) govern your use of{' '}
          <span className="hanzi" lang="zh">
            好好学习
          </span>{' '}
          (HaoHao XueXi, “the service”, “we”, “us”), available as a website and
          an Android app. By creating an account or using the service, you
          agree to these Terms. If you do not agree, please do not use the
          service.
        </p>

        <h2>1. The service</h2>
        <p>
          The service is a free tool for learning Chinese vocabulary. It offers
          spaced-repetition flashcards, quizzes, HSK 1–6 and textbook word
          lists, personal decks, and progress tracking, on the web and on
          Android. The service is provided free of charge and contains no
          purchases in this version.
        </p>

        <h2>2. Accounts</h2>
        <ul>
          <li>You must be at least 13 years old to create an account.</li>
          <li>
            Provide accurate registration information and keep it up to date.
          </li>
          <li>One account per person; do not share accounts.</li>
          <li>
            Keep your password confidential. You are responsible for all
            activity under your account, and you should tell us promptly if you
            suspect unauthorized use.
          </li>
        </ul>

        <h2>3. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>
            probe, breach, or attempt to bypass the service’s security, or
            access data or accounts that are not yours;
          </li>
          <li>
            scrape, bulk-download, or systematically extract content from the
            service, or access it with automated clients beyond normal app use;
          </li>
          <li>circumvent rate limits or other technical protections;</li>
          <li>disrupt, overload, or interfere with the operation of the service;</li>
          <li>
            submit content that is unlawful, abusive, or infringes the rights
            of others — whether in decks, feedback, or anywhere else;
          </li>
          <li>impersonate another person, or resell access to the service.</li>
        </ul>

        <h2>4. Your content</h2>
        <p>
          The decks and other content you create remain yours. So that the
          service can work, you grant us a non-exclusive, worldwide,
          royalty-free license to store, process, back up, and display that
          content to you — solely for the purpose of operating and improving
          the service. This license ends when you delete the content or your
          account.
        </p>

        <h2>5. Premium</h2>
        <p>
          The “premium” badge is a courtesy supporter flag granted manually by
          administrators. There are no purchases or subscriptions in this
          version of the service, and the premium flag carries no entitlement:
          it may be changed or withdrawn at any time without notice.
        </p>

        <h2>6. Disclaimers</h2>
        <p>
          The service and all of its content are provided “as is” and “as
          available”, without warranties of any kind, express or implied —
          including warranties of merchantability, fitness for a particular
          purpose, non-infringement, or that the service will be uninterrupted
          or error-free. Learning content may contain mistakes; it is provided
          for study purposes and is not professional advice.
        </p>

        <h2>7. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by applicable law, we are not liable
          for any indirect, incidental, special, or consequential damages, or
          for loss of data, arising from your use of (or inability to use) the
          service. Because the service is free, our total aggregate liability
          for any claims relating to it is limited to the amount you have paid
          us for the service — which is zero. Nothing in these Terms limits
          liability that cannot be limited under applicable law.
        </p>

        <h2>8. Termination</h2>
        <p>
          You may stop using the service or delete your account at any time
          (see the <Link href="/privacy">Privacy Policy</Link> for how deletion
          works). We may suspend or ban accounts that violate these Terms,
          including permanently for serious or repeated violations. Sections
          that by their nature should survive termination — including sections
          6, 7, and 9 — survive it.
        </p>

        <h2>9. Governing law</h2>
        <p>
          These Terms are governed by the laws that mandatorily apply in your
          country of habitual residence, and nothing in them deprives you of
          protections granted by those laws. Any dispute should first be raised
          with us informally at the contact address below; we will make a
          good-faith effort to resolve it.
        </p>

        <h2>10. Changes to these Terms</h2>
        <p>
          We may revise these Terms from time to time. When we do, we will
          update the “Last updated” date at the top of this page and, for
          material changes, give reasonable notice in the app or on the
          website. Continuing to use the service after a change means you
          accept the revised Terms.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions about these Terms? Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </DocsLayout>
    </AppShell>
  )
}
