# Design system

This product follows **[Geist](https://vercel.com/geist)**, Vercel's design system.
Geist is chosen for its restraint: flat surfaces, 1px borders, a fixed type ramp
and a 4pt grid. That suits a tool people keep open all day better than a
decorative system would.

**The rule: every value cites a token below. No arbitrary values — no
`text-[12.5px]`, no `gap-x-14`, no one-off hex codes.**

---

## What we take from Geist, and what we change

| | |
|---|---|
| **Typeface** | **Substituted.** Instrument Sans replaces Geist Sans. Same brief — a neutral grotesque built for interfaces — but with terminals and a lowercase `g` that give a page title some voice at display sizes, where Geist read as anonymous. Geist Mono is kept for the rare monospaced run. |
| **Type ramp** | Geist's `copy` / `label` / `heading` / `button` steps, verbatim. |
| **Grid** | Geist's 4pt grid. |
| **Colour structure** | Geist's 10-step scales with Geist's role-per-step semantics. |
| **Colour values** | **Substituted.** The client's brand (blue `#5B88F7`, yellow `#FFC72C`) replaces Geist's own accent hues. The scale *structure* and step *roles* are unchanged, so components still read `blue-700` for a solid and `gray-400` for a border. |
| **Third-party UI** | **One import.** BlockNote provides the description editor. It arrives with its own greys, radii and font; `packages/ui/src/editor/blocknote.css` re-points every one of them at a token here. The Ariakit build, not the default Mantine one — `@mantine/hooks@9` calls React&rsquo;s `useEffectEvent`, which React 19.2 does not have. |
| **Surfaces** | **One addition.** Geist has no dark editorial surface; the brief requires navy for leadership summaries. `navy` is a documented exception, used only for the Senior Director hero. |

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
background-200  #FAFBFC   the app shell

gray      100 #F4F5F7  200 #EBECF0  300 #E1E3E9  400 #D2D5DE  500 #B4B8C4
          600 #8B90A0  700 #6F7482  800 #4E5361  900 #363B49  1000 #202335

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
- Everything else is gray.

---

## Type

Geist's ramp. Size, line-height, weight and tracking are fixed together —
never mix a size from one step with the leading of another.

```
copy-13     13 / 18   400   -0.24px    dense secondary text
copy-14     14 / 20   400   -0.16px    body
copy-16     16 / 24   400   -0.32px    lead paragraph

label-12    12 / 16   500   -0.02px    eyebrows, metadata
label-14    14 / 20   500   -0.16px    table headers, form labels
label-16    16 / 24   500   -0.32px    row titles
label-18    18 / 24   500   -0.40px
label-20    20 / 26   500   -0.44px

heading-16  16 / 24   600   -0.32px
heading-20  20 / 26   600   -0.40px    section titles
heading-24  24 / 32   600   -0.58px    card titles
heading-32  32 / 40   600   -1.28px    page titles
heading-40  40 / 48   600   -1.60px
heading-48  48 / 56   600   -2.16px    hero
heading-64  64 / 72   600   -3.20px    the metric
heading-72  72 / 80   600   -4.32px    the department number

button-14   14 / 20   500   -0.16px

avatar-xs    9 / 1    500              initials in a 16px avatar
avatar-sm   10 / 1    500              initials in a 24px avatar
```

`avatar-xs` and `avatar-sm` sit below Geist's smallest step. They exist because
avatar initials at 16px and 24px genuinely need it, and they are named tokens so
the rule holds: no value is picked by eye at a call site.

Weights stop at 600. Geist does not shout.

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

## Radius

```
radius-6    6px    inputs, badges, small controls
radius-8    8px    buttons, rows
radius-12  12px    cards, panels
rounded-full       avatars, pills, progress tracks
```

---

## Elevation

**Border first.** A 1px `gray-400` border is the default way to separate a
surface. Shadow is for things that genuinely float above the page.

```
flat      1px border, no shadow          cards, lists, panels
shadow-small     0 1px 2px rgba(0,0,0,.04)   raised card, hover state
shadow-medium    0 4px 8px rgba(0,0,0,.06)   popovers
shadow-large     0 12px 24px rgba(0,0,0,.10) dialogs, dropdowns
```

The navy hero is the one surface allowed a coloured shadow.

---

## Components

Built on shadcn/ui (Radix primitives), themed through the tokens above.
Domain components live in `src/components/app/` and are shown, in every state,
at **`/design`**. If a component is not on that page, it does not exist yet.
