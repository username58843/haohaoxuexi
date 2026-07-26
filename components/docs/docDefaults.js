/**
 * Shipped English defaults for the CMS document bodies (privacy / terms /
 * about), as Markdown. These are the fallback when no override exists for the
 * active language. Shared by the public doc pages and the /admin/content editor
 * so both start from the same baseline text.
 *
 * Admins override these per language via inline edit mode on each page or via
 * the admin content editor; an empty override restores the default below.
 */

import pkg from '~/package.json'

export const DOC_CONTACT_EMAIL = 'bobby.minecrafter06@gmail.com'
// Derived from package.json so the About page can never drift from the release.
export const DOC_APP_VERSION = pkg.version

/**
 * Shipped "Last updated" dates (ISO, UTC) for each doc — shown until an admin
 * saves an override, whose stored `updatedAt` then takes over (see the doc
 * pages + ContentContext.contentUpdatedAt). Bump when the default text changes.
 */
export const DOC_UPDATED = {
  privacy: '2026-07-27',
  terms: '2026-07-27',
  about: '2026-07-27',
}

/** Localized long-form date for the docs meta line (UTC-stable, so SSR and client agree). */
export function formatDocDate(value, locale = 'en') {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  try {
    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return d.toLocaleDateString('en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    })
  }
}

export const PRIVACY_MD = `This policy explains what information 好好学习汉语 (HaoHao XueXi, "we", "us") collects when you use our website and our Android app, why we collect it, and how you can delete it. We have tried to keep it short and honest: the service is free, shows no ads, and collects only what it needs to work.

## 1. Information we collect

When you create an account and study, we store:

- **Account information** — your email address, your display name, and your password. The password is stored only as a bcrypt hash; we never store or have access to your plain-text password.
- **Study data** — the decks and words you save, your review history and spaced-repetition progress, streaks and daily goals, and your app settings (theme, accent color, interface language, display preferences).
- **Technical data** — transient server logs created when the app communicates with our servers. These may include an IP address and browser/device identifier (user agent) and are used only for security (such as rate limiting), abuse prevention, and debugging. They are rotated and discarded automatically after a short period and are not used to build profiles.

## 2. Information we do not collect

- We do not collect your location or your contacts.
- We do not use advertising identifiers, and the apps show no ads.
- We do not embed third-party analytics or tracking SDKs.
- We do not sell your data, and we do not share it with third parties for marketing or any purpose other than the infrastructure services listed below.

## 3. How we use your information

- To operate your account and sync your data between the web and Android apps.
- To run the learning features: scheduling reviews, computing streaks, daily goals, and progress statistics.
- To keep the service secure (rate limiting, abuse prevention).
- To respond when you contact us or send feedback.

## 4. Third-party services

We rely on a small set of infrastructure providers. Each processes only what is technically necessary to provide its function:

- **MongoDB Atlas** — database hosting. Stores the account and study data described above.
- **Vercel** — application hosting. Serves the website and the API that both apps use.
- **Google Fonts** — delivers the interface and serif fonts to your browser.
- **jsDelivr CDN** — delivers the stroke-order animation library and character data.

When your device requests files from Google Fonts or jsDelivr, those services receive standard connection data such as your IP address, as with any web request. We never send them your account or study data.

## 5. Data retention

Your account and study data are kept for as long as your account exists. Transient technical logs are kept only briefly. When you delete your account, all of your personal data is removed permanently.

## 6. Deleting your account and data

You can delete your account yourself at any time:

- **Web app:** Profile → Delete account.
- **Android app:** Settings → Delete account.

Deletion is immediate and permanent: it removes your email address, name, password hash, decks, review history, progress, and settings. If you cannot access your account, email us at [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}) from the address associated with the account and we will delete it for you.

## 7. Children

The service is not directed at children under 13, and we do not knowingly collect personal information from them. If you believe a child under 13 has created an account, please contact us and we will delete it.

## 8. Security

All traffic between the apps and our servers is encrypted with HTTPS. Passwords are stored only as bcrypt hashes, and access to production data is restricted by access controls. That said, no internet service can guarantee absolute security; please use a unique password for your account.

## 9. Changes to this policy

We may update this policy from time to time. When we do, we will change the "Last updated" date at the top of this page, and for material changes we will give notice in the app or on the website. Continuing to use the service after a change means you accept the updated policy.

## 10. Contact

Questions about privacy or your data? Email [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}).`

export const TERMS_MD = `These Terms of Service ("Terms") govern your use of 好好学习汉语 (HaoHao XueXi, "the service", "we", "us"), available as a website and an Android app. By creating an account or using the service, you agree to these Terms. If you do not agree, please do not use the service.

## 1. The service

The service is a free tool for learning Chinese vocabulary. It offers spaced-repetition flashcards, quizzes, HSK 1–6 and textbook word lists, personal decks, and progress tracking, on the web and on Android. The service is provided free of charge and contains no purchases in this version.

## 2. Accounts

- You must be at least 13 years old to create an account.
- Provide accurate registration information and keep it up to date.
- One account per person; do not share accounts.
- Keep your password confidential. You are responsible for all activity under your account, and you should tell us promptly if you suspect unauthorized use.

## 3. Acceptable use

You agree not to:

- probe, breach, or attempt to bypass the service's security, or access data or accounts that are not yours;
- scrape, bulk-download, or systematically extract content from the service, or access it with automated clients beyond normal app use;
- circumvent rate limits or other technical protections;
- disrupt, overload, or interfere with the operation of the service;
- submit content that is unlawful, abusive, or infringes the rights of others — whether in decks, feedback, or anywhere else;
- impersonate another person, or resell access to the service.

## 4. Your content

The decks and other content you create remain yours. So that the service can work, you grant us a non-exclusive, worldwide, royalty-free license to store, process, back up, and display that content to you — solely for the purpose of operating and improving the service. This license ends when you delete the content or your account.

## 5. Premium

The "premium" badge is a courtesy supporter flag granted manually by administrators. There are no purchases or subscriptions in this version of the service, and the premium flag carries no entitlement: it may be changed or withdrawn at any time without notice.

## 6. Disclaimers

The service and all of its content are provided "as is" and "as available", without warranties of any kind, express or implied — including warranties of merchantability, fitness for a particular purpose, non-infringement, or that the service will be uninterrupted or error-free. Learning content may contain mistakes; it is provided for study purposes and is not professional advice.

## 7. Limitation of liability

To the maximum extent permitted by applicable law, we are not liable for any indirect, incidental, special, or consequential damages, or for loss of data, arising from your use of (or inability to use) the service. Because the service is free, our total aggregate liability for any claims relating to it is limited to the amount you have paid us for the service — which is zero. Nothing in these Terms limits liability that cannot be limited under applicable law.

## 8. Termination

You may stop using the service or delete your account at any time (see the Privacy Policy for how deletion works). We may suspend or ban accounts that violate these Terms, including permanently for serious or repeated violations. Sections that by their nature should survive termination — including sections 6, 7, and 9 — survive it.

## 9. Governing law

These Terms are governed by the laws that mandatorily apply in your country of habitual residence, and nothing in them deprives you of protections granted by those laws. Any dispute should first be raised with us informally at the contact address below; we will make a good-faith effort to resolve it.

## 10. Changes to these Terms

We may revise these Terms from time to time. When we do, we will update the "Last updated" date at the top of this page and, for material changes, give reasonable notice in the app or on the website. Continuing to use the service after a change means you accept the revised Terms.

## 11. Contact

Questions about these Terms? Email [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}).`

export const ABOUT_MD = `好好学习汉语 (HaoHao XueXi) is a free tool for learning Chinese vocabulary. It runs in the browser and as an Android app, with one account and your progress synced between the two. No ads, no tracking — just words, cards, and steady progress.

## The name

好好学习汉语 (*hǎohǎo xuéxí*) means "study well". It comes from the classic encouragement 好好学习，天天向上 (*hǎohǎo xuéxí, tiāntiān xiàngshàng*) — "study well and make progress every day". That is exactly what the app is built around: small daily sessions that add up.

## What you get

- **Spaced repetition (SRS)** — flashcards scheduled with an SM-2-style algorithm, graded Again / Hard / Good / Easy, so you review each word right before you would forget it.
- **HSK 1–6** — the complete standard vocabulary for all six levels, plus textbook word packs, with pinyin, definitions, stroke-order animations, and audio.
- **Personal decks** — collect words into your own decks, edit them freely, and import or export them.
- **Quizzes** — multiple-choice practice modes for quick self-testing.
- **Progress** — streaks, a daily goal, activity charts, and per-level mastery so you always know where you stand.

## Feedback

The app improves through the people who use it. Found a bug, missing word, or have an idea? Send feedback right from the app (More → Send feedback) or email [${DOC_CONTACT_EMAIL}](mailto:${DOC_CONTACT_EMAIL}).

## The fine print

How your data is handled is described in the Privacy Policy, and the rules of the road in the Terms of Service.

Version ${DOC_APP_VERSION}`

/** Ordered doc scopes for the admin editor. */
export const DOC_DEFAULTS = [
  { scope: 'privacy', md: PRIVACY_MD },
  { scope: 'terms', md: TERMS_MD },
  { scope: 'about', md: ABOUT_MD },
]
