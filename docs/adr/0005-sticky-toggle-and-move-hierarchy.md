# ADR 0005: Disable stick'n strips; move pages and chapters across books

- **Status:** Proposed
- **Date:** 2026-11-16
- **Deciders:** Lumina Notes maintainers

## Context

**stick'n** sticky strips are always available on desktop. Some users want them **off** so the notebook is the only surface.

Hierarchy edits are also limited: users need to **move pages into other chapters**, and **chapters into other books** (and related reparenting), without deleting and recreating. The interaction should be either **drag-and-drop** to a target, or **select + Move to…** (menu/dialog) — whichever is reliable on desktop first; mobile can use the selection path if drag is awkward.

## Options considered

| Option | Summary | Tradeoff |
|--------|---------|----------|
| A. Profile/settings toggle for stick'n; move via drag-and-drop **and** a Move-to command | Flexible | Two UI paths to build/test |
| B. Stick'n always on; move only by recreate | No work | Does not meet the need |
| C. Drag-only | Fast for power users | Weak on touch / precision |

## Decision

We will use **Option A**:

### Stick'n

1. A clear setting (Profile or Desktop settings): **Enable sticky note strips** (default **on** to match current behavior).
2. When **off**, do not show or spawn stick'n windows; existing strip windows close or stay dismissed until enabled again.
3. Desktop-only preference; Flutter has no stick'n.

### Move pages / chapters

1. Support **reparenting**:
   - page → another chapter (same or different book)
   - chapter → another book
2. Offer **both**:
   - **Drag and drop** onto a valid target in the library/tree where it is practical
   - **Move to…** via context menu / selection + option sheet (always available as the reliable path)
3. Persist through the existing API (PATCH parent ids or equivalent). Sync clients (Electron + Flutter) must see the new location after sync.
4. Conflict rule stays **last-write-wins** (ADR 0001) if two devices move the same node.

## Consequences

**Positive**

- Quieter desktop for users who do not want strips
- Real reorganization without copy-paste loss

**Negative / follow-up**

- Drag targets and forbidden drops (e.g. page into shelf) need clear UX
- Undo of a move is nice-to-have, not required in v1 of this ADR
