# BRDC Google Cloud Suspension Remediation - 2026-04-28

## Incident

Google suspended project `brdc-v2` / `726670872282` for activity consistent with credential hijacking.

## Actions Completed

- Deleted user-managed Firebase Admin SDK service account key:
  - Service account: `firebase-adminsdk-fbsvc@brdc-v2.iam.gserviceaccount.com`
  - Key ID: `fc63950fe2ec4bdd27885aa4147098b7517085c6`
- Deleted unrestricted API key:
  - Display name: `Gemini-Elder`
  - UID: `e152fe73-f1ef-4256-9ab8-7d878e98d540`
- Restricted Firebase browser API key:
  - UID: `aa4ae589-49b1-4aaa-a1e6-9fd8fdf20c62`
  - Allowed referrers:
    - `https://burningriverdarts.com/*`
    - `https://www.burningriverdarts.com/*`
    - `https://brdc-v2.web.app/*`
    - `https://brdc-v2.firebaseapp.com/*`
    - `http://localhost/*`
    - `http://localhost:*/*`
    - `http://127.0.0.1/*`
    - `http://127.0.0.1:*/*`
- Confirmed all service accounts are currently disabled by Google:
  - `brdc-v2@appspot.gserviceaccount.com`
  - `726670872282-compute@developer.gserviceaccount.com`
  - `firebase-adminsdk-fbsvc@brdc-v2.iam.gserviceaccount.com`
- Confirmed no Compute Engine VMs are listable in the suspended project.
- Removed repo-local Claude permission entries that referenced Admin SDK credential paths.

## Remaining Google Action Needed

Reply to the Google suspension notice / submit appeal requesting project reinstatement after credential revocation and API key restriction.

