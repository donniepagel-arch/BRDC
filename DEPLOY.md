# BRDC Deploy

This project deploys to Firebase project `brdc-v2`.

## Canonical Targets

- Hosting: `brdc-v2`
- Functions: `brdc-v2`
- Custom domain: `burningriverdarts.com`

## Standard Deploy Commands

```bash
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy
```

## Pre-Deploy Checks

1. Confirm `.firebaserc` still targets `brdc-v2`.
2. Confirm `public/js/firebase-config.js` points to `brdc-v2`.
3. Confirm no pages still reference old Cloud Functions hosts.
4. Confirm `firebase.json` rewrites match the intended live routes.
5. Confirm local function secrets are present in `functions/.env` or the intended managed environment source before a Functions deploy.

## Current Routing Model

- `/` -> `public/index.html`
- app routes like `/dashboard`, `/events`, `/messages`, `/league`, `/login` rewrite through `firebase.json`
- frontend calls Cloud Functions directly at the `us-central1-brdc-v2.cloudfunctions.net` surface or via the Firebase client SDK

## Local Function Secrets

Local development and targeted deploy verification currently expect environment values in `functions/.env`.

Do not commit:

- `functions/.env`
- `functions/service-account-key.json`

Use:

- [functions\.env.example](E:\projects\brdc-firebase\functions\.env.example)

to document required keys without storing live values in the repo.

## Historical Note

Older references to Cloudflare Pages, package-based deploys, or other Firebase project ids should be treated as stale unless explicitly validated.
