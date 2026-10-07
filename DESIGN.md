---
name: MLBB Draft Coach
description: A dark, nocturnal war-table UI for making MLBB draft picks under time pressure.
colors:
  draft-gold: "#fbbf24"
  gold-deep: "#b45309"
  ally-signal: "#3b82f6"
  enemy-signal: "#f87171"
  war-room-night: "#070b18"
  tactical-slate: "#141c33"
  slate-deep: "#0c1322"
  ink: "#eef2fa"
  muted: "#b3bdd2"
  line: "#2a3552"
  goldline: "rgba(251, 191, 36, 0.35)"
  synergy-green: "#6ee7b7"
  tier-strong: "#22c55e"
  tier-weak: "#aab4c8"
  tier-avoid: "#ef4444"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "19px"
    fontWeight: 800
    letterSpacing: "0.06em"
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 800
    letterSpacing: "0.12em"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.2
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "11px"
    fontWeight: 700
rounded:
  card: "12px"
  control: "10px"
  inner: "8px"
  pill: "99px"
  round: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "linear-gradient(180deg, #223052, #1a2440)"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  button-primary-hover:
    backgroundColor: "#2a3a63"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  button-ban:
    backgroundColor: "rgba(248, 113, 113, 0.14)"
    textColor: "#fca5a5"
    rounded: "{rounded.control}"
    padding: "6px 4px"
  chip-tier-s:
    textColor: "{colors.draft-gold}"
    rounded: "{rounded.pill}"
    padding: "1px 7px"
  chip-counter:
    textColor: "{colors.draft-gold}"
    rounded: "{rounded.pill}"
    padding: "1px 7px"
  input-search:
    backgroundColor: "{colors.slate-deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  card-draft:
    backgroundColor: "linear-gradient(180deg, #16203c 0%, #101830 100%)"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "8px"
  rate-fill:
    backgroundColor: "linear-gradient(90deg, #b45309, #fbbf24)"
    rounded: "3px"
    height: "6px"
---

# Design System: MLBB Draft Coach

## Overview

**Creative North Star: "The War Table"**

A dark command surface for the draft clock, not a catalog. Everything reads as ally/enemy intel at a glance: side-toned boards, glowing tier rings, gold verdict numbers. The mood is tense, decisive, nocturnal — density is a feature because the user has seconds, but every control stays thumb-reachable and every destructive action confirms in place.

**Key Characteristics:**
- Nocturnal navy ground with gold reserved for verdicts
- Ally blue vs enemy red is the primary spatial language
- Dense but thumb-first: small visuals, full-size hit zones
- Flat tonal layering; shadows only where floating chrome needs separation

## Colors

One verdict gold on a nocturnal navy ground; blue and red carry team identity everywhere.

