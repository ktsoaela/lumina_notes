# ADR 0006: Flutter phone/tablet UI polish; desktop layout frozen

- **Status:** Proposed
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
