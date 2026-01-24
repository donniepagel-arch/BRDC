# Cloud Functions Audit Report

**Generated:** 2026-01-21
**Last Verified:** 2026-01-21 (automated audit)
**Project:** brdc-firebase

---

## Summary

This audit identifies all cloud functions exported in `functions/index.js` and cross-references them against frontend usage to identify unused/legacy code.

### Statistics
- **Total Exported Functions:** ~140
- **Functions Called from Frontend:** ~120
- **Potentially Unused Functions:** ~20 (most are admin utilities)
- **Disabled Modules:** 6

### CRITICAL FINDING
**The `phase-5-6-7.js` file is marked as "legacy" in index.js (line 105) but IS ACTIVELY USED by the frontend.** Despite the misleading comment, these functions are critical to the application and should NOT be removed. The "legacy" comment should be removed or clarified.

---

## Disabled Modules (TEMPORARILY DISABLED)

These modules are commented out in `functions/index.js` due to firebase-functions v2 scheduler incompatibility:

| Module | File | Reason |
|--------|------|--------|
| notifications | `notifications.js` | v2 scheduler incompatible |
| message-digest | `message-digest.js` | v2 scheduler incompatible |
| online-play | `online-play.js` | v2 scheduler incompatible |
| advanced-features | `advanced-features.js` | v2 scheduler incompatible |
| stats-unification | `stats-unification.js` | v2 scheduler incompatible |
| push-notifications | `push-notifications.js` | v2 scheduler incompatible |

**Recommendation:** Keep disabled. Re-enable when migrating to Firebase Functions v2 with proper scheduler support.

---

## Active Functions (Called from Frontend)

### Tournament Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `createTournament` | tournaments.js | create-tournament.html |
| `generateBracket` | tournaments.js | director-dashboard.html |
| `submitMatchResult` | tournaments.js | director-dashboard.html, league-501.html, league-cricket.html |
| `addBotToTournament` | tournaments.js | director-dashboard.html |
| `updateTournamentSettings` | tournaments.js | director-dashboard.html, matchmaker-director.html |
| `deleteTournament` | tournaments.js | director-dashboard.html |
| `registerForTournament` | phase-5-6-7.js | tournament-view.html |

### League Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `createLeague` | phase-5-6-7.js | create-league.html |
| `registerForLeague` | phase-5-6-7.js | league-view.html |
| `verifyLeaguePin` | leagues/index.js | league-view.html, league-director.html |
| `getTeams` | leagues/index.js | league-director.html |
| `getSchedule` | leagues/index.js | league-director.html, player-profile.html |
| `getStandings` | leagues/index.js | league-director.html |
| `getLeaderboards` | leagues/index.js | league-director.html |
| `getPlayers` | leagues/index.js | league-director.html |
| `addPlayer` | leagues/index.js | league-director.html |
| `updatePlayer` | leagues/index.js | league-director.html |
| `deletePlayer` | leagues/index.js | league-director.html |
| `bulkAddPlayers` | leagues/index.js | league-director.html |
| `bulkRemovePlayers` | leagues/index.js | league-director.html |
| `addBotToLeague` | leagues/index.js | league-director.html |
| `generateSchedule` | leagues/index.js | league-director.html |
| `updateLeagueSettings` | leagues/index.js | league-director.html |
| `updateLeagueStatus` | leagues/index.js | league-director.html |
| `deleteLeague` | leagues/index.js | league-director.html |
| `startMatch` | leagues/index.js | league-director.html |
| `finalizeMatch` | leagues/index.js | league-director.html |
| `getMatchByPin` | leagues/index.js | league-501.html, scorer-hub.html, match-confirm.html |
| `createTeamWithPlayers` | leagues/index.js | league-director.html |
| `conductLeagueDraft` | phase-5-6-7.js | league-director.html |
| `notifyLeaguePlayers` | phase-5-6-7.js | league-director.html |
| `sendCustomLeagueMessage` | phase-5-6-7.js | league-director.html |
| `getTeamScheduleEnhanced` | phase-5-6-7.js | dashboard.html |
| `registerFillin` | phase-5-6-7.js | league-view.html |
| `updateTeamName` | phase-5-6-7.js | captain-dashboard.html, dashboard.html |
| `completeMatch` | leagues/index.js | match-transition.html |
| `getPlayerStats` | leagues/index.js | player-profile.html, members.html |
| `setMatchLineup` | leagues/index.js | captain-dashboard.html, dashboard.html |
| `quickSubstitute` | leagues/index.js | dashboard.html |

