# Home VNext Design Rules

- Keep the page user-specific. If a block is not directly useful to the signed-in player, move it behind a detail link.
- Avoid repeated labels. Do not stack phrases like "Your League", "2026 Triples League", "Standings", and "League Hub" in the same visual area unless each one adds context.
- Match night stands alone. It should read like an event poster first, with lineup, stats, and RSVP available as expandable support.
- Use typography and spacing before boxes. Add borders/cards only when they clarify grouping or interaction.
- Chat should feel present, not buried. Team chat belongs inline on the dashboard, with full chat one click away.
- League detail pages use league chat, not team chat. Team rooms stay in the player/home context; league pages should point to league-wide conversation, match discussion, and member/direct-message entry points.
- Dedicated message pages should open directly into the requested context when linked with `source`, `league_id`, `team_id`, or `room_id`; avoid directory cards that send multiple actions to the same generic inbox.
- Recurring event series, such as Wing It Wednesdays, use one persistent event chat room for the series. Weekly tournament pages should route into that series room instead of creating a new room every week.
- League standings should be complete enough to understand playoff position without leaving the dashboard.
- Schedules should scan across the available width. Avoid cramming team names into the left edge with empty space on the right.
- Mobile is a first-class layout. Team names, records, and match actions must stay centered and readable on phone widths.
- Primary tabs inside home cards use the stronger segmented treatment. Nested subtabs, such as `Playoffs / Regular season`, use the quieter inline treatment so hierarchy stays clear.
- `/rookies/` is the public venue home. `/rookies/dashboard/` is the authenticated player/staff dashboard. Do not let staff management, player identity, or private match-night controls appear on the public venue home.

## Rookies vNext Component Hierarchy

Use this hierarchy on every Rookies vNext page, not just the homepage:

1. Page-level/card-level tabs use the homepage segmented control: one framed strip, equal-width buttons, red active fill, dark inactive text.
2. Nested content tabs use the quiet underline style: no filled button, uppercase small text, active underline only.
3. Filters are not tabs. Player/team toggles, level filters, and similar controls use small compact segmented controls with lower visual weight than page tabs.
4. Content category tabs inside dense tools, such as `Performance / Awards / Leaderboard`, use the quiet underline style because they switch content groups rather than filter rows.
5. Never introduce a new tab/card/button style on a Rookies page until the existing homepage pattern has been checked and ruled out.
6. Full-page detail views should reuse the homepage card rhythm: 8px radii, 18px major gaps, Rookies red accents, muted completed states, and no nested cards unless the nested card has a distinct interaction.
7. When extending a page from a homepage card, copy the homepage component language first, then add detail. Do not approximate the look with similar-but-different controls.
