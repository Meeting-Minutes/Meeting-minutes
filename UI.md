# UI Design System

Inspired by Discord's layout + macOS visual polish.

## Layout

```
┌─────────┬──────────────┬────────────────────────────────────────────┐
│ Server  │ Channel      │ Main content                               │
│ bar     │ sidebar      │                                            │
│ 72px    │ 240px        │ (flex-1)                                   │
├─────────┴──────────────┴────────────────────────────────────────────┤
│                      frosted glass top bar (49px)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                     Content area (overflow-y-auto)                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

- **Server bar**: 72px, `bg-bg-tertiary`, org initials as rounded buttons
- **Channel sidebar**: 240px, `bg-bg-secondary`, team list + add button
- **Top bar**: `frost` (backdrop blur), 49px, sticky, shows current context name
- **Content**: flexible, scrollable, max content width ~768px (`max-w-3xl`)

## Colors

Tokens defined in `globals.css` via Tailwind v4 `@theme inline`:

| Token | Value | Usage |
|---|---|---|
| `bg-primary` | `#313338` | Main content background |
| `bg-secondary` | `#2b2d31` | Sidebar background |
| `bg-tertiary` | `#1e1f22` | Server bar, inputs |
| `surface` | `#383a40` | Cards, elevated surfaces |
| `surface-hover` | `#3f4147` | Hover state for surface elements |
| `accent` | `#5865f2` | Primary buttons, focus rings |
| `accent-hover` | `#4752c4` | Button hover |
| `text-normal` | `#dbdee1` | Primary text |
| `text-muted` | `#949ba4` | Secondary text, placeholders |
| `border` | `#3f4147` | Borders (`border-border/50` for subtle) |
| `danger` | `#da373c` | Destructive actions, errors |
| `success` | `#23a55a` | Positive actions |

## Typography

- Font: `--font-geist-sans`, system-ui, -apple-system, sans-serif
- Text is `antialiased` (macOS subpixel rendering)
- Headers: `text-[15px]` or `text-xl`, `font-semibold` or `font-bold`
- Section labels: `text-[11px]`, `font-semibold`, `uppercase`, `tracking-widest`, `text-text-muted`
- Body: `text-sm` or `text-xs`, `text-text-normal` or `text-text-muted`
- Descriptions: `text-sm`, `leading-relaxed`, `text-text-muted`

## Spacing

8px grid:
- `p-6` (24px) for main content area padding
- `p-5` for cards
- `p-4` for dense cards (members section)
- `gap-3` (12px) for button groups
- `space-y-5` (20px) between content sections

## Cards

```html
<div class="bg-surface rounded-xl border border-border/50 p-5">
```

- `rounded-xl` (12px) for all cards
- Subtle border with `border-border/50`
- No box-shadow (uses background separation instead)

## Buttons

**Primary**: `bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium px-5 py-2`
**Ghost**: `text-text-muted hover:text-text-normal px-2 py-1 rounded-md hover:bg-surface/50`
**Danger ghost**: `text-text-muted hover:text-danger`
**Disabled**: `disabled:bg-accent/50` or `disabled:opacity-50`

## Inputs

Globally styled in `globals.css`:
- `bg-bg-input` (`#1e1f22`)
- `border border-border`, `rounded-lg`
- Focus: `border-accent` + `box-shadow` ring
- Padding: `px-3.5 py-2.5 text-sm` inside cards

## Modals

`ModalOverlay` provides backdrop blur + click-outside-to-close. `FormModal` pattern:
- Width: `400px`
- `bg-bg-primary rounded-xl p-6 shadow-2xl border border-border/50`
- Backdrop: `bg-black/50 backdrop-blur-sm`
- Submit disabled when `creating` or name field empty

## Member Rows

Hover-reveal "Remove" button:
- Default: only avatar + name + email visible
- On hover: `opacity-0 group-hover:opacity-100` reveals remove action
- `rounded-lg hover:bg-surface-hover/50` for row hover

## Frosted Glass

`.frost` class: `background: rgba(49,51,56,0.8); backdrop-filter: blur(12px)`
Used on the sticky top bar. The semi-transparent background lets the scrollable content show through the blur.

## Scrollbar

Custom thin dark scrollbar (webkit-only):
- Width: 8px, thumb: `#1e1f22`, hover: `#2b2d31`
- Track: transparent

## Modals vs Popovers

Use modals (`ModalOverlay` + centered dialog) for forms. Avoid popovers/dropdowns unless the action is trivial .