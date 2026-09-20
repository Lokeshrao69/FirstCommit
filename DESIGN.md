# Design

A design-world record for FlowForge. Written at the completion of the 2026 frontend redesign. Tokens ship as CSS variables in `frontend/src/index.css` and Tailwind aliases in `frontend/src/tailwind.config.js`; this file is the durable visual contract.

## World

**"The Forged Instrument Console."** A warm, dark, precision control room for turning intent into safe execution. The interface reads as calibrated machinery: warm near-black planes, hairline rules, type-driven hierarchy, monospace instrument metadata, and one "forge ember" work-accent that marks live motion. Restrained, engineered, and quiet — the emotional energy is reserved for two moments: the flame (active execution) and the amber review plateau (a problem caught).

- Mode: **Operate**. Task and state clarity outrank ornament.
- Color strategy: **Restrained** (warm neutrals + one ember accent) with a strict semantic color law for status.
- Surface grammar: bordered planes and inset wells (never floating cards everywhere); hard purity of the grid; deliberate white space; small radii (controls 6px, panels 10px).
- Dark is chosen from the use scene: this console is a single-purpose work surface where the product is the stage and the user sits in front of it in controlled light (a demo booth, a focused workstation). Judges must see the artifact, not ambient chrome.

## Palette

Dark first. Colors are declared as RGB triples (Tailwind alpha-compatible).

| Role | Token | RGB | Use |
| --- | --- | --- | --- |
| Page ground | `--bg` | `14 14 13` | App canvas |
| Panel | `--surface` | `22 21 19` | Panels, wells, headers |
| Raised | `--surface-2` | `29 28 26` | Hover, popovers, chips |
| Hairline | `--border` | `41 39 36` | Panel rules |
| Strong rule | `--border-strong` | `57 52 46` | Structural dividers, focus |
| Ink | `--text` | `237 232 223` | Body text (warm off-white) |
| Secondary ink | `--text-muted` | `170 164 154` | Support text |
| Faint ink | `--text-faint` | `116 110 101` | Metadata, placeholders |
| Ember (work) | `--primary` | `255 106 51` | Brand mark, live motion, primary execution action |
| Ember bright | `--primary-hover` | `255 122 71` | Primary hover, live pulse |
| Violet (AI) | `--accent` | `158 140 255` | AI-system badges (Planner / Document AI / Validation) — chips and dots only, never fills |
| Green (validated) | `--success` | `86 189 138` | Completed/passed semantics (never decorative) |
| Amber (review) | `--warning` | `232 178 60` | Needs-attention / human review |
| Red (blocked) | `--error` | `232 88 68` | Blocked / failures |

### Color law

- Green = validated/passed. Amber = attention required (review gates, warnings). Red = blocked/stopped (fatal validation, errors). Violet = AI system activity (small markers). Ember = FlowForge "working"/live (active node, progress, primary execution action).
- Status is never conveyed by color alone: every colored status carries an icon + text. Ambient surface tints stay off; hue only surfaces the moment it means something in the state.
- Primary action on light-elements: an ember control carries dark ink (`--bg` text) so it reads "work being done", while white controls are reserved for user decisions.

## Typography

- **Display / headings:** Space Grotesk (600/700), tracking -0.02em. Mechanically geometric, warm, engineered — the console's voice.
- **UI / body:** Inter (400/500/600). Workhorse grotesk for dense operative text.
- **Instrument / mono:** IBM Plex Mono (400/500). Reserved for what is measured: identifiers, timestamps, statuses, classification tags, confidence values, workflow IDs, stepper numbers.
- Scale (Tailwind `fontSize`): `display` 40/44, `title` 26/34, `section` 17/26, `body` 15/24, `small` 13/20, `tiny` 12/16. Hierarchy by weight and size, not by card borders. Tabular mono data uses `tabular-nums`.

## Spacing, radius, depth, motion

- Spacing scale: 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64. Panels breathe with 24–40; dense metadata rows at 12–16.
- Radius: `control` 6px, `container` 10px, `pill` 999px. No giant rounded cards.
- Depth: hairline borders + subtle offset shadows (`0 1px 0`-style inner light on dark surfaces, `0 16px 48px` for overlays). No glows except one ember "live" pulse at the active execution node.
- Motion: one orchestrated vocabulary — `ff-fade`, `ff-rise` (12px, exponential ease-out), `ff-dash` (edge/dash draw), `ff-pulse` (ember live), `ff-slide` (drawer). Everything 150–260ms, gated behind `prefers-reduced-motion`. Motion answers "what just changed?", never decorates restlessly.

## Components

- `Button` — variants: `primary` (ember, dark ink), `secondary` (surface + hairline), `ghost` (borderless), `danger` (red), `success` (green for confirmations), sizes `sm`/`md`/`lg`.
- `StatusBadge` — colored dot + label, mono label, hue only from the semantic law.
- `Panel`, `Well`, `Tag`, `ProgressBar`, `Spinner`, `EmptyState`, `ErrorState`, `Dialog`, `Drawer`, `Tooltip`.
- `WorkflowNode` — a labeled node with type glyph, state ring, duration; active node carries the ember rail, blocked node is unmistakable.
- `TimelineItem` / `ExecutionTimeline` — status glyph + actor + title + timestamp + expandable detail.
- `DocumentSlot` — required-document checklist slot with collecting/classifying/extracting/validating/ready/attention states.
- `ValidationPlateau` — the hero review surface: header strip, evidence juxtaposition, decision actions.
- `ReadinessMeter` — application readiness gauge (percent + check rows; never a decorative ring).

## Signature moments

1. **The flame.** When execution is live, the active node and progress rail carry the ember "work" pulse. Energy is present but bounded.
2. **The review plateau.** A problem caught before submission is a bordered amber surface, header-stamped "REVIEW REQUIRED", with the conflicting documents side by side and clear actions. This moment must be unmistakable.
3. **The human key.** Submission is a white-key decision gate: "Nothing is sent until you click Submit." Trust, not theatre.