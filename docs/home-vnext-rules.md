# Home vNext Rules

## Purpose

The vNext dashboard should feel like a personal clubhouse, not a compressed sitemap. The page should answer what the signed-in player came for first, then expose social/play/community features without repeating the same navigation labels.

## Content Priority

1. Show the user's next match clearly and early.
2. Keep league status relevant to the user: standings context, schedule, and team chat.
3. Surface community actions after the user's league needs are covered.
4. Link out for full detail instead of duplicating every full page inside the dashboard.

## Layout Rules

1. Avoid repeated labels. If a tab says `Standings`, the pane should not also say `Standings` and `Your team race`.
2. A feature should either be useful inline or should become one clear link to its full page.
3. Avoid tiles inside tiles unless the nested tile adds a clear interaction.
4. The match night card should stand alone visually and not share a carousel/tile with league hub content.
5. The league hub should keep a stable footprint where possible; content can scroll internally only when it avoids expanding the whole page.
6. Typography should carry hierarchy before borders and boxes do.
7. Primary card tabs should keep the stronger segmented style. Only nested subtabs should use the subtle inline style.
8. Rookies vNext pages must reuse the homepage component hierarchy before inventing or approximating a new style:
   - Page/card tabs: strong segmented strip with red active fill.
   - Nested subtabs: quiet underline style.
   - Filters: compact, lower-weight segmented controls.
   - Dense data content categories, such as `Performance / Awards / Leaderboard`: quiet underline style.
   - Cards: 8px radius, 18px major gaps, Rookies red accents, muted completed states.

## User-Specific Rules

1. Prefer the user's team, match, rooms, and schedule over global league content.
2. Show full league context only when it directly helps the user understand their place.
3. Highlight the user's team clearly in standings.
4. Team chat should be available inline because communication is a primary use case.

## Visual Rules

1. Reduce visual noise before adding new UI.
2. Use fewer framed boxes and stronger type spacing.
3. Mobile must be assessed visually, not just checked for no overflow.
4. Dense data is acceptable only if scan paths are obvious.

## Current Open Design Questions

1. Whether community `Chat, play, trade` should remain as a separate tile or fold into a simpler action strip.
2. Whether tournament/event content should stay on the dashboard or become a single upcoming-event link until there is active user-specific registration data.
3. Whether match night lineups should default open on match day and collapsed before then.