### Player/Auth Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `playerLogin` | player-profile.js | game-setup.html, create-tournament.html, create-league.html, tournament-view.html, player-profile.html, league-view.html |
| `globalLogin` | global-auth.js | dashboard.html |
| `getDashboardData` | global-auth.js | dashboard.html, player-profile.html |
| `updateGlobalPlayer` | global-auth.js | dashboard.html |
| `registerPlayerSimple` | global-auth.js | game-setup.html, messages.html |
| `registerPlayer` | global-auth.js | register.html, player-registration.html |
| `recoverPin` | global-auth.js | dashboard.html |
| `generateNewPin` | global-auth.js | dashboard.html |
| `deletePlayerAccount` | global-auth.js | dashboard.html |
| `resetPlayerPin` | player-profile.js | player-profile.html |
| `getPlayerPublicProfile` | player-profile.js | player-profile.html |
| `updatePlayerProfile` | player-profile.js | player-profile.html |
| `updatePlayerPhoto` | player-profile.js | player-profile.html |
| `searchPlayers` | player-profile.js | player-lookup.html |
| `getGlobalLeaderboards` | player-profile.js | player-lookup.html |
| `getPlayerByPin` | stats-verification.js | stat-verification.html |
| `getMemberPermissions` | admin-functions.js | create-tournament.html, create-league.html |

### Captain Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `getCaptainDashboard` | player-profile.js | captain-dashboard.html |
| `captainLogin` | leagues/index.js | captain-dashboard.html |
| `sendTeamInvite` | phase-5-6-7.js | captain-dashboard.html |
| `permanentReplacement` | player-profile.js | captain-dashboard.html |
| `getCaptainTeamData` | phase-5-6-7.js | dashboard.html |
| `sendCaptainMessage` | phase-5-6-7.js | dashboard.html |
| `updateSeasonAvailability` | captain-functions.js | dashboard.html |
| `addGotoSub` | captain-functions.js | dashboard.html |
| `removeGotoSub` | captain-functions.js | dashboard.html |
| `sendFillinRequests` | captain-functions.js | dashboard.html |
| `getFillinResponses` | captain-functions.js | dashboard.html |
| `shareFillinInterestWithTeam` | captain-functions.js | dashboard.html |
| `confirmFillin` | captain-functions.js | dashboard.html |
| `updatePlayerAvailability` | phase-5-6-7.js | dashboard.html |
| `setPlayerAvailability` | player-profile.js | dashboard.html |
| `requestFillins` | phase-5-6-7.js | player-profile.html |

### Admin Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `adminGetDashboard` | admin-functions.js | admin.html |
| `adminUpdateLeague` | admin-functions.js | admin.html |
| `adminUpdateTournament` | admin-functions.js | admin.html |
| `adminDeleteLeague` | admin-functions.js | admin.html |
| `adminDeleteTournament` | admin-functions.js | admin.html |
| `adminClearData` | admin-functions.js | admin.html |
| `adminGetMembers` | admin-functions.js | admin.html |
| `adminUpdateMemberPermissions` | admin-functions.js | admin.html |
| `adminGetPlayers` | admin-functions.js | admin.html |
| `adminDeletePlayer` | admin-functions.js | admin.html |
| `adminUpdatePlayer` | admin-functions.js | admin.html |
| `adminGetFeedback` | admin-functions.js | admin.html |
| `adminUpdateFeedback` | admin-functions.js | admin.html |
| `adminDeleteFeedback` | admin-functions.js | admin.html |
| `adminAddFeedback` | admin-functions.js | admin.html |

