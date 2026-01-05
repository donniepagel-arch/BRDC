# BRDC Tournament System - Complete Deployment Package

## What's Included

This package contains your complete BRDC dart tournament management system, converted from Google Apps Script to Firebase/Cloudflare Pages.

### ✅ Ready to Deploy

1. **Scorers** (100% Complete)
   - `/public/scorers/x01.html` - 501/301/701 scorer with all features
   - `/public/scorers/cricket.html` - Complete cricket scorer

2. **Public Pages** (Firebase-Converted)
   - `/public/bracket.html` - Real-time bracket display

3. **Shared Resources**
   - `/public/css/brdc-styles.css` - BRDC brand styling
   - `/public/js/firebase-config.js` - Firebase initialization

4. **Cloud Functions** (Backend)
   - `/functions/index.js` - Main exports
   - `/functions/tournaments/create.js` - Tournament creation
   - (More functions ready to add)

### 🚀 Quick Deploy

#### Option 1: Deploy to Cloudflare Pages (Frontend Only)

```bash
# From your Windows machine
cd C:\Users\gcfrp\brdc-firebase

# Copy all files from this package to your repo
xcopy /E /I BRDC-COMPLETE-PACKAGE\public public
xcopy /E /I BRDC-COMPLETE-PACKAGE\functions functions

# Push to GitHub
git add .
git commit -m "Complete BRDC system deployment"
git push origin main
```

Scorers will be live at:
- https://brdc-pages.pages.dev/scorers/x01.html
- https://brdc-pages.pages.dev/scorers/cricket.html

#### Option 2: Deploy Cloud Functions (Backend)

```bash
# Install Firebase CLI if needed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy functions
cd functions
npm install
cd ..
firebase deploy --only functions
```

#### Option 3: Full Deploy (Everything)

```bash
firebase deploy
```

### 📁 Project Structure

```
BRDC-COMPLETE-PACKAGE/
├── public/                    # Frontend (Cloudflare Pages)
│   ├── index.html            # (You'll create landing page)
│   ├── bracket.html          # ✅ Real-time bracket
│   ├── css/
│   │   └── brdc-styles.css   # ✅ Shared BRDC styling
│   ├── js/
│   │   └── firebase-config.js # ✅ Firebase setup
│   └── scorers/
│       ├── x01.html          # ✅ 501/301/701 scorer
│       └── cricket.html      # ✅ Cricket scorer
├── functions/                 # Backend (Firebase)
│   ├── index.js              # ✅ Main exports
│   ├── package.json          # ✅ Dependencies
│   └── tournaments/
│       └── create.js         # ✅ Create tournament
├── firebase.json             # ✅ Firebase config
├── firestore.rules           # ✅ Security rules
├── firestore.indexes.json    # ✅ Database indexes
└── .firebaserc               # ✅ Project config
```

### 🔧 Next Steps

1. **Test the scorers** - They work 100% standalone
2. **Deploy bracket page** - Real-time updates via Firestore
3. **Add remaining pages** - Use conversion guide
4. **Deploy Cloud Functions** - Enable backend features
5. **Test end-to-end** - Full tournament flow

### 📊 Status

- ✅ Scorers: 100% Complete
- ✅ Firebase Config: Complete
- ✅ BRDC Styling: Complete
- ✅ Public Bracket: Complete
- ⏳ Tournament Creation: Need to add page
- ⏳ Director Dashboard: Need to add page
- ⏳ Registration: Need to add page
- ⏳ League System: Need to add pages

### 🎯 URLs After Deploy

- Scorers: `https://brdc-pages.pages.dev/scorers/x01.html`
- Bracket: `https://brdc-pages.pages.dev/bracket.html?tournament_id=xxx`
- Functions: `https://us-central1-brdc-1e428.cloudfunctions.net/createTournament`

All set! Deploy and test the scorers, then we'll add the remaining pages.
