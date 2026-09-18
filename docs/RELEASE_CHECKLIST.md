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
   From the repository root, verify every supported architecture before upload:
   ```bash
   python3 scripts/verify-android-artifact.py mobile/build/app/outputs/bundle/release/app-release.aab
   ```
   For direct downloads, use `flutter build apk --release` (without
   `--split-per-abi`) and verify `mobile/build/app/outputs/flutter-apk/app-release.apk`
   with the same script. Never redistribute only `base.apk` extracted from
   an AAB: its ABI split can contain **all** native libraries. Install AABs
   through Play/bundletool, not an APK extractor. The native launcher checks
   both base and installed split APKs before starting Flutter and displays
   localized recovery instructions if `libflutter.so` is missing. It cannot
   restore a missing engine; the packaging check is the release safeguard.
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