### Primary
- **Draft Gold** (#fbbf24): verdicts only — scores, win chance, section titles, tier-S rings, counter chips. Its rarity is the point.

### Secondary
- **Ally Signal** (#3b82f6): everything belonging to your team — board side tab, rating bar, role color for Tank.
- **Enemy Signal** (#f87171): everything belonging to the enemy team — board side tab, ban buttons, rating bar.

### Neutral
- **War-Room Night** (#070b18): app ground, with a faint radial lift toward navy at the top edge.
- **Tactical Slate** (#141c33): card surfaces.
- **Slate Deep** (#0c1322): recessed surfaces — inputs, suggest rows, empty slots.
- **Ink** (#eef2fa): primary text.
- **Muted** (#b3bdd2): secondary text, chevrons, unselected states.
- **Line** (#2a3552): borders and dividers.
- **Goldline** (rgba(251, 191, 36, 0.35)): the faint gold top edge on cards and the counter-chip border — gold at whisper volume, not verdict volume.

### Semantic families (fixed vocabularies, not free color)
- **Role colors:** Tank #3b82f6, Fighter #f97316, Assassin #a855f7, Mage #22d3ee, Marksman #ef4444, Support #22c55e. Used for legend dots and role identity.
- **Tier rings:** S reuses Draft Gold (with glow), A reuses #22c55e, B reuses Ally Signal, C is #aab4c8 (no border emphasis), D is #ef4444.
- **Synergy Green** (#6ee7b7): synergy chips only.

### Named Rules
**The Verdict Gold Rule.** Gold appears on numbers that decide (scores, win%), titles that command, and S-tier. Never on decoration, never on neutral chrome.
**The Two Armies Rule.** Ally blue and enemy red never appear on the same element except the head-to-head rating bars, where their adjacency is the meaning.

## Typography

**Display Font:** system-ui (with -apple-system, Segoe UI fallback)
**Body Font:** system-ui (same stack; one family everywhere)

**Character:** A single system-ui stack, no webfonts — payload speed is a product principle. Hierarchy comes from weight, size, and tracked uppercase, never from a second family. All verdict numbers use tabular figures so scores don't jitter as they update.

### Hierarchy
- **Display** (800, 19px, 0.06em tracked, uppercase): the brand wordmark in the top bar, rendered in Draft Gold with a soft gold glow.
- **Title** (800, 12px, 0.12em tracked, uppercase, gold): card section headers — allies, enemies, draft rating, warnings.
- **Body** (400, 13–14px, 1.2 line height): hero names, reasons, suggestion rows.
- **Label** (700, 10–11px, uppercase with 0.12em tracking on group heads): pick/ban group heads, badges, chip text.
- **Inputs floor** (16px): search, selects, and fields never go below 16px — iOS Safari auto-zooms smaller focused controls.

### Named Rules
**The One Family Rule.** No webfonts, no second stack. Weight + tracking + gold carry the hierarchy.

## Layout

A single centered column (max-width 640px) with a 4/8/12/16/24px spacing rhythm. Draft boards use container queries so five pick slots plus five ban slots fit without horizontal scroll on narrow phones; below 360px the pick/ban action grid stacks to one column. Two floating chrome layers: the draft board summary pins to the top when the main board scrolls away, and the filter bar sticks to the bottom above the keyboard and home indicator. Safe-area insets pad the app horizontally and lift the filter bar in landscape.

## Elevation & Depth

Layered-tonal, not lifted. Depth comes from tonal steps (night → deep slate → slate) plus two ambient shadows. The one blur in the system is functional: the floating board blurs the content scrolling beneath it so mini-avatars stay legible.

### Shadow Vocabulary
- **Resting card** (`box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35)`): draft cards at rest.
- **Floating chrome** (`box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5)`): filter bar and floating board — separation from scrolled content.
- **Verdict glow** (`text-shadow: 0 0 12px rgba(251, 191, 36, 0.45)` on gold numbers; `0 0 8px` gold ring on tier-S): the only decorative light in the system, reserved for S-tier and scores.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only on floating chrome; glow appears only on verdicts and S-tier.

## Shapes

Gently rounded rects stepping down with nesting depth: cards at 12px, buttons and inputs at 10px, inner wells at 8px, chips and badges as full pills (99px), avatars as true circles. Draft boards carry a thick side tab — 3px ally blue on your board, 3px enemy red on theirs — and floating suggestion/win rows carry a slimmer 2px gold tab. Rating bars are 6px rounded tracks with a gold gradient fill for your side.

## Components

Tactile and decisive: 44px minimum targets everywhere, press-scale feedback on every tap, gold focus rings for keyboard users.

### Buttons
- **Shape:** gently rounded rect (10px radius)
- **Primary:** slate gradient face, ink text, 1px line border, 6px 12px padding, min-height 44px
- **Hover / Focus:** lighter slate face with brighter border; keyboard focus gets a 2px gold outline with 2px offset
- **Press:** scales to 0.97 with a fast 80ms transform — the tactile confirmation
- **Disabled:** 0.45 opacity, not-allowed cursor
- **Ban variant:** enemy-red tinted face with pale red text; hover deepens the tint
- **Small icon buttons:** 32px visuals with invisible 44px hit zones; adjacent pairs are spaced so zones touch, never overlap

### Chips
- **Style:** 11px bold pill, 1px border, muted text by default
- **Tier variants:** S is gold with glow; A green; B blue; C grey without border emphasis; D red
- **Counter chips:** gold text on gold-tinted border — a verdict, so gold is earned here
- **Synergy chips:** synergy-green text on green-tinted border
- **State:** chips are read-only badges; interactive filters are buttons, never chips

### Cards / Containers
- **Corner Style:** gently rounded (12px)
- **Background:** slate gradient with a faint gold top edge — the war-table felt
- **Shadow Strategy:** resting-card shadow; see Elevation
- **Internal Padding:** 8px standard, 6px dense rows

### Inputs / Fields
- **Style:** slate-deep recessed face, 1px line border, 10px radius, 16px text
- **Focus:** 2px gold outline, 2px offset — same as buttons
- **Search behavior:** sticky bottom filter bar lifts above the virtual keyboard; no focus may land in search on first paint (mobile keyboards must not open uninvited)

### Navigation
- **Top bar:** brand wordmark left, patch tag plus language toggle right; toggle guarantees 44px width
- **Bottom filter bar:** sticky island with search, lane/role/tier filters, and reset; `overscroll-behavior: contain` so list scrolls don't chain into the page
- **Floating board:** appears when the main board scrolls out of view — mini avatars with blur backing, side tabs preserved

### Draft Rating Block
- **Character:** the verdict moment — head-to-head bars with a win-chance medallion between them
- **Bars:** 6px tracks; your fill is the gold gradient, enemy fill is enemy red; the leading side gets emphasis
- **Win medallion:** bordered fieldset with tabular gold number; side-toned (blue/red/gold-tie) once both teams have picks

### Hero Rows
- **Character:** dense expandable rows — avatar with tier ring, name, score, chevron; counter/synergy badges wrap to their own full-width line so the name never squeezes
- **Expanded state:** pick group (ally/enemy) and ban group (our/their) with group heads; ban actions use the ban button variant
- **Display names always:** badges and rows show hero names, never raw slugs

## Do's and Don'ts

### Do:
- **Do** keep every interactive target at 44px minimum — grow small visuals with invisible hit zones, not bigger pixels.
- **Do** reserve gold for verdicts, S-tier, and command titles.
- **Do** keep inputs at 16px or above so iOS never auto-zooms mid-draft.
- **Do** confirm destructive actions with the two-tap arm pattern (label flips, ~2.6s window), never a blocking dialog.
- **Do** persist draft state across reloads; a discarded tab must never cost picks.

### Don't:
- **Don't** use `confirm()` or alert dialogs anywhere — they break the draft-clock flow.
- **Don't** show raw data slugs in the UI; always resolve to display names.
- **Don't** add shadows or glow for decoration — flat by default, light only on verdicts and floating chrome.
- **Don't** let the page pull-to-refresh; the body overscroll lock protects mid-draft scroll position and filter context.
- **Don't** invent testimonials, benchmarks, or usage claims — none exist on hand and the product record forbids fabricating them.
