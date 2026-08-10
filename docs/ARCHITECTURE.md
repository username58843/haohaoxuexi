# HaoHao XueXi (好好学习) — Architecture Contract

This document is the single source of truth for the rebuilt platform. All code (web,
API, mobile) must follow these contracts exactly.

## 1. Product

Chinese-vocabulary learning platform for HSK 1–6 plus textbook packs and personal
decks. Web app (Next.js) and Android app (Flutter) consume the same REST API.
Free product; `premium` is an admin-granted supporter flag (no billing in v1).

Core loop: **browse words → collect into decks → study (SRS flashcards + quizzes)
→ track progress (streak, daily goal, per-level mastery)**.

## 2. Repository layout

```
/                  Next.js 16 app (Pages Router) — web + API. Deploys to Vercel.
/mobile            Flutter Android app (own pubspec; excluded via .vercelignore)
/docs              Product & store documents
/words             Word-pack JSON data (server-side only — NOT bundled client-side)
/lib/server        Server-only modules (db, api middleware, models, srs, words)
/lib/i18n          UI translations (en inline-default; ru/tk/zh override files)
/components/ui     Design-system components
/styles            SCSS: tokens → base → components → per-page partials
```

## 3. Data model (MongoDB)

Database from `MONGODB_URI`. All collections indexed by `lib/server/db.js`
(`ensureIndexes()` runs lazily once per process).

### users
```js
{
  _id: ObjectId,
  email: string,            // lowercase, unique index
  password: string,         // bcrypt hash (cost 12)
  name: string,
  role: 'user' | 'admin',   // NO hardcoded admin emails. Promote via admin UI/DB.
  isPremium: bool, premiumExpiresAt: Date|null,
  isBanned: bool, banReason: string|null, bannedAt: Date|null,
  tokenVersion: int,        // bump to revoke all JWTs (ban, password change)
  emailVerified: bool,      // login requires true (403 email_not_verified)
  verifyCode: string|null, verifyExpires: Date|null,  // 6-digit email code
  resetToken: string|null, resetExpires: Date|null,   // password-reset link
  settings: { themeColor, language, dailyGoal, alwaysShowPinyin,
              alwaysShowTranslation, quizSpeakOnCorrect,
              theme: 'dark'|'light'|'system' },
              // theme default is 'system' (OS auto-detect on every launch);
              // schemaVersion 3 lazily migrated legacy 'dark' → 'system'.
              // quizSpeakOnCorrect defaults to false — opt-in quiz audio,
              // account-scoped so it survives sessions and devices.
  lastSeen: Date, createdAt: Date, updatedAt: Date,
  // legacy fields may still exist (personalDictionaries, selectedWords,
  // searchHistory, isAdmin, avatar, ipAddress, studyStats) — migrated lazily by
  // lib/server/users.js#migrateLegacyUser on login/me, then $unset.
}
```

### decks  (personal decks — moved OUT of the user document)
```js
{
  _id: ObjectId,
  userId: ObjectId,         // index { userId: 1, order: 1 }
  name: string,             // 1..80 chars
  words: [WordSnapshot],    // ≤ 2000 items, each validated (see §5 Word)
  order: int,
  createdAt, updatedAt
}
```

### srs_cards  (per-user per-word SRS state)
```js
{
  _id: ObjectId,
  userId: ObjectId,
  wordId: string,           // canonical word id, see §5. unique {userId, wordId}
  word: WordSnapshot,       // denormalized for review without pack lookup
  state: 'new'|'learning'|'review',
  ease: double,             // starts 2.5, min 1.3
  intervalDays: double,     // 0 while learning
  due: Date,                // UTC. index { userId: 1, due: 1 }
  reps: int, lapses: int,
  createdAt, updatedAt
}
```

### review_logs  (one doc per user per local day — streaks, goals, charts)
```js
{
  userId: ObjectId, day: 'YYYY-MM-DD',   // unique {userId, day}
  reviews: int, correct: int, newCards: int,
  updatedAt
}
```
"Local day" is computed server-side from the client-supplied `tzOffset`
(minutes east of UTC, i.e. JS `-new Date().getTimezoneOffset()`).

