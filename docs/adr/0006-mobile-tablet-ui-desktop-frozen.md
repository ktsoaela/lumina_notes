# ADR 0006: Flutter phone/tablet UI polish; desktop layout frozen

- **Status:** Accepted (implemented in v1.3.0)
- **Date:** 2026-11-16
- **Deciders:** Lumina Notes maintainers

## Context

The **desktop** app already has a working shell (notebook chrome, stick'n, Profile). The **Flutter phone and tablet** apps need a clearer touch-first layout: calm reading/writing, obvious notebook hierarchy, and adaptive panes on wide screens — without redesigning Electron.

## Options considered

| Option | Summary | Tradeoff |
|--------|---------|----------|
| A. Redesign Flutter phone + tablet only; leave desktop React/Electron UI as-is | Better touch UX; no desktop churn | Two visual systems for a while |
| B. One redesign for desktop and mobile together | Consistency | Large, risky desktop rewrite |
| C. Keep Flutter utilitarian until later | Cheap | Phone/tablet feel unfinished next to desktop |

## Decision

We will use **Option A**:

1. **Do not** change the desktop app’s overall UI design in this workstream (layout, stick'n chrome, Profile structure stay).
2. **Do** restyle and restructure the **Flutter mobile and tablet** experiences for:
   - Focused reading and writing with restrained chrome and clear note hierarchy
   - Touch-friendly browsing: notebook → section → page, with adaptive split on tablets where useful
3. Tablet may use a two-pane (list + editor) layout; phone stays single-pane with a clear back stack.
4. Brand tokens (sage / Lumina identity) still apply; this is interaction and layout, not a new logo.
5. Pairing, sync chips, and offline behavior from ADR 0001 / 0002 stay; this ADR is **presentation and navigation** on Flutter only.

## Consequences

**Positive**

- Phone/tablet get a purposeful UX without destabilizing desktop
- Clear ownership: Flutter owns the mobile/tablet look

**Negative / follow-up**

- Desktop and mobile will diverge visually until a later ADR optionally aligns them
- Feature guides should screenshot Flutter separately from desktop

## Implementation (v1.3.0)

- Desktop React/Electron layout untouched; all changes are under `mobile/lib/ui/`.
- **Library** (home): bookshelf chips + book cards with coloured spines (`library_screen.dart`).
- **Book**: chapters as colour-coded tabs, numbered page list styled like the desktop sidebar, Book · chapter · page tree drawer (`book_screen.dart`).
- **Tablet (≥ 840 dp)**: page list beside the editor; **phone**: single pane, editor pushed on the back stack.
- **Brand tokens**: sage / paper / stone palette from `src/index.css` in `lumina_theme.dart`; reader typography per ADR 0004.
- Pairing, sync chip and offline behaviour unchanged (ADR 0001 / 0002); sign-out and re-auth flows kept.
- Covered by `test/adaptive_test.dart`, `test/browse_test.dart`, `test/workspace_test.dart`.
- Feature guide updated: `docs/features/flutter-mobile.md`.