### Bot Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `getBots` | bots.js | bot-management.html, admin.html, game-setup.html, director-dashboard.html, stat-verification.html, league-director.html |
| `registerBot` | bots.js | bot-management.html, admin.html |
| `deleteBot` | bots.js | bot-management.html, admin.html |
| `deleteAllBots` | bots.js | admin.html |

### Messaging Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `sendDirectMessage` | messaging.js | conversation.html |
| `getConversations` | messaging.js | dashboard.html, messages.html |
| `getConversationMessages` | messaging.js | conversation.html |
| `markConversationRead` | messaging.js | conversation.html |
| `startConversation` | messaging.js | messages.html |
| `getUnreadCount` | messaging.js | dashboard.html, nav-menu.js |
| `searchPlayersForChat` | messaging.js | messages.html |
| `sendDirectorMessage` | captain-functions.js (?) | dashboard.html |

### Chat Room Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `getPlayerChatRooms` | chat-rooms.js | chat-room.html, messages.html |
| `getChatRoomMessages` | chat-rooms.js | chat-room.html |
| `markChatRoomRead` | chat-rooms.js | chat-room.html |
| `getChatRoomParticipants` | chat-rooms.js | chat-room.html |
| `sendChatMessage` | chat-rooms.js | chat-room.html |
| `setTypingStatus` | chat-rooms.js | chat-room.html |
| `addMessageReaction` | chat-rooms.js | chat-room.html |
| `editChatMessage` | chat-rooms.js | chat-room.html |
| `deleteChatMessage` | chat-rooms.js | chat-room.html |
| `toggleChatRoomMute` | chat-rooms.js | chat-room.html |
| `getPinnedMessages` | chat-rooms.js | chat-room.html |

### Social Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `addReaction` | social.js | social.js |
| `removeReaction` | social.js | social.js |
| `sendCheer` | social.js | social.js |
| `getBiggestFans` | social.js | social.js |
| `getPlayerCheers` | social.js | social.js |
| `getPlayerAchievements` | social.js | social.js, player-profile.html |
| `setShowcaseAchievements` | social.js | social.js |
| `getHotPlayers` | social.js | social.js |

### Presence Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `updatePresence` | presence.js | presence.js |
| `setPresenceStatus` | presence.js | presence.js |
| `getPlayerPresence` | presence.js | presence.js |
| `setOffline` | presence.js | presence.js |

### Template/Draft Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `saveLeagueTemplate` | index.js | create-league.html |
| `getLeagueTemplates` | index.js | create-league.html |
| `getLeagueTemplate` | index.js | create-league.html |
| `deleteLeagueTemplate` | index.js | create-league.html |
| `saveLeagueDraft` | index.js | create-league.html |
| `getLeagueDraft` | index.js | create-league.html, director-dashboard.html |
| `deleteLeagueDraft` | index.js | create-league.html, director-dashboard.html |
| `saveTournamentTemplate` | index.js | create-tournament.html |
| `getTournamentTemplates` | index.js | create-tournament.html |
| `getTournamentTemplate` | index.js | create-tournament.html |
| `deleteTournamentTemplate` | index.js | create-tournament.html |
| `saveTournamentDraft` | index.js | create-tournament.html |
| `getTournamentDraft` | index.js | create-tournament.html, director-dashboard.html |
| `deleteTournamentDraft` | index.js | director-dashboard.html |

