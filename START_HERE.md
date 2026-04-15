# Start Here

If you are working on BRDC today, assume this is the current truth:

- This repo is the active BRDC Firebase app.
- Firebase project: `brdc-v2`
- Hosting config: `firebase.json`
- Client config: `public/js/firebase-config.js`
- Backend entrypoint: `functions/index.js`

## First Files To Read

1. `firebase.json`
2. `public/js/firebase-config.js`
3. `functions/index.js`
4. the specific page under `public/pages/` you are changing
5. `docs/STANDING-AUTHORIZATION-WORKFLOW.md`
6. `docs/MARKDOWN-FILING-MAP.md`
7. `docs/REPO-INVENTORY-2026-04-08.md`

## Do Not Assume

- old Cloudflare Pages deployment docs are current
- old Firebase project ids are valid
- historical work-tracking docs describe the live deployment exactly

## Practical Rule

If a file disagrees with `brdc-v2`, `firebase.json`, or `public/js/firebase-config.js`, treat that file as suspect until verified.
