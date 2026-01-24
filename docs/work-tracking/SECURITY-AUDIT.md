# Security Rules Audit Report

**Date:** 2026-01-21
**Audited Files:** `firestore.rules`, `storage.rules`

---

## Executive Summary

The security rules have several **CRITICAL** vulnerabilities that should be addressed. The most serious is that the `players` collection (containing PINs) is publicly readable. Additionally, several collections allow unrestricted writes that could be exploited.

---

## CRITICAL Issues (Fix Immediately)

### 1. Players Collection Exposes PINs
**Location:** `firestore.rules:11-15`
```
match /players/{playerId} {
  allow read: if true;  // <-- PROBLEM: Anyone can read PINs
  allow write: if false;
}
```

**Risk:** Anyone can query the players collection and retrieve all player data including 8-digit login PINs. This is an authentication bypass vulnerability.

**Recommendation:**
- Remove PIN from client-readable fields OR
- Add a cloud function to handle PIN lookups without exposing the PIN field OR
- Use Firebase Auth instead of custom PIN authentication

---

### 2. Streaming Sessions Fully Open
**Location:** `firestore.rules:335-342`
```
match /streaming_sessions/{sessionId} {
  allow read, write: if true;  // <-- FULLY OPEN
}
match /streaming_sessions/{sessionId}/{subcollection}/{docId} {
  allow read, write: if true;  // <-- FULLY OPEN
}
```

**Risk:** Anyone can create, modify, or delete streaming sessions. Could be used for spam, DoS, or malicious content injection.

**Recommendation:** Require some form of player identification even if not full auth.

---

### 3. FCM Tokens Fully Open
**Location:** `firestore.rules:379-387`
```
match /fcm_tokens/{tokenId} {
  allow read: if true;
  allow write: if true;  // <-- ANYONE CAN WRITE
}
match /players/{playerId}/fcm_tokens/{tokenId} {
  allow read, write: if true;  // <-- ANYONE CAN MANAGE ANY PLAYER'S TOKENS
}
```

**Risk:**
- Anyone can read all FCM tokens (privacy issue)
- Anyone can write/delete FCM tokens for any player (could disable notifications or add spam tokens)

**Recommendation:** Restrict writes to cloud functions only. Use player session validation.

---

### 4. Dart Trader Listings - Anyone Can Delete
**Location:** `firestore.rules:359-368`
```
match /dart_trader_listings/{listingId} {
  allow delete: if true;  // <-- ANYONE CAN DELETE ANY LISTING
}
```

**Risk:** Any user can delete any marketplace listing. Griefing vulnerability.

**Recommendation:** Change to `allow delete: if false;` (cloud function only) or validate seller_id matches.

---

## HIGH Priority Issues

### 5. Presence Heartbeats - User Impersonation
**Location:** `firestore.rules:227-230`
```
match /presence_heartbeats/{playerId} {
  allow read: if true;
  allow write: if true;  // <-- ANYONE CAN SET ANY PLAYER'S PRESENCE
}
```

**Risk:** Anyone can set any player's online/offline status. Could be used for social engineering or harassment.

**Recommendation:** The `{playerId}` in the path should be validated against the requesting user's identity.

---

### 6. Typing Indicators - Spoofable
**Location:** `firestore.rules:208-211`
```
match /chat_rooms/{roomId}/typing/{playerId} {
  allow read: if true;
  allow write: if true;  // <-- ANYONE CAN SET ANY PLAYER'S TYPING STATUS
}
```

**Risk:** Anyone can make it appear that any player is typing in any chat room.

**Recommendation:** Same as presence - validate playerId against requesting user.

---

## MEDIUM Priority Issues

### 7. No Authentication on Create Rules
**Locations:** Multiple

| Collection | Validation |
|------------|------------|
| `tournaments` | Only `hasValidData()` |
| `tournaments/.../registrations` | `player_name != null` |
| `registrations` | Only `hasValidData()` |
| `leagues` | Only `hasValidData()` |
| `leagues/.../registrations` | Only `hasValidData()` |
| `league_registrations` | Only `hasValidData()` |
| `community_events` | `name`, `event_date`, `event_link` required |
| `dart_trader_listings` | `seller_id`, `title`, `price` required |

**Risk:** Registration spam, fake tournament/league creation, fake marketplace listings.

**Recommendation:** Add rate limiting via cloud functions or require a valid player_id that exists in the players collection.

---

### 8. Storage Uploads - No Authentication
**Location:** `storage.rules:11-46`

All storage paths allow unauthenticated uploads with only size (5MB) and content-type (image/*) validation.

**Risk:** Storage spam, inappropriate content uploads.

**Recommendation:** Route uploads through cloud functions with player validation, or implement content moderation.

---

## Collection Protection Summary

### Properly Protected (write: false)
| Collection | Read | Write | Notes |
|------------|------|-------|-------|
| admin_sessions | false | false | Good |
| login_attempts | false | false | Good |
| notifications_queue | false | false | Good |
| message_notifications | false | false | Good |
| bots | true | false | OK |
| events | true | false | OK |
| matches | true | false | OK |
| All league subcollections | true | false | OK |
| All tournament subcollections (except registrations) | true | false | OK |
| conversations | true | false | OK |
| chat_rooms | true | false | OK |
| cheers | true | false | OK |
| challenges | true | false | OK |
| online_matches | true | false | OK |
| mini_tournaments | true | false | OK |

### Partially Open (create allowed)
| Collection | Read | Create | Update/Delete | Validation |
|------------|------|--------|---------------|------------|
| tournaments | true | Yes | false | hasValidData() |
| registrations | true | Yes | false | hasValidData() |
| leagues | true | Yes | false | hasValidData() |
| tournament registrations | true | Yes | false | player_name required |
| league registrations | true | Yes | false | hasValidData() |
| community_events | true | Yes | false | name, date, link required |
| dart_trader_listings | true | Yes | owner only | seller_id, title, price required |

### OPEN (read + write: true)
| Collection | Risk Level |
|------------|------------|
| streaming_sessions | CRITICAL |
| streaming_sessions subcollections | CRITICAL |
| fcm_tokens | CRITICAL |
| players/.../fcm_tokens | CRITICAL |
| presence_heartbeats | HIGH |
| chat_rooms/.../typing | HIGH |

---

## Priority Fix Order

1. **IMMEDIATE:** Secure `players` collection - PINs are exposed
2. **IMMEDIATE:** Change `dart_trader_listings` delete to false
3. **HIGH:** Restrict `fcm_tokens` to cloud functions only
4. **HIGH:** Restrict `streaming_sessions` (at minimum require some identifier)
5. **MEDIUM:** Add validation to `presence_heartbeats` and `typing` writes
6. **MEDIUM:** Add rate limiting/validation to create rules
7. **LOW:** Add authentication to storage uploads

---

## Notes

- The app uses PIN-based authentication (not Firebase Auth), which limits the ability to use `request.auth` in rules
- Cloud functions bypass rules, so backend operations are secure
- The primary attack surface is direct Firestore API calls from malicious clients
- Consider implementing a session token system that can be validated in rules