### known_words  (word-map mastery set, synced web ⇄ Android)
```js
{ userId: ObjectId,        // unique index
  ids: [string],           // canonical word ids, capped at 30000
  updatedAt: Date }
```
Deleted with the account (`deleteUserCompletely`). Clients cache the set
**per account** — `xue_known_v2:<userId>` in localStorage,
`known_words_v1:<userId>` in SharedPreferences — with the signed-out bucket
(the bare key) consumed on the first login that claims it. A single shared
bucket used to leak marks into whichever account signed in next, since it
outlived logout and account deletion.

### pack_overrides  (admin edits of textbook packs)
```js
{ packId: string,          // unique index; textbook pack ids only
  title?: string,          // 1..80
  words?: [Word],          // full replacement content (validated, ≤ 5000)
  updatedAt: Date, updatedBy: ObjectId }
```

### feedback
```js
{ userId: ObjectId|null, email: string|null, topic: 'bug'|'idea'|'content'|'other',
  message: string (1..2000), status: 'new'|'seen'|'done', createdAt,
  userAgent: string|null }
```

### audit_logs  (admin actions)
```js
{ actorId: ObjectId, action: string, targetUserId: ObjectId|null,
  detail: object, createdAt }   // index { createdAt: -1 }
```

### rate_limits
```js
{ key: string, count: int, expiresAt: Date }  // TTL index on expiresAt, unique key
```

## 4. API — `/api/v1/*`

Legacy `/api/*` routes are REMOVED except where noted. Web and mobile both use v1.

### Conventions
- JSON only. Success: `2xx` with payload. Error: `{ error: { code, message } }`
  with proper HTTP status. `code` is a stable machine string (`invalid_credentials`,
  `rate_limited`, `validation`, `unauthorized`, `forbidden`, `not_found`, `banned`,
  `conflict`, `server_error`).
- Every route is built with `createApiHandler` from `lib/server/api.js`:
  method map, optional auth (`auth: true` / `admin: true`), optional rate limit,
  body validation, unified error handling, security headers. No hand-rolled CORS —
  same-origin for web; mobile uses Bearer (CORS irrelevant); the handler sets
  `Access-Control-Allow-Origin` only for `APP_URL`.
- Auth: JWT HS256 **algorithm-pinned**, payload `{ uid, tv }` (user id, tokenVersion),
  30-day expiry. Transport: `Authorization: Bearer` (mobile/web) or httpOnly cookie
  `token` (web). **Never** from query string. Cookie: `HttpOnly; Path=/;
  SameSite=Lax; Secure(prod); Max-Age=30d`.
- Auth middleware loads the user, rejects banned (`403 banned`) and stale
  `tv` (`401 unauthorized`), attaches `req.user`, updates `lastSeen` (throttled).
- All user-supplied strings type-checked (reject non-string / operator objects
  — NoSQL-injection guard lives in the validator).

### Endpoints