### Match Night/Scoring Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `getMatchByPIN` | phase-5-6-7.js | match-night.html |
| `getMatchNightData` | phase-5-6-7.js | match-night.html |
| `startRound` | phase-5-6-7.js | match-night.html |
| `saveRoundResult` | phase-5-6-7.js | offline-storage.js |
| `updatePlayerStats` | ? | offline-storage.js |
| `submitLeagueMatchScore` | index.js | league-scoreboard.html |
| `finalizeLeagueMatch` | ? | league-scoreboard.html |
| `addEventToTournament` | index.js | director-dashboard.html |
| `updateMatchDates` | index.js | league-director.html |

### Matchmaker Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `getMatchmakerStatus` | matchmaker.js | matchmaker-view.html, matchmaker-register.html, matchmaker-director.html |
| `getMatchmakerTeams` | matchmaker.js | matchmaker-view.html, matchmaker-director.html, matchmaker-bracket.html |
| `matchmakerRegister` | matchmaker.js | matchmaker-register.html |
| `matchmakerDrawPartners` | matchmaker.js | matchmaker-director.html |
| `matchmakerBreakup` | matchmaker.js | matchmaker-director.html |
| `matchmakerRematch` | matchmaker.js | matchmaker-director.html |

### Challenge System Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `getHeadToHead` | chat-challenges.js | challenge-system.js |
| `sendChallenge` | chat-challenges.js | challenge-system.js |
| `getPlayerChallenges` | chat-challenges.js | challenge-system.js |
| `respondToChallenge` | chat-challenges.js | challenge-system.js |
| `cancelChallenge` | chat-challenges.js | challenge-system.js |
| `getCasualLeaderboard` | chat-challenges.js | challenge-system.js |
| `sendRematch` | chat-challenges.js | challenge-system.js |

### Knockout Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `createKnockout` | knockout.js | game-setup.html |
| `getKnockout` | knockout.js | knockout.html |
| `startKnockout` | knockout.js | knockout.html |
| `updateKnockoutTeam` | knockout.js | knockout.html |

### Pickup Game Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `savePickupGame` | pickup-games.js | league-501.html, league-cricket.html |

### Stats Verification Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `submitVerification` | stats-verification.js | league-501.html, league-cricket.html |
| `getVerificationStatus` | stats-verification.js | stat-verification.html |

### Live Ticker Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `getLiveMatchDetails` | chat-live-matches.js | live-ticker.js |
| `getTickerPreferences` | chat-live-matches.js | live-ticker.js |
| `updateTickerPreferences` | chat-live-matches.js | live-ticker.js |

### Other Functions
| Function | File | Frontend Usage |
|----------|------|----------------|
| `getPlayerStatsFiltered` | player-profile.js | player-profile.html |
| `getPlayerUpcomingMatches` | ? | dashboard.html |
| `createPayPalOrder` | ? | player-registration.html |
| `capturePayPalPayment` | ? | player-registration.html |

---

## Potentially Unused Functions

These functions are exported but **no frontend calls were found**. Some may be:
- Called only via scheduled triggers
- Called only via admin tools/scripts
- Legacy code that can be removed

### index.js (Direct Exports)
| Function | Recommendation |
|----------|----------------|
| `checkInPlayer` | INVESTIGATE - Tournament day operation |
| `bulkCheckIn` | INVESTIGATE - Tournament day operation |
| `addWalkIn` | INVESTIGATE - Tournament day operation |
| `getTournamentSummary` | INVESTIGATE - May be needed |
| `undoCheckIn` | INVESTIGATE - Tournament day operation |
| `debugListAllTemplates` | REMOVE - Debug only |
| `debugCheckPin` | REMOVE - Debug only |
| `fixLeagueTeamNames` | REMOVE - One-time data fix |
| `fixMatchTeamIds` | REMOVE - One-time data fix |
| `updatePlayerTeam` | INVESTIGATE |
| `fixAllPlayerTeams` | REMOVE - One-time data fix |
| `markPlayersAsFillins` | INVESTIGATE |
| `addFillinsToMatchLineup` | INVESTIGATE |
| `listLeagueMatches` | INVESTIGATE |

