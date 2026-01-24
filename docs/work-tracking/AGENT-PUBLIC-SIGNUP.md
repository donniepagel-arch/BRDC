# Public Landing Page and Signup Flow

**Date:** 2026-01-24
**Agent:** Terminal Coder
**Status:** Complete - Ready for Deployment

---

## Summary

Created a public landing page for BRDC and a complete user signup flow. Previously, the homepage was just a login wall - new visitors had no way to learn about the club or sign up.

---

## Changes Made

### 1. Updated index.html - Public Landing Page

**File:** `public/index.html`

Added the following sections:
- **Navigation bar** - Fixed header with logo, feature links, and login button
- **Hero section** - Full-viewport splash with animated logo, tagline, and CTA buttons
- **Features section** - 4 cards highlighting League Play, Tournaments, Live Scoring, and Stats Tracking
- **Active Leagues section** - Dynamic loading of leagues from Firestore with status indicators
- **Login section** - Existing PIN login functionality preserved with smooth scroll anchor
- **Footer** - Links to scorer and browse events

Key features:
- Smooth scroll behavior for anchor links
- Responsive design (nav collapses on mobile)
- Loading animation for leagues
- Welcome back detection for returning users
- Existing session handling preserved

### 2. Created signup.html - New Player Registration

**File:** `public/pages/signup.html`

Registration form fields:
- First Name (required)
- Last Name (required)
- Email (required)
- Phone (optional)
- Skill Level dropdown (A/B/C/Not Sure)

Features:
- Phone number auto-formatting as user types
- Form validation with field-specific error highlighting
- Loading state during submission
- Success screen showing generated PIN
- Auto-login after registration (saves session to localStorage)
- PIN warning to save their code

### 3. Created registerNewPlayer Cloud Function

**File:** `functions/global-auth.js` (added to existing file)

New functions added:
- `generateUniqueFullPin()` - Creates random 8-digit PIN when no phone provided
- `registerNewPlayer()` - Main registration endpoint

Function behavior:
- Validates required fields (first_name, last_name, email)
- Checks for existing accounts by email and phone
- If phone provided: uses phone-based PIN (last 4 + random 4)
- If no phone: uses fully random 8-digit PIN
- Creates player document in `/players/{id}`
- Sends welcome email with PIN
- Sends SMS if phone provided
- Logs registration in notifications collection
- Returns success with player_id and PIN

Endpoint: `https://us-central1-brdc-v2.cloudfunctions.net/registerNewPlayer`

---

## Files Modified

| File | Change |
|------|--------|
| `public/index.html` | Redesigned as full landing page with hero, features, leagues sections |
| `public/pages/signup.html` | **NEW** - Player registration page |
| `functions/global-auth.js` | Added `registerNewPlayer` and `generateUniqueFullPin` functions |

---

## Testing Notes

1. **Landing Page:**
   - Visit `/` or `/index.html`
   - Should see hero section, scroll down to features
   - Active leagues load dynamically from Firestore
   - Login section at bottom with PIN input

2. **Signup Flow:**
   - Click "Join BRDC" from hero or "Sign up here" from login section
   - Fill form (email required, phone optional)
   - Submit creates account and shows PIN
   - Session saved automatically for dashboard redirect

3. **Cloud Function:**
   - POST to `/registerNewPlayer` with JSON body
   - Required: `first_name`, `last_name`, `email`
   - Optional: `phone`, `preferred_level`
   - Returns: `{ success: true, player_id: "...", pin: "12345678" }`

---

## Deployment Required

**Frontend (hosting):**
```bash
firebase deploy --only hosting
```

**Backend (functions):**
```bash
firebase deploy --only functions
```

---

## Notes

- The `registerNewPlayer` function is automatically exported via `Object.assign(exports, globalAuthFunctions)` in `functions/index.js`
- Existing `registerPlayerSimple` function (requires phone) left unchanged
- Email sending uses existing `sendWelcomeEmail` helper
- SMS sending uses existing `sendWelcomeSMS` helper