| Route | Methods | Auth | Notes |
|---|---|---|---|
| `/api/v1/auth/register` | POST | – | `{email, password≥8, name 2..40, captchaToken, lang?}`; Turnstile; RL 5/15min/IP; generic `email_taken`; sends a 6-digit verify code and returns `{ok, email}` — NO session until verify-email |
| `/api/v1/auth/login` | POST | – | `{email, password, captchaToken}`; Turnstile; RL 8/15min per IP and per email; generic `invalid_credentials`; unverified → 403 `email_not_verified`; banned → 403 `{error, banReason}` |
| `/api/v1/auth/logout` | POST | – | clears cookie |
| `/api/v1/auth/verify-email` | POST | – | `{email, code(6 digits)}`; RL 10/hour/email; success → `{user, token}` + cookie (the account's first session) |
| `/api/v1/auth/send-verification` | POST | – | `{email}`; RL 3/hour/email; always `{ok}` (no enumeration) |
| `/api/v1/auth/forgot-password` | POST | – | `{email, captchaToken}`; Turnstile; RL 3/hour/email; always `{ok}` (no enumeration); reset link valid 1h |
| `/api/v1/auth/reset-password` | POST | – | `{token, password≥8}`; RL 10/hour/IP; bad/expired token → 400 `invalid_token` |
| `/api/v1/auth/me` | GET | ✓ | `{user}` (public shape, §6); triggers legacy migration |
| `/api/v1/account` | DELETE | ✓ | `{password}` confirm → deletes user + decks + srs + logs. Play-Store requirement |
| `/api/v1/user/profile` | PUT | ✓ | `{name 2..40}` |
| `/api/v1/user/password` | PUT | ✓ | `{currentPassword, newPassword≥8}`; bumps tokenVersion; returns fresh token |
| `/api/v1/user/settings` | GET/PUT | ✓ | whitelist + value-validate every key (§3 users.settings) |
| `/api/v1/words/packs` | GET | – | `[{id, title, group:'hsk'|'textbook', count}]` — registry of built-in packs |
| `/api/v1/words` | GET | – | `?pack=hsk1` → `{items:[Word]}` (whole pack, cached, ETag) |
| `/api/v1/words/search` | GET | – | `?q=&level=1..7 (7 = band 7-9)&page=&limit≤100` → `{items,total,page,pages}`; RL 60/min/IP |
| `/api/v1/words/known` | GET/PUT/DELETE | ✓ | known-words sync: GET → `{ids, updatedAt}`; PUT `{add?≤2000, remove?≤2000}` delta-merges atomically (deltas commute — offline devices converge), RL 120/min/user; DELETE drops the whole set ("clear known words" in settings), RL 10/min/user |
| `/api/v1/decks` | GET/POST | ✓ | GET → `{decks}`; POST `{name, words?}` (≤50 decks) |
| `/api/v1/decks/[id]` | GET/PUT/DELETE | ✓ | own-scoped; PUT `{name?, words?, order?}` word-shape validated |
| `/api/v1/srs/queue` | GET | ✓ | `?limit=0..500 (0 = all, capped 500)&packs=hsk1,hsk2` → `{cards:[SrsCard], dueCount, newCount}` — due first, then new from selected packs not yet in srs. Textbook packs resolve admin overrides |
| `/api/v1/srs/review` | POST | ✓ | `{wordId, grade:0..3, word?, tzOffset}` → `{card}` upserts card, applies SM-2 (§7), bumps review_logs |
| `/api/v1/srs/summary` | GET | ✓ | `?tzOffset=` → `{dueCount, todayReviews, todayCorrect, streak, bestStreak, goal, byState:{new,learning,review}, byLevel:{1..6:{total,seen,mature}}}` |
| `/api/v1/srs/difficult` | GET | ✓ | `?limit=20 (1..100)&minLapses=2 (1..20)` → `{items:[card], total, minLapses}` — leech list, sorted lapses desc, ease asc, updatedAt desc |
| `/api/v1/stats/activity` | GET | ✓ | `?days=42 (1..365)&tzOffset=` → `{days:[{day, reviews, correct}]}` |
| `/api/v1/feedback` | POST | opt | `{topic, message, email?}`; RL 5/hour + 20/day per verified user (or IP when anonymous) |
| `/api/v1/content` | GET | – | `?lang=` → `{entries, meta}` — published copy overrides for the docs pages |
| `/api/v1/health` | GET | – | `{ok, ts}` — uptime probe |
| `/api/v1/admin/overview` | GET | admin | `{totals:{users,newUsers7d,activeToday,decks,reviews7d}, signupsByDay[14], reviewsByDay[14]}` |
| `/api/v1/admin/users` | GET | admin | `?q=&page=&limit≤50&filter=banned|premium|admin` — paginated, **public-safe fields only** (no hashes) |
| `/api/v1/admin/users/[id]` | GET/PUT/DELETE | admin | PUT whitelist `{role?, isPremium?, premiumExpiresAt?, isBanned?, banReason?}`; guards: cannot ban/demote/delete self; cannot demote last admin; ban bumps tokenVersion; all writes → audit_logs |
| `/api/v1/admin/feedback` | GET/PUT | admin | list + `{id, status}` |
| `/api/v1/admin/content` | GET/PUT | admin | read all copy overrides / upsert or remove one entry (audited) |
| `/api/v1/admin/packs` | GET | admin | pack registry with override status (textbook packs editable, HSK read-only) |
| `/api/v1/admin/packs/[id]` | GET/PUT/DELETE | admin | textbook-pack editor: PUT `{title?, words?}` upserts a pack_override (the UI can build `words` from a JSON/CSV import); DELETE restores the shipped JSON. All writes audited; the in-process overrides cache (30s TTL) is invalidated |
| `/api/v1/admin/audit` | GET | admin | paginated audit log |

Removed entirely: `/api/search/*` (external proxies), `/api/lexicon` (→ v1/words),
`/api/dictionaries/*` (→ v1/decks), selected-words (folded into deck editor UX).

## 5. Words

### Canonical word id
`wordId = simplified + '·' + pinyinKey` where `pinyinKey` = pinyin lowercased,
tone marks kept, all whitespace/apostrophes removed (e.g. `爱·ài`, `爸爸·bàba`).
Implemented once in `lib/words-shared.js` (`makeWordId`) — imported by server and
web client; ported identically in Flutter.

### Word / WordSnapshot shape
```js
{ simplified: string, traditional: string, pinyin: string,
  definitions: string[],            // primary gloss lines (language-tagged by pack)
  translations: { en?: string[], ru?: string[], tk?: string[] },  // optional
  example: { zh, py?, en?, ru?, tk? } | undefined,  // one simple sentence
  hsk: int|null (1..7, 7 = band 7-9), strokes: int|null, radicals: string|null }
```
Deck-stored snapshots keep only: simplified, traditional, pinyin, definitions,
translations, example (validated, each string ≤ 200 chars).

### Packs
`lib/server/words.js` reads `/words/*.json` at first use (fs, cached), exposes:
`getPacks()` (registry with titles), `getPack(id)`, `searchWords(q, level, page,
limit)` (scored: exact hanzi > prefix > substring > pinyin > meaning).
HSK packs: `hsk1..hsk6` plus `hsk7-9` (the official HSK 3.0 band 7–9 list —
one combined 七–九级 pack, `hsk: 7` internally, labeled "7–9" in every UI).
Textbook packs keep their file names as ids with human titles in the registry;
admins can rename/replace them via `pack_overrides` (getPacksResolved /
getPackWordsResolved merge overrides with a 30s in-process cache). Known data fixes applied at load: `p.inyin` key in
tk.json, `sim以前` key in tluy.json, HSK `traditional` field equals simplified
(display code must not pretend otherwise).

Client NEVER bundles `/words` — always via API (ETag/immutable cache headers).

## 6. Public user shape (returned by API)

```js
{ id, email, name, role, isPremium, premiumExpiresAt, isBanned,
  settings, createdAt }
```
Never expose: password, tokenVersion, other users' emails except to admin.

## 7. SRS algorithm (SM-2 variant)

Grades: 0 Again · 1 Hard · 2 Good · 3 Easy.
```
new card:            state=learning, ease=2.5, interval=0, due=now
learning + Again:    due = now + 10min
learning + Hard:     due = now + 30min
learning + Good/Easy → state=review, interval = (grade==3 ? 3 : 1) day
review + Again:  lapses++, ease=max(1.3, ease-0.2), state=learning, due=now+10min
review + Hard:   interval = max(interval*1.2, interval+0.5), ease=max(1.3, ease-0.15)
review + Good:   interval = interval * ease
review + Easy:   interval = interval * ease * 1.3, ease += 0.15
interval cap 365d; due = now + interval. Multiple-choice quiz auto-grades:
correct-first-try → 2 (Good), wrong → 0 (Again). Flashcards use all 4 buttons.
```
Streak: consecutive local days with `reviews ≥ 1` ending today or yesterday.
Goal met: `todayReviews ≥ settings.dailyGoal` (default 20).

## 8. Web app

- Pages Router, JS (not TS), SCSS design system (`docs/DESIGN.md`). No Bootstrap,
  no reactstrap — removed from package.json.
- Shell: authenticated users get app chrome — bottom dock (mobile) / left rail
  (desktop ≥1024px). Tabs: Home `/`, Learn `/learn`, Decks `/decks`,
  HSK `/hsk`, More `/more`. Guests see marketing landing on `/`.
- Route map: `/` (landing|dashboard), `/auth` (+ `/auth/forgot-password`,
  `/auth/reset-password`), `/learn` (hub) + `/learn/session`, `/hsk` (lexicon
  browse + word sheet) + `/hsk/map` (word map), `/decks` + `/decks/[id]`,
  `/stats` (6-month review heatmap + difficult-words leech list), `/profile`,
  `/settings`, `/more`, `/about`, `/privacy`, `/terms`, `/admin` (+ subpages
  users/feedback/audit/content). Per-page `<Head>` titles.
- i18n: `lib/i18n` — `t('key', 'English default')`; ru/tk/zh in override maps.
  `document.documentElement.lang` synced to UI language.
- Auth client: cookie is primary; Bearer kept in memory only (NOT localStorage);
  on load, session restored via cookie `/auth/me`.
- Word audio: browser `speechSynthesis` (zh-CN voice) — no server proxy.
- Stroke order: hanzi-writer from CDN (existing pattern), lazy-loaded.
- PWA: `public/manifest.json` + icons + theme color.

## 9. Flutter app (`/mobile`)

- Flutter 3.x, Dart 3, Material 3. State: `flutter_riverpod`. HTTP: `dio`.
  Router: `go_router`. Secure token store: `flutter_secure_storage`.
- Base URL via `--dart-define=API_BASE_URL=...` (default `https://haohaoxuexi.tech`).
- Screens: Splash → Onboarding (3 slides) → Auth (+ email verify code,
  forgot/reset password); Home (streak, due, goal ring, quick start,
  difficult-words link); Learn (session builder: packs, size, question modes);
  Study (SRS flashcards with 4 grade buttons + MCQ quiz modes);
  HSK browser (packs bundled as assets for offline browse) + word map;
  Difficult words (`GET /srs/difficult` leech list); Decks
  (list/detail/create/edit); Profile & Settings (accent color, language,
  daily goal, opt-in daily review reminder, delete account, privacy/terms
  links); About.
- Firebase (Analytics + Crashlytics + FCM) is optional: the Gradle plugins
  apply only when `android/app/google-services.json` exists and the Dart side
  no-ops without it (`lib/core/firebase_bootstrap.dart`, docs/FIREBASE_SETUP.md).
- Daily review reminder: local notification via `flutter_local_notifications`
  (inexact alarms, no exact-alarm permission), device-local settings — never
  mirrored to `PUT /user/settings` (`lib/core/reminders.dart`).
- Design mirrors web tokens (§ DESIGN.md): dark ink canvas, vermilion accent,
  Songti-class serif for hanzi (Noto Serif SC), Manrope-class UI font.
- Android: `applicationId cn.haohaoxuexi.chinese`, minSdk 23, targetSdk 35,
  versionCode/Name managed in `pubspec.yaml`; release signing via
  `android/key.properties` (gitignored, template provided); ProGuard on;
  permissions: INTERNET, POST_NOTIFICATIONS (FCM + reminder),
  RECEIVE_BOOT_COMPLETED (re-arm the reminder after reboot); cleartext
  traffic disabled.

## 10. Security invariants

1. No hardcoded credentials/emails/roles anywhere.
2. All auth-mutating flows rate-limited via Mongo TTL buckets.
3. JWT: pinned HS256, tokenVersion checked, never in URLs or localStorage.
4. Every input validated for type, length, and range before touching the DB.
5. Admin routes double-checked server-side; destructive admin actions audited.
6. API responses never include password hashes or other users' PII (non-admin).
7. Error messages never leak internals (`error.message` from exceptions is logged,
   not returned).
8. Security headers on all responses: `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`.
