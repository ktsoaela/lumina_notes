# ADR 0004: Markdown reader typography (VS Code–like) and user font settings

- **Status:** Accepted (implemented in v1.3.0)
- **Date:** 2026-11-16
- **Deciders:** Lumina Notes maintainers

## Context

Reading written notes feels wrong today: **line spacing**, **margins**, and overall rhythm do not match a calm markdown reader. The target feel is closer to the **VS Code Markdown preview** — clear hierarchy, readable measure, predictable spacing — while Lumina still keeps a product “voice” through default type.

Users also need control: they must be able to change **font family (style)**, **font color**, and **font size** in settings, not only live with the default brand face.

## Options considered

| Option | Summary | Tradeoff |
|--------|---------|----------|
| A. Default reader theme tuned like VS Code MD preview; settings override family/size/color | Brand default + user control | More CSS/tokens to maintain |
| B. Ship only system fonts with no branded default | Simple | Weak product identity |
| C. Hard-code brand typography only | Strong brand | Users who need larger type / dyslexia-friendly faces are stuck |

## Decision

We will use **Option A**:

1. **Read mode** (and print/PDF preview where shared) uses a dedicated **reader stylesheet**: margins, line-height, max measure, heading scale, and code block spacing aimed at a VS Code–like markdown reading experience.
2. Lumina keeps a **default font identity** (product default family + sizes) so the app still looks like Lumina out of the box.
3. Under **Settings / Profile**, the user can set:
   - **Font style** (family — curated list + optional system default)
   - **Font size** (base size; headings scale from it)
   - **Font color** (body text; respect theme contrast / dark mode)
4. Preferences persist per device (local storage / Flutter prefs). Syncing them across devices is out of scope for this ADR unless a later decision adds it.
5. Editor (edit mode) may keep a denser mono/UI font; this ADR prioritizes **viewing** written files. Aligning edit and read further can be a follow-up.

## Consequences

**Positive**

- Notes are easier to read long-form
- Accessibility and preference without forking the product look for everyone

**Negative / follow-up**

- Need contrast checks when users pick light text on light backgrounds
- Mermaid/Plotly embeds must still fit the reader margins

## Implementation (v1.3.0)

| Decision | Where |
|----------|-------|
| 1. Reader stylesheet (VS Code–like) | `.md-reader` in `src/index.css` (heading scale, rules under h1/h2, list/quote/table/code rhythm, 54rem measure); `Preview.tsx` no longer depends on the missing Tailwind typography plugin and keeps fenced code as real `<pre>`. Print/PDF share the same rhythm and the user's font + size (`src/lib/printDocument.ts`, always dark-on-white for paper). Flutter: `readerStyleSheet()` in `page_editor_screen.dart`, centred 760 px column. |
| 2. Default identity | Lumina serif (Source Serif 4 body + Fraunces headings) stays the default on desktop; platform serif on Flutter. |
| 3. Font style / size / colour | Profile → Appearance → **Reading & writing** (`src/lib/readingPrefs.ts`): curated families incl. System UI, 12–28 px, colour picker or “Match theme”, live preview. Flutter Settings: same three controls with swatches. Editor and stick'n strips use the same prefs. |
| 4. Per-device persistence | `localStorage` (`lumina_reading`) on desktop/web; Flutter `AppSettings` via the secure key-value store. |
| 5. Editor | Follows the same family/size so writing and reading match (the ADR allowed either). |

**Contrast follow-up — done:** a custom colour below WCAG 3:1 against the current theme's paper is ignored and the theme colour is used instead; Profile / Settings show “Too faint on this theme”. Re-checked on every theme change (`THEME_APPLIED_EVENT`). Tests: `src/lib/version.test.ts`, `mobile/test/updates_test.dart`.

**Diagrams:** Mermaid/Plotly render inside `.md-diagram` (horizontal scroll, no overflow past the margins).