### leagues/index.js
| Function | Recommendation |
|----------|----------------|
| `recalculatePlayerStats` | KEEP - Admin utility |
| `recalculateLeagueStats` | KEEP - Admin utility |
| `getLeague` | INVESTIGATE |
| `fixDirectorInvolvements` | REMOVE - One-time data fix |
| `registerPlayer` | DUPLICATE - Also in global-auth.js |
| `createTeam` | INVESTIGATE - May be superseded by createTeamWithPlayers |
| `importSchedule` | KEEP - Admin utility |
| `startGame` | INVESTIGATE |
| `recordLeg` | INVESTIGATE |
| `submitGameResult` | INVESTIGATE |
| `getCaptainTeam` | INVESTIGATE |
| `registerSubstitute` | INVESTIGATE |
| `getAvailableSubs` | INVESTIGATE |
| `reportIssue` | INVESTIGATE |
| `createTestSinglesLeague` | REMOVE - Test utility |
| `MATCH_FORMAT` | KEEP - Constant export |
| `updateLeagueAdminPin` | INVESTIGATE |
| `setupBotLeague` | INVESTIGATE - Test utility? |
| `importMatchData` | KEEP - Admin utility |
| `importAggregatedStats` | KEEP - Admin utility |
| `assignPlayerLevels` | INVESTIGATE |

### phase-5-6-7.js (Legacy Module)
| Function | Recommendation |
|----------|----------------|
| `registerTeam` | INVESTIGATE - Team league registration |
| `registerFreeAgent` | INVESTIGATE - Team league free agent |
| `sendTeamInvite` | KEEP - Used in captain-dashboard |
| `respondToTeamInvite` | INVESTIGATE |
| `verifyDirectorPin` | INVESTIGATE |
| `createTeamManual` | INVESTIGATE |
| `addPlayerToTeam` | INVESTIGATE |
| `assignFreeAgentToTeam` | INVESTIGATE |
| `updatePlayerLevel` | INVESTIGATE |
| `toggleLeagueRegistration` | INVESTIGATE |
| `handleFillinResponse` | INVESTIGATE |
| `processExpiredFillinRequests` | INVESTIGATE - May need scheduler |
| `generateLeagueSchedule` | DUPLICATE - Also in leagues/index.js |
| `getLeagueStandings` | DUPLICATE - Also in leagues/index.js |
| `sendSMS` | KEEP - Notification utility |
| `sendBulkSMS` | KEEP - Notification utility |
| `getTeamSchedule` | INVESTIGATE - Superseded by getTeamScheduleEnhanced? |
| `sendEmail` | KEEP - Notification utility |
| `notifyMatchAssignment` | INVESTIGATE |
| `createPayment` | INVESTIGATE - PayPal integration |
| `capturePayment` | INVESTIGATE - PayPal integration |
| `generateMatchPIN` | INVESTIGATE |

### global-auth.js
| Function | Recommendation |
|----------|----------------|
| `registerGlobalPlayer` | DUPLICATE - Similar to registerPlayer |
| `updatePlayerPrivacy` | INVESTIGATE |
| `addLeagueInvolvement` | INVESTIGATE - Backend use only? |
| `updateLeagueInvolvement` | INVESTIGATE |
| `addTournamentInvolvement` | INVESTIGATE |
| `createBotPlayer` | INVESTIGATE |
| `getAllPlayers` | INVESTIGATE |
| `debugCaptain` | REMOVE - Debug only |
| `updatePlayerSettings` | INVESTIGATE |

### admin-functions.js
| Function | Recommendation |
|----------|----------------|
| `adminLogin` | INVESTIGATE |
| `adminFixPlayerPin` | KEEP - Admin utility |
| `adminRegisterSelf` | INVESTIGATE |
| `adminResetLeague` | KEEP - Admin utility |
| `adminCreateBotFromPlayer` | INVESTIGATE |
| `adminImportLeagueStats` | KEEP - Admin utility |
| `adminImportMatchData` | KEEP - Admin utility |
| `adminCheckMatches` | KEEP - Admin utility |
| `adminMarkWeekCompleted` | INVESTIGATE |

