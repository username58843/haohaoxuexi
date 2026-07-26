# Google Play Data Safety Form — exact answers

Fill the Play Console "Data safety" section with the following. These answers
match the actual behavior of the app + API (see docs/ARCHITECTURE.md).

## Overview questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS only; cleartext traffic disabled) |
| Do you provide a way for users to request that their data is deleted? | **Yes** — in-app account deletion (Profile → Delete account) and by email |

## Data types collected

### Personal info
- **Email address**: Collected — Yes. Shared — No. Processed ephemerally — No.
  Required — Yes (account creation). Purpose: Account management.
- **Name**: Collected — Yes (display name, may be a pseudonym). Shared — No.
  Required — Yes. Purpose: Account management, App functionality.

### App activity
- **Other user-generated content** (personal decks, saved words): Collected — Yes.
  Shared — No. Purpose: App functionality.
- **Other actions** (study reviews, progress, streaks): Collected — Yes.
  Shared — No. Purpose: App functionality.

### App info and performance
- Not collected (no crash-reporting or analytics SDKs are bundled).

### Device or other IDs
- Not collected.

## NOT collected (leave unchecked)

Location, financial info, health, contacts, photos/videos, audio, files,
calendar, browsing history, search history outside the app, installed apps,
advertising IDs.

## Security practices section

- Data is encrypted in transit: Yes (TLS).
- Users can request data deletion: Yes.
- Passwords are stored hashed (bcrypt); raw passwords never persisted.

## Account deletion URL (required by Play policy)

Point the "Account deletion" policy field to: `https://haohaoxuexi.vercel.app/privacy`
(the policy describes both in-app deletion and the email path).
