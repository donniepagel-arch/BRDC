# BRDC vNext Design Standard — "Home is the standard"

**Established 2026-06-06.** Home v5 (`home-vnext`) is the canonical look. Every vNext
page should conform to the treatment below. When in doubt, match Home.

## 1. Background (warm Clubhouse family) — every page
```css
background-image:
    radial-gradient(circle at top left, rgba(244, 63, 147, 0.13), transparent 30rem),
    repeating-linear-gradient(45deg, rgba(94, 72, 45, 0.08) 0 1px, transparent 1px 7px),
    linear-gradient(180deg, #fff7ed 0%, #f7efe2 100%);
background-size: auto;
background-repeat: no-repeat;
background-color: #f7efe2;
```
- Pink glow top-left + diagonal hatch texture + warm cream fade.
- NO `background-attachment: fixed` (causes full-page-capture artifacts + iOS jank).
- The retired olive parchment (`#ece2cd / #e1d6bd / #d4c8ac`) must never return.

## 2. Page header — bold headline hero
- Pink kicker (11–12px, 900, letter-spacing 0.15–0.18em, uppercase, color `#ed3f91`).
- Big Bebas Neue headline (`clamp(54px, 16vw, 96px)`), ink `#172033`.
- Optional one-line subtitle/greeting below.

## 3. Snapshot card (player glance)
- Greeting line + stat columns (3DA · MPR · Rank · Challenges) inside a warm card,
  thin `--hv-line` dividers between columns, pink JetBrains-Mono numbers.

## 4. Cards
- Light cards: warm paper `#fffaf2`, radius 24px, **feathered shadow**:
  `0 1px 0 rgba(255,255,255,0.7) inset, 0 2px 6px rgba(23,32,51,0.06), 0 20px 46px rgba(23,32,51,0.13)`.
- Every card's **title is a pink kicker inside the card, first element**, with a
  divider line beneath it (light cards: `rgba(23,32,51,0.12)`; dark: `rgba(255,255,255,0.12)`).
- One focal **dark navy card** per page is allowed (match/playoff hero):
  `linear-gradient(138deg,#16213a,#0f172a)`, contained shadow `0 22px 50px rgba(15,23,42,0.22)`
  so it doesn't bleed onto the card below.

## 5. Palette tokens (shared intent)
- paper `#fffaf2` · ink `#172033` · pink `#ed3f91`/`#f43f93` · navy `#16213a`
  · blue `#147f9f` · gold `#d69b22` · green `#21a66b` · radius `24px`.

## 6. Conformance checklist (per page)
- [ ] Warm background (section 1), no olive, no `fixed`.
- [ ] Headline hero (kicker + big Bebas headline).
- [ ] Cards use feathered shadow + internal pink kicker + divider.
- [ ] At most one dark focal card, with contained shadow.
- [ ] Bottom nav present; only scorers go full-screen (suppress nav).

## Drift-prevention TODO
Each page currently redefines the background block in its own CSS (6+ copies edited
2026-06-06). Future hardening: extract sections 1–4 into a shared `vnext-surface.css`
imported by every page so there is ONE source of truth.
