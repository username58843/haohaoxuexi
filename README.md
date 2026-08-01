# 好好学习 — HaoHao XueXi

Chinese-vocabulary learning platform: **web app + REST API** (Next.js 16, MongoDB)
and a **Flutter Android app**, sharing one backend.

Learn all ~5000 HSK 1–6 words with an SM-2 spaced-repetition system, quizzes,
personal decks, streaks and per-level progress. Free, no ads.

## Repository layout

```
/            Next.js app — web UI + /api/v1 REST API (deploys to Vercel)
/mobile      Flutter Android app (Play-Store-ready, see docs/RELEASE_CHECKLIST.md)
/words       Word packs (HSK 1–6 + 29 textbook packs, served via the API)
/docs        Architecture contract, design system, store documents
/scripts     smoke.mjs — end-to-end API test against an in-memory MongoDB
```

## Features

- **SRS reviews** — SM-2 scheduling (Again/Hard/Good/Easy), due queue, server-side
  progress that syncs between web and Android
- **Quizzes** — 4 directions (字↔pinyin, 字↔meaning), instant feedback, mistake retry
- **HSK lexicon** — browse/search 5000 words, mark known, stroke-order animation,
  browser TTS
- **Personal decks** — create, edit, JSON/CSV import/export
- **Progress** — daily goal, streaks, 14-day activity, per-level mastery bars
- **Admin console** — metrics dashboard, user management (ban/premium/roles) with
  audit log, feedback inbox
- **4 UI languages** (en/ru/tk/zh) · dark/light themes · 8 accent colors · PWA

## Quick start (web)

```bash
npm install
cp .env.example .env.local     # fill MONGODB_URI + JWT_SECRET
npm run dev                    # http://localhost:3000
```

First admin: register through the UI, then in MongoDB run
`db.users.updateOne({email:'you@…'}, {$set:{role:'admin'}})` — there are
deliberately no hardcoded admin accounts.

## Quick start (Android)

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=https://your-deployment.example
```

Release build & Play submission: see `docs/RELEASE_CHECKLIST.md`.
Firebase (Analytics + Crashlytics + push): see `docs/FIREBASE_SETUP.md` —
the app builds and runs fine without it.

## Testing

```bash
npm test               # unit tests (SRS scheduler, validators, word ids)
npm run build          # production build
node scripts/smoke.mjs # full API smoke test (in-memory MongoDB, ~60 checks)
npx eslint pages components lib
cd mobile && flutter analyze
```

## Architecture

The single source of truth is [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md):
data model (users, decks, srs_cards, review_logs, feedback, audit_logs),
the full `/api/v1` endpoint table, auth (JWT HS256 + tokenVersion revocation,
httpOnly cookie for web / Bearer for mobile), the SRS algorithm, and the
security invariants. The visual language lives in [`docs/DESIGN.md`](docs/DESIGN.md).

Environment variables: `MONGODB_URI`, `JWT_SECRET`, `APP_URL` (see `.env.example`).

## License

MIT
