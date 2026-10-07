# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: ranked MLBB player mid-draft on a phone. Seconds per pick/ban. Switches between the MLBB game and this app. Needs a fast answer, not a research session.

## Product Purpose

MLBB Draft Coach recommends picks and bans during a live draft. It exists to turn counter relationships, meta tier, team synergy, and patch data into one quick decision. Success means the user picks/bans correctly before the draft clock runs out, even after switching apps.

## Positioning

Free with no login. Recommendations come from a counter-math engine over a large counter-relation dataset, not from tier-list hype alone. Built to stay fast on low-end phones.

## Operating Context

Live ranked draft workflow: enter allies, enemies, and bans; read suggested picks/bans; fix synergy warnings and missing roles. Used on mobile, usually portrait, often under time pressure and app-switching. Static-only product: no server, login, or AI backend.

## Capabilities and Constraints

Confirmed capabilities: ally/enemy lines plus our/enemy bans; hero scoring and ranking; suggested picks and bans; counter and synergy tags; anti-synergy warnings; missing lane/role gaps including frontline and damage; draft rating and win chance; search plus lane/role/tier filters; Indonesian default with English toggle; local draft persistence across reloads.

Constraints: static-only; no backend, login, or AI. Local JSON data for heroes, counters, synergies, meta, and patches. Terminology stays close to draft use: allies, enemies, bans, counters, synergy, tier, patch.

## Brand Commitments

Name: MLBB Draft Coach. Short name: MLBB Draft. Existing assets include app icons, web manifest, and social/OG assets under `public/`. No new brand voice or identity was established in this interview.

## Evidence on Hand

Real data and code paths: `data/heroes.json`, `data/counters.json`, `data/synergies.json`, `data/meta.json`, `data/patches.json`; update scripts in `scripts/`; app entry in `src/App.tsx`. No testimonials, customers, benchmarks, pricing, or licensing claims on hand; future work must not fabricate them.

## Product Principles

1. Draft clock rules: speed beats depth during live picks.
2. Draft survives interruption: app-switch, reload, or tab loss must not lose the draft.
3. Free, login-free, and static: no backend dependency for core use.
4. Counters plus team fit decide: counter coverage and composition needs outweigh tier hype.
5. Low-end phones are first-class: small payload, fast interaction, touch-first.
