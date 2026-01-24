# Audit Trail Logging System

**Date:** 2026-01-24
**Status:** COMPLETE

## Summary

Implemented a comprehensive audit trail logging system that tracks all director/admin actions for accountability. The system provides a unified audit log stored in Firestore with a UI for viewing activity in the league director dashboard.

## Data Structure

### Audit Log Collection
Location: `leagues/{leagueId}/audit_log/{logId}`

```javascript
{
  action: string,           // 'match_correction', 'level_change', 'forfeit', 'reschedule'
  actor_id: string,         // Player ID of who performed action
  actor_name: string,       // Denormalized name for display
  timestamp: Timestamp,     // When the action occurred
  target_type: string,      // 'match', 'player', 'team', 'league'
  target_id: string,        // ID of affected entity
  target_name: string,      // Denormalized name/description
  changes: {                // Before/after values
    field: { before: any, after: any }
  },
  reason: string            // Optional reason/notes
}
```

## Files Modified

### Backend (functions/leagues/index.js)

1. **Added `logAuditEvent()` helper function**
   - Creates audit log entries in the subcollection
   - Non-blocking (errors are logged but don't break main operations)
   - Accepts standardized event data structure

2. **Added `getActorFromPin()` helper function**
   - Resolves director PIN to player ID and name
   - Used by audit logging to identify who performed actions

3. **Added `getAuditLog` cloud function**
   - Returns paginated audit log entries
   - Supports filtering by action type
   - Uses cursor-based pagination for efficiency
   - Requires director PIN for authentication

4. **Integrated audit logging into director functions:**
   - `correctMatchResult` - Logs score corrections with before/after values
   - `setPlayerLevel` - Logs level changes for players
   - `rescheduleMatch` - Logs date changes and makeup status
   - `recordForfeit` - Logs forfeit details and score changes

### Frontend (public/pages/league-director.html)

1. **Added Activity Log section in Director Tools tab**
   - Purple-themed card matching site design
   - Filter dropdown for action types
   - Expandable entries showing change details
   - "Load More" pagination button

2. **Added CSS styles for audit log entries**
   - Color-coded left borders by action type
   - Expandable details with before/after change visualization
   - Relative timestamps ("2 hours ago")
   - Responsive design

3. **Added JavaScript functions:**
   - `loadAuditLog()` - Fetches audit entries from backend
   - `renderAuditLog()` - Renders entries with proper formatting
   - `toggleAuditDetails()` - Expands/collapses entry details
   - `filterAuditLog()` - Applies action type filter
   - `loadMoreAuditEntries()` - Pagination support
   - Helper functions for formatting (time, field names, values)

## Action Types

| Action | Description | Target Type |
|--------|-------------|-------------|
| `match_correction` | Score correction for completed match | match |
| `level_change` | Player skill level adjustment | player |
| `reschedule` | Match date change | match |
| `forfeit` | Match forfeit recording | match |

## UI Features

### Activity Log Section
- Located at the bottom of the Director Tools tab
- Filter by action type (all, corrections, level changes, reschedules, forfeits)
- Click entries to expand and see detailed changes
- Color-coded borders: Pink (corrections), Teal (levels), Yellow (reschedules), Red (forfeits)
- Shows relative timestamps with full date on hover
- "Load More" button for older entries

### Change Display
- Shows field name with before/after values
- Before values shown in red with strikethrough
- After values shown in green
- Handles various value types (dates, booleans, strings, numbers)

## Testing

1. Make a match correction in Director Tools
2. Change a player's level
3. Reschedule a match
4. Record a forfeit
5. View Activity Log section - all actions should appear
6. Click entries to expand details
7. Use filter to show only specific action types
8. Click "Load More" to test pagination

## Notes

- Audit logging is non-blocking - if it fails, the main operation still completes
- Legacy logs (corrections_log, forfeit_log) are still maintained for backwards compatibility
- Actor information is resolved from PIN at log time for denormalization
- Timestamps use server timestamps for accuracy
