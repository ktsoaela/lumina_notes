# ADR 0007: stick'n strip open animation, clearer UX, and tray access

- **Status:** Accepted (implemented in v1.3.0)
- **Date:** 2026-11-16
- **Deciders:** Lumina Notes maintainers

## Context

stick'n edge strips work, but opening them feels abrupt, placeholder copy does not read as “you can type here,” closing a strip is unclear, and there is no reliable way to get a strip back from the Windows **notification area** (system tray / overflow “hidden icons”) when it is dismissed or hard to find.

Related: ADR 0005 (toggle stick'n on/off). This ADR covers **interaction and discovery** when stick'n is enabled.

## Options considered

| Option | Summary | Tradeoff |
|--------|---------|----------|
| A. Animate pack → writing expand; polish placeholder/close; tray icon with show/hide | Clearer desktop habit loop | Extra Electron chrome + motion work |
| B. Keep instant resize; improve copy only | Cheap | Still hard to rediscover / close |
| C. No tray; only Profile / hotkey | Less OS integration | Easy to “lose” strips |

## Decision

We will use **Option A**:

### Open / expand animation

1. Clicking a **packed strip** animates it into the **writing** size and position (edge → expanded page), instead of jumping.
2. Motion should read as the note **pulling out** to its writing place (short, intentional; respect reduced-motion OS setting).

### UI / UX polish

1. **Placeholder** text uses a muted / greyed color (and weight) that clearly signals “empty — type here,” distinct from real note body text.
2. Visual hierarchy: title vs body, focus ring, and strip chrome stay readable on neon strip colors and on transparent Windows chrome.
3. **Close** is obvious and low-friction: a clear control on the expanded strip (and optionally pack-back to the edge without destroying the note). Closing must not feel like hunting a tiny hit target. Prefer pack-to-edge as the default “put away”; full dismiss only when the user intends to hide that strip.

### System tray

1. While stick'n is enabled, show a **tray icon** for Lumina stick'n (including under Windows **hidden icons** overflow if the user parks it there).
2. Tray menu (or click) can **show / focus** strips, **spawn** a strip if none are visible, and respect ADR 0005 when stick'n is disabled (no tray entry, or inactive).
3. Desktop-only; Flutter remains out of scope.

## Consequences

**Positive**

- Opening a strip feels physical and guided
- Empty state and close affordances are easier to understand
- Users can recover strips from the tray without restarting the app

**Negative / follow-up**

- Tray + animation need Windows QA (multi-monitor, always-on-top, DWM transparency)
- Coordinate with existing sticky edge snap / white-bar refresh logic so animation does not fight DWM

## Implementation (v1.3.0)

| Decision | Where |
|----------|-------|
| Open animation | Clicking a strip pulls the note out of its docked edge (slide + slight peel, 340 ms, per-edge keyframes `film-pull-*`); closing tucks it back (`film-tuck-*`, 220 ms) before the window shrinks. Off when the OS or Profile “Reduce motion” is on. |
| Placeholder | Readable muted grey, normal weight, with a Markdown hint (“Take a note… # Heading, - a list item, - [ ] a to-do”). |
| Hierarchy / focus | Header in the strip's colour (title, colour dots, actions), paper body with focus glow, formatting bar (bold, italic, strike, list, to-do, Mermaid); visible `:focus-visible` rings on header and paper. |
| Close | Large × in the header and **Esc**; both save then tuck back to the edge (pack). Hiding strips entirely is the explicit toggle (Profile / tray). |
| Tray | `Tray` in `electron/main.cjs`: Open Lumina Notes · Sticky notes ▸ Pink…Blue · Show sticky note strips · version · Quit. Left-click brings strips back (spawns the window if gone). When strips are off the tray is **inactive** for stick'n: colour notes are disabled and left-click just opens Lumina; only the explicit checkbox re-enables. |

Windows QA still recommended on multi-monitor setups; the existing DWM transparency refresh runs on blur/focus as before.
