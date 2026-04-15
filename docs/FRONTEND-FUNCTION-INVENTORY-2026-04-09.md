# Frontend Function Inventory

Date: 2026-04-09
Project: `brdc-v2`

This inventory is based on frontend references under `public/`:

- `callFunction('name', ...)`
- direct calls to `https://us-central1-brdc-v2.cloudfunctions.net/name`

It is intended to identify the production backend surface the current frontend depends on before any cleanup or retirements.

## Core auth/session

- `playerLogin`
- `globalLogin`
- `getPlayerSession`
- `validateSession`
- `registerNewPlayer`
- `registerPlayer`
- `registerPlayerSimple`

## Dashboard/profile/navigation

- `getDashboardData`
- `getPlayerInvolvements`
- `getPlayerStats`
- `getPlayerStatsFiltered`
- `getGlobalLeaderboards`
- `getPlayerPresence`
- `getPlayerPublicProfile`
- `getOnlinePlayers`
- `updatePlayer`
- `updatePlayerPhoto`
- `updateActivity`
- `updatePresence`
- `setPresenceStatus`
- `setOffline`

## Notifications/messaging/chat

- `getUnreadNotificationCount`
- `getNotifications`
- `markNotificationRead`
- `markAllNotificationsRead`
- `getUnreadCount`
- `getConversations`
- `getConversationMessages`
- `markConversationRead`
- `startConversation`
- `sendDirectMessage`
- `getPlayerChatRooms`
- `getChatRoomMessages`
- `markChatRoomRead`
- `sendChatMessage`
- `getChatRoomParticipants`
- `addMessageReaction`
- `editChatMessage`
- `deleteChatMessage`
- `toggleChatRoomMute`
- `getPinnedMessages`
- `setTypingStatus`
- `createGroupChatRoom`
- `getOrCreateMatchChatRoom`

## Social/feed/friends

- `createPost`
- `createOpenChatRoom`
- `joinPool`
- `addReaction`
- `removeReaction`
- `sendCheer`
- `getBiggestFans`
- `getPlayerCheers`
- `getPlayerAchievements`
- `setShowcaseAchievements`
- `getHotPlayers`
- `sendFriendRequest`
- `acceptFriendRequest`
- `declineFriendRequest`
- `cancelFriendRequest`
- `removeFriend`
- `getFriends`
- `getFriendRequests`
- `getSuggestedFriends`
- `searchPlayers`
- `searchPlayersForChat`
- `checkFriendshipStatus`

## League/player management

- `verifyLeaguePin`
- `registerForLeague`
- `registerFillin`
- `getTeams`
- `getPlayers`
- `getSchedule`
- `getStandings`
- `getLeaderboards`
- `getAuditLog`
- `addPlayer`
- `deletePlayer`
- `bulkAddPlayers`
- `bulkRemovePlayers`
- `bulkMovePlayersToTeam`
- `bulkSetPlayerLevels`
- `bulkNotifyPlayers`
- `createLeague`
- `createTeamWithPlayers`
- `deleteLeague`
- `saveLeagueDraft`
- `getLeagueDraft`
- `conductLeagueDraft`
- `getDraftState`
- `addBotToLeague`
- `recordForfeit`
- `rescheduleMatch`
- `correctMatchResult`
- `updateLeagueSettings`
- `updateLeagueStatus`
- `updateMatchDates`
- `updatePlayerAvailability`
- `setPlayerAvailability`
- `setPlayerLevel`
- `setMatchLineup`
- `updateTeamName`
- `sendTeamInvite`
- `sendCustomLeagueMessage`
- `notifyLeaguePlayers`
- `sendFillinRequests`
- `confirmFillin`
- `getCaptainDashboard`
- `getMatchAvailability`
- `getMatchByPin`
- `getTeamScheduleEnhanced`
- `saveRoundResult`
- `submitLeagueMatchScore`
- `startMatch`
- `finalizeMatch`
- `completeMatch`
- `generateSchedule`

## Tournaments/matchmaker/knockout

- `createTournament`
- `updateTournamentSettings`
- `deleteTournament`
- `addBotToTournament`
- `generateBracket`
- `generateDoubleEliminationBracket`
- `regenerateBracket`
- `swapBracketPositions`
- `registerForTournament`
- `createKnockout`
- `getKnockout`
- `getActiveKnockouts`
- `startKnockout`
- `updateKnockoutTeam`
- `submitDoubleElimMatchResult`
- `startDoubleElimMatch`
- `submitMatchResult`
- `submitVerification`
- `getVerificationStatus`
- `getMatchmakerStatus`
- `getMatchmakerTeams`
- `matchmakerRegister`
- `findPlayerRegistration`
- `deleteMatchmakerRegistration`
- `checkInPlayer`
- `markNoShow`
- `getCheckInStatus`
- `matchmakerDrawPartners`
- `matchmakerBreakup`
- `matchmakerRematch`
- `runCupidShuffle`
- `triggerHeartbreaker`
- `startMinglePeriod`
- `endMinglePeriod`
- `getMingleStatus`
- `getHeartbrokenTeams`
- `getAvailableNudgeTargets`
- `getNudgeCount`
- `sendNudge`
- `submitBreakupDecision`

## Payments

- `createPayPalOrder`
- `capturePayPalPayment`

## Admin

- `adminGetDashboard`
- `adminUpdateLeague`
- `adminUpdateTournament`
- `adminDeleteLeague`
- `adminDeleteTournament`
- `adminClearData`
- `adminGetPlayers`
- `adminUpdatePlayer`
- `adminDeletePlayer`
- `adminGetMembers`
- `adminUpdateMemberPermissions`
- `adminGetFeedback`
- `adminUpdateFeedback`
- `adminDeleteFeedback`
- `adminAddFeedback`
- `registerBot`
- `getBots`
- `deleteBot`
- `deleteAllBots`

## Misc live/utility

- `getLiveMatchDetails`
- `getMatchViewers`
- `joinMatchAsViewer`
- `leaveMatchAsViewer`
- `getTickerPreferences`
- `updateTickerPreferences`
- `savePickupGame`
- `sendPlayerNotification`
- `updateFeedbackStatus`
- `getMemberPermissions`
- `getTournamentTemplate`
- `getTournamentTemplates`
- `saveTournamentTemplate`
- `saveTournamentDraft`
- `getTournamentDraft`
- `deleteTournamentTemplate`
- `deleteTournamentDraft`
- `globalSearch`

## Notes

- This is the frontend dependency list, not the complete live Cloud Functions inventory.
- Any live function not referenced here is a candidate for `legacy-but-used-elsewhere` or `retire-candidate`, but should not be removed until confirmed against:
  - internal/admin usage
  - scheduled triggers
  - event-driven triggers
  - manual operational workflows
