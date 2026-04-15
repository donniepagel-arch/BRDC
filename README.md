# BRDC Firebase App

BRDC is a Firebase-hosted web app backed by Firebase Cloud Functions, Firestore, Auth, and Storage.

## Current Stack

- Hosting: `brdc-v2`
- Frontend root: `public/`
- Backend: `functions/`
- Live Firebase site: `https://brdc-v2.web.app`
- Custom domain: `https://burningriverdarts.com`

## Important Structure

- `public/index.html`: marketing + login entry
- `public/pages/`: app surfaces such as dashboard, events, league, messaging, scorers
- `public/js/firebase-config.js`: canonical client Firebase config
- `functions/index.js`: Cloud Functions entrypoint
- `firebase.json`: Hosting rewrites and deploy config

## Deploy

Frontend and backend both deploy through Firebase:

```bash
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy
```

## Notes

- Older docs in this repo may still mention Cloudflare Pages or earlier Firebase projects. Treat those as historical unless they explicitly reference `brdc-v2`.
- The canonical Cloud Functions base is `https://us-central1-brdc-v2.cloudfunctions.net`.
