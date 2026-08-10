# Release Checklist

## Backend + Web (Vercel)

1. MongoDB Atlas: create cluster + database user; allow Vercel egress
   (`0.0.0.0/0` or Vercel IP ranges).
2. Vercel project → Environment variables:
   - `MONGODB_URI` (with database name in the path)
   - `JWT_SECRET` (48+ random bytes — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
   - `APP_URL` (the production origin, e.g. `https://haohaoxuexi.vercel.app`)
3. `npm run build` locally — must be green.
4. `npm test` — must be green.
5. Deploy. Verify `/api/v1/health` returns `{ok:true}`.
6. Register the first account, then promote it to admin **once** via MongoDB:
   ```js
   db.users.updateOne({ email: 'you@example.com' }, { $set: { role: 'admin' } })
   ```
   (There is deliberately no hardcoded admin — this is the only bootstrap step.)
7. Smoke test: register → learn session → review → dashboard streak → admin panel.

## Android (Play Store)

1. One-time: create the upload keystore (see `mobile/android/key.properties.example`),
   put `upload-keystore.jks` in `mobile/android/`, create `key.properties`.
   **Back the keystore up — losing it means losing the ability to update the app.**
2. Set the production API URL and build the bundle:
   ```bash
   cd mobile
   flutter build appbundle --release --dart-define=API_BASE_URL=https://haohaoxuexi.vercel.app
   ```
   Output: `build/app/outputs/bundle/release/app-release.aab`.
3. Play Console → create app (`cn.haohaoxuexi.chinese`), fill:
   - Store listing from `docs/store/PLAY_STORE_LISTING.md`
   - Data safety from `docs/store/DATA_SAFETY.md`
   - Content rating questionnaire (Everyone)
   - Privacy policy URL → `https://haohaoxuexi.vercel.app/privacy`
   - App access: provide a test account (create one specifically for review)
4. Upload the `.aab` to Internal testing first; test on a real device.
5. Promote to Production; roll out gradually (20% → 100%).

## Versioning

- Web: `package.json` version.
- Android: `mobile/pubspec.yaml` `version: X.Y.Z+N` — bump `N` (versionCode)
  for EVERY Play upload, `X.Y.Z` for user-visible releases.