### captain-functions.js
| Function | Recommendation |
|----------|----------------|
| `saveSubPlaylist` | INVESTIGATE |
| `recordFillinResponse` | INVESTIGATE |
| `updateTeamSettings` | INVESTIGATE |
| `sendCaptainMessageV2` | DUPLICATE? Check vs sendCaptainMessage |
| `getCaptainMessageTemplates` | INVESTIGATE |

### player-profile.js
| Function | Recommendation |
|----------|----------------|
| `getTeamAvailability` | INVESTIGATE |

### Data Import Functions (Keep All)
These are admin utilities for importing DartConnect data:
- `populateMatchDataFunctions` (populate-match-data.js)
- `populateWeek1Functions`
- `populatePartloFunctions`
- `populateMassimianiFunctions`
- `populateMezlakFunctions`
- `testImportFunctions`

---

## Duplicate Functions

Functions that appear to have duplicate implementations:

| Function | Locations | Recommendation |
|----------|-----------|----------------|
| `registerPlayer` | global-auth.js, leagues/index.js | CONSOLIDATE - Use one version |
| `generateSchedule` | leagues/index.js, phase-5-6-7.js | INVESTIGATE - May have different logic |
| `getStandings/getLeagueStandings` | leagues/index.js, phase-5-6-7.js | CONSOLIDATE |
| `sendCaptainMessage/sendCaptainMessageV2` | phase-5-6-7.js, captain-functions.js | CONSOLIDATE |
| `createLeague` | phase-5-6-7.js, leagues/index.js | INVESTIGATE - Check which is used |

---

## Recommendations

### High Priority - Remove
1. **Debug functions:** `debugListAllTemplates`, `debugCheckPin`, `debugCaptain`
2. **One-time data fixes:** `fixLeagueTeamNames`, `fixMatchTeamIds`, `fixAllPlayerTeams`, `fixDirectorInvolvements`
3. **Test utilities:** `createTestSinglesLeague`, `setupBotLeague`

### Medium Priority - Investigate
1. **Tournament day operations:** `checkInPlayer`, `bulkCheckIn`, `addWalkIn`, `undoCheckIn` - These may be needed for in-person tournament management but no frontend exists
2. **Team league functions:** `registerTeam`, `registerFreeAgent`, `respondToTeamInvite` - Team mode may not be implemented in frontend
3. **Legacy phase-5-6-7 duplicates:** Several functions duplicated between phase-5-6-7.js and leagues/index.js

### Low Priority - Keep Monitoring
1. **Admin utilities:** All `admin*` functions for backend maintenance
2. **Import utilities:** All `import*` and `populate*` functions for data migration
3. **Notification utilities:** `sendSMS`, `sendBulkSMS`, `sendEmail`

### Code Organization Suggestions
1. **Consolidate duplicate functions** into single implementations
2. **Move all league functions** from phase-5-6-7.js to leagues/index.js
3. **Create separate admin-only module** for functions never called from frontend
4. **Re-enable disabled modules** when migrating to Firebase Functions v2

---

## Project References

- Old project ID: `brdc-69` (found in x01.html, cricket.html, online-play.html, mini-tournament.html)
- Current project ID: `brdc-v2`

**Note:** Some frontend files still reference the old `brdc-69` project. These should be updated to `brdc-v2`.

---

## Files Referencing Old Project (brdc-69)

| File | Line |
|------|------|
| public/pages/x01.html | 1814, 2848 |
| public/pages/cricket.html | 849, 1361 |
| public/pages/online-play.html | 638 |
| public/pages/mini-tournament.html | 586 |

**Recommendation:** Update these to use the `callFunction` helper from firebase-config.js which uses `brdc-v2`.
