# Design system

This product follows **[Fluent 2](https://fluent2.microsoft.design/)**,
Microsoft's design system — the one Azure DevOps is built on. Fluent is chosen
because this is a tool people keep open all day and read far more than they
admire: a compact type ramp with no decorative tracking, a left rail that puts
navigation in the same place on every screen, and rows dense enough that a
fifteen-person team fits on one.

It replaces Geist, which the first version followed. Geist is a display system —
its ramp tracks tight and runs to 72px, and it earns that on a marketing page.
Here it made a task list look like a landing page.

**The rule: every value cites a token below. No arbitrary values — no
`text-[12.5px]`, no `gap-x-14`, no one-off hex codes.**

A token also has to be declared to the **class merger**, not only to Tailwind.
`cn` resolves `text-<x>` as a font size only for steps it knows, and treats the
rest as colours — so `cn("text-body", "text-gray-700")` silently dropped the
size. The ramp is registered in `packages/ui/src/lib/utils.ts`; a new step goes
in both places or it will disappear wherever classes are merged.

---

## What we take from Fluent, and what we change

| | |
|---|---|
| **Typeface** | **Substituted.** Fluent specifies Segoe UI, which is a Microsoft licence and a Windows-only face in practice. Instrument Sans stands in: the same brief — a neutral grotesque built for interfaces — at the same sizes and weights. Geist Mono is kept for the rare monospaced run. |
| **Type ramp** | Fluent's ramp, verbatim: caption / body / subtitle / title / display. Letter-spacing is zero at every size and headings are semibold, not bold. |
| **Grid** | Fluent's 4pt grid. |
| **Colour structure** | 10-step scales with a role per step, carried over from the first version — Fluent's own ramps are a different shape, but the discipline of picking a step by its job rather than by eye is the part worth keeping. |
| **Colour values** | **Split.** The neutrals are Fluent's, which are a true grey rather than the blue-tinted grey a display system tends to use. The accents stay the client's brand (blue `#5B88F7`, yellow `#FFC72C`) rather than Fluent's communication blue `#0078D4` — the brief specifies the palette, and one token changes it if that is ever wrong. |
| **Third-party UI** | **One import.** BlockNote provides the description editor. It arrives with its own greys, radii and font; `packages/ui/src/editor/blocknote.css` re-points every one of them at a token here. The Ariakit build, not the default Mantine one — `@mantine/hooks@9` calls React&rsquo;s `useEffectEvent`, which React 19.2 does not have. |
| **Icons** | **Substituted.** Fluent specifies Fluent UI System Icons; we use Lucide at `1.75` stroke, which is the same weight and metric and was already in the tree. Every icon is paired with its word — a bar of glyphs alone is a guessing game. |
| **Surfaces** | **One addition.** Fluent has no dark editorial surface; the brief requires navy for leadership summaries. `navy` is a documented exception, used only for the Senior Director hero. |

---

## Colour

Ten steps per scale. Each step has one job — pick by role, never by eye.

| Step | Role |
|---|---|
| `100` | Subtle background |
| `200` | Subtle background, hover |
| `300` | Muted background |
| `400` | **Border** |
| `500` | Border, hover · disabled text |
| `600` | Placeholder text |
| `700` | **Solid background** · secondary text |
| `800` | Solid background, hover |
| `900` | Primary text |
| `1000` | High-contrast text and headings |

### Scales

```
background-100  #FFFFFF   the working surface
background-200  #FAF9F8   the app shell

gray      100 #F5F5F5  200 #EBEBEB  300 #E0E0E0  400 #D1D1D1  500 #B3B3B3
          600 #8A8A8A  700 #707070  800 #575757  900 #3D3D3D  1000 #242424
          ^ Fluent's neutrals: a true grey, no blue in it

blue      100 #F1F5FE  200 #E4ECFD  300 #D0DEFC  400 #B6CCFB  500 #93B2F9
          600 #7099F8  700 #5B88F7  800 #4F79E8  900 #3A63C9  1000 #24407F
                       ^ brand      ^ hover      ^ text on tint

amber     100 #FFF8E6  200 #FFF0C7  300 #FFE49B  400 #FFD86E  500 #FFC72C
          600 #E5AE12  700 #B88A00  800 #8F6B00  900 #6B5000  1000 #402F00
                                                 ^ brand yellow

red       100 #FEF3F3  200 #FCE4E4  300 #F8CDCD  400 #F2AEAE  500 #E88A8A
          600 #DE7272  700 #D85C5C  800 #C44A4A  900 #A33A3A  1000 #6B2323

green     100 #EDF7F2  200 #D8EFE3  300 #B9E2CE  400 #8FD0B2  500 #63BC93
          600 #4AAF81  700 #3BA272  800 #328C62  900 #29714F  1000 #1A4630
```

### Where colour is allowed

- **Blue** carries identity and actions. `blue-700` solid, `blue-100` tint, `blue-900` for text on a tint.
- **Navy** (`#2D3148`) is the leadership hero only. Nowhere else.
- **Amber** is the single most important number on a screen, and nothing else. Usually one per page.
- **Red / green** report state, never decoration.
- **Avatars** are the one place a colour is chosen by algorithm rather than by
  meaning: a solid `900`-step disc with white initials, hashed from the name.
  Solid rather than tinted because at 24px a filled disc is legible as a colour
  before it is legible as letters, and every step used clears 5:1 against white.
- Everything else is gray.

---

## Type

Fluent's ramp. Size, line-height and weight are fixed together — never mix a
size from one step with the leading of another.

Two things separate it from the display ramp it replaced, and both are the
point: **letter-spacing is zero at every size**, and **headings are semibold,
not bold**. Nothing is tracked tight to look designed. A 32px title is a 32px
title.

```
caption          12 / 16   400   metadata, secondary detail
caption-strong   12 / 16   600   eyebrows, column headers

body             14 / 20   400   the default
body-strong      14 / 20   600   row titles, form labels, commands
body-lg          16 / 22   400   lead paragraph

subtitle-2       16 / 22   600   card titles
subtitle-1       20 / 26   600   section titles

title-3          24 / 32   600
title-2          28 / 36   600
title-1          32 / 40   600   page titles

large-title      40 / 52   600   hero
display          68 / 92   600   the department number

avatar-xs         9 / 16   600   initials in a 16px avatar
avatar-sm        11 / 24   600   initials in a 24px avatar
```

`avatar-xs` and `avatar-sm` sit below Fluent's smallest step. They exist
because avatar initials at 16px and 24px genuinely need it, and they are named
tokens so the rule holds: no value is picked by eye at a call site.

Weights stop at 600. Fluent does not shout.

Numbers in metrics use `tabular-nums` so they do not jitter as they change.

---

## Space

4pt grid. These steps only:

```
4   8   12   16   24   32   48   64   96
```

In Tailwind: `1 2 3 4 6 8 12 16 24`. Half steps (`1.5`, `3.5`), `5`, `7`, `9`,
`11`, `14` and bracket values are not part of the system.

---

## Motion

Fluent's durations and curves. Three steps, because a tool people keep open all
day should move enough to acknowledge what they did and then stop.

```
duration-faster   100ms   a state change — colour, opacity, a tick
duration-fast     150ms   a thing moving aside to make room
duration-normal   200ms   a thing arriving or leaving

ease-standard     cubic-bezier(.33, 0, .67, 1)   Fluent's easy-ease
ease-decelerate   cubic-bezier(.1, .9, .2, 1)    entering: fast in, settles
```

Nothing is animated for decoration. Movement earns its place by telling you
something happened — a card moving aside is saying where the one you are
dragging will land.

**Reduced motion is honoured, and not only in CSS.** `theme.css` flattens every
transition and animation to `0.01ms` under `prefers-reduced-motion`, which
covers class-based and inline styles alike. Anything scripted — a drag overlay's
drop animation, say — has to check `matchMedia` itself and skip the animation
rather than shorten it.

---

## Radius

Fluent's four steps. Squarer than a consumer system, which is what keeps a
dense screen from reading as a toy.

```
radius-sm   2px    the smallest chips and marks
radius-md   4px    inputs, buttons, commands, nav items
radius-lg   6px    rows, cards
radius-xl   8px    panels, dialogs
rounded-full       avatars, pills, progress tracks
```

---

## Elevation

**Border first.** A 1px `gray-400` border is the default way to separate a
surface. Shadow is for things that genuinely float above the page.

Fluent pairs an ambient ring with a directional drop, so a raised surface
reads as raised from any angle rather than only from above.

```
flat             1px border, no shadow                        cards, lists, panels
shadow-small     0 1px 2px rgba(0,0,0,.14), 0 0 2px .12       raised card, hover
shadow-medium    0 4px 8px rgba(0,0,0,.14), 0 0 2px .12       popovers
shadow-large     0 8px 16px rgba(0,0,0,.14), 0 0 2px .12      dialogs, dropdowns
```

The navy hero is the one surface allowed a coloured shadow.

---

## Components

Built on shadcn/ui over **Base UI** (not Radix — Base UI composes with a
`render` prop where Radix uses `asChild`), themed through the tokens above.
Domain components live in `packages/ui/src/components` and are shown, in every
state, at **`/design`**. If a component is not on that page, it does not exist
yet.

### Layout

Navigation is a **left rail**, not a top bar: the set is small, role-derived and
never grows, so it can sit in the same place on every screen and hand the
working area the full width of the window. The active item carries a leading
bar as well as a tint, so it survives being read without colour.

The rail has two levels and one heading. Global items sit at the top and the
foot; between them, under **ACCOUNTS**, each client **expands** into the four
pages that belong to it. Expanded, not a dropdown: a popover would hide four
items behind a click and add the only floating layer in the rail.

An account's name both navigates and opens — it goes to that client's Overview
and reveals the rest — while the chevron only opens, for looking without
leaving. That is the opposite of the rule the rail used to follow, and the
reason is that a client is a container rather than a page: a row that went
somewhere without opening, or opened without going anywhere, was the more
surprising of the two every time. One account is open at a time; the group
follows the route until someone works a chevron, after which it is their
choice.

The parent row is never tinted. Overview is one of the four children, so on an
account's front page that child carries the active state — marking the client's
name as well would highlight two rows for one page.

Page-level verbs go in a **command bar** under the title — icon plus word,
divided into groups. A page has exactly one primary button, and it is never in
there.
