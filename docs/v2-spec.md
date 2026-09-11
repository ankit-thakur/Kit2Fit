# Kit2Fit v2 — product spec

Score the behaviour people control, display the outcome they don't, and make the
group surface something you read in fifteen seconds rather than scroll.

**Status:** draft for build · **Scope:** scoring, logging, group surface, navigation
· **Designed for:** 5–15 people who already know each other

For how v1 and v2 coexist in AWS, see [environments.md](./environments.md).

---

## 1. What v1 got wrong

Every piece of feedback from the eight-week challenge traces to one root cause:
**v1 folded effort, outcome and rank into a single number.** Those three don't
share a unit, so the number measured none of them well.

| What people reported | Where it comes from |
| --- | --- |
| Last place can never catch up | `shared/points.ts` — 6 of 9 daily points come from minutes. A 90-minute session banks 6× a 20-minute one, an uncloseable gap over eight weeks. |
| You get points for re-losing the same pound | `createLog.ts` compares against `currentMetricValue`, which is overwritten with the *latest* log. 180 → 178 scores, → 180 doesn't, → 178 scores again. |
| Graphs are a jagged mess | `getProgress.ts` plots raw `metricValueAfter` with no smoothing. Daily weight swings ±3 lb on water alone — noise rendered as progress. |
| Goals don't translate across types | `goalCategories.ts` puts weight loss and pull-ups under one `progressive` rule. Weight moves daily and noisily; a pull-up max moves in integer steps every few weeks. |
| Can't set multiple or weekly-count goals | One goal is denormalised onto `GroupMembership`. Multiple goals aren't hard — they're structurally impossible. |

---

## 2. The pledge model

At challenge start each member declares a **pledge**: a thing they'll do, and how
many times per week. Points come from keeping your own pledge — never from volume,
and never from the outcome metric.

> **Score the behaviour you control. Display the outcome you don't.** Weight, reps
> and lifts stay in the app — tracked, charted, celebrated — and are worth zero
> points.

### Rules

**R1 — Every pledge is weekly.** A pledge is `targetPerWeek: 1–7`. There is no such
thing as a daily pledge; "meditate every day" is a weekly pledge with target 7. One
shape, one scoring rule.

**R2 — Adherence is total kept over total pledged.**
`adherence = sum(completions) / sum(targets)` across all of a member's pledges. The
denominator is their own commitment load, so adding a pledge raises the ceiling and
the floor together.

**R3 — Adding a pledge is score-neutral in expectation.** If you keep a new pledge
as reliably as your existing ones, your adherence doesn't move. It only shifts when
your reliability differs between pledges — which is what a score should tell you.

**R4 — Each pledge caps at its own target.** Five sessions against a target of three
counts as three. Overachievement in one pledge can never paper over a miss in
another.

**R5 — One completion per pledge per day.** Unique on `(userId, pledgeId, date)`.
Three workouts on Sunday do not satisfy a 3×/week pledge — the pledge is about
frequency.

**R6 — Partial credit always.** Two of three is 67%, not zero. Punishing a near-miss
as hard as doing nothing is the demotivating dynamic v2 exists to remove.

**R7 — Hitting the full target earns a streak week.** Adherence is the continuous
currency; the streak is the discrete one you brag about. Streaks are *per pledge*,
not aggregate — a composite streak would make multi-pledge members structurally
worse at streaks.

**R8 — Total weekly commitments are capped.** Default 14. Without a ceiling, a
member can pad with easy pledges to dilute misses.

**R9 — Pledges are set at challenge start, visible to the group, and locked.**
Sandbagging is handled socially, not in code.

**R10 — The leaderboard shows the pledge next to the score.** `Sam · 100% · 2
runs/wk` beside `Dana · 86% · 7 moves/wk` is self-documenting. Score reliability;
admire ambition.

> **R4, R5 and the detail-never-scores rule in §4 are invariants.** If any one is
> relaxed later for a seemingly good reason, the model collapses back to v1's
> failure mode.

### Vocabulary

"Kept" is retired — it read as jargon. Use **done** for completions ("6 of 8 done"),
**streak** for consecutive full weeks, and **target met** for a finished pledge.
Where a noun for a full week is unavoidable it is a *full week*, never a clean or
perfect one.

---

## 3. Worked example

Three members, wildly different targets, two weeks.

| Member | Pledges | Done | Pledged | Adherence | Streak week |
| --- | --- | --: | --: | --: | --- |
| Ankit | Strength 3 + eating 5 | 7 | 8 | 88% | — |
| Dana | Move 7 | 5 | 7 | 71% | — |
| Sam | Run 2 | 1 | 2 | 50% | — |
| Ankit | Strength 3 + eating 5 | 8 | 8 | 100% | yes |
| Dana | Move 7 | 7 | 7 | 100% | yes |
| Sam | Run 2 | 2 | 2 | 100% | yes |

In week 2, Sam ran twice for twenty minutes and Dana moved seven days. Both kept
their word; both score 100%. Under v1's duration points that fortnight reads Dana
24, Ankit 20, Sam 3 — Sam is eight times behind and finished. That single row is the
whole thesis.

---

## 4. Logging

**Log the activity, derive the completion.** One tap satisfies a pledge. Detail —
what you did, how long, what you lifted, today's weigh-in — is optional, and it is
what gives your tile something to show and the outcome charts their numbers.

> **Detail never touches the score.** Ninety minutes and twenty minutes both produce
> exactly one completion. This is the rule that stops volume creeping back in the way
> it did in v1.

Logging a metric alongside a completion marks that metric tracked for the day.
Metrics render on the member's own charts and tile, and never in the standings.

### Charts

- **Noisy metrics** (weight): a 7-day trailing average as the line, raw weigh-ins as
  faded points behind it. Never plot raw dailies as the primary series.
- **Step metrics** (rep max, lift PR): a step chart, not a line — a pull-up max
  genuinely is flat until it isn't.
- **Adherence**: weekly bars, bounded 0–100.

---

## 5. The group surface

**A daily board, not a feed.** A feed is infinite and asynchronous, and that fight
is already lost to Strava. The board is bounded — one tile per member, resets daily,
nothing to scroll past.

Each member's tile shows whatever they last did: a photo, a workout line with their
week dots, or a tracked number with a sparkline. Members who haven't logged get a
quiet tile with a low-key nudge action.

### Tile ordering

```
order = (memberIndex + dayNumber) mod N    // daily rotation
```

- Stable for the whole day, so nothing reshuffles while you scroll.
- Everyone occupies the top slot equally often over N days.
- Explainable in one sentence, unlike a random draw — which is fair in aggregate but
  can still bury the same person twice running, and destroys position as a way to
  find your friend.

> **Content sets a tile's visual weight, never its position.** A photo tile is richer
> and a fresh one gets a highlight ring — but it does not jump the queue. Ranking by
> content would put the two people who post photos permanently on top and sink
> everyone else, which is the last-place dynamic reappearing in layout after being
> removed from scoring.

---

## 6. Events — "join my workout"

The differentiator. Every fitness app tracks; almost none coordinate. An event is
forward-looking — a commitment device and a social appointment — which turns the app
from a record you fill in afterwards into an invitation you respond to.

An event carries a time, a theme, and a location or "virtual". Tapping **Join** opens
a bottom sheet offering **In person** and **Virtually**; the organiser sees who is
coming and in which mode.

### Lifecycle

The card never disappears — it *decays into a tile*, so the event ends by becoming
the group photo rather than being deleted.

| Window | Phase | What it is |
| --- | --- | --- |
| until start | Upcoming | Join card pinned above the tile grid, both join modes offered |
| start → +3h | Live | Reads "happening now". Late joins still accepted |
| +3h → midnight | Wrap | Collapses into the grid as a shared photo slot every attendee can add to |
| next day | Done | An ordinary tile carrying the group photo |

Three hours, not one: people finish, shower, and post later. A short window kills the
photo moment, which is the entire payoff. The organiser may close an event early but
never has to.

### Creating one

- **Group detail** (inside the You tab) — the primary entry point.
- **Your week** — a secondary ingress while you're already logging.
- **Dashboard empty state** — when nobody is hosting, the join slot reads "Nobody's
  hosting today — start something." The highest-intent moment in the app.

---

## 7. Screens & navigation

Three tabs: **Home · Your week · You**

### Home — `/`
- Group name, challenge week, days left
- Your week summary: adherence ring, per-pledge dot rows, streak. Read-only; opens Your week
- Upcoming event card, if any
- Member tile grid, 2 columns, daily rotation

### Your week — `/week`
- Aggregate adherence, settles Sunday
- One card per pledge: tappable dots, fraction, per-pledge streak, log action
- Optional detail entry — never scored
- Tracked metric charts
- Secondary create-event ingress

### You — `/you`
- Profile: name, nickname, photo
- A card per group; pledges nest inside each
- Members, invite link, admin controls
- Primary create-event entry point

> Pledges belong to a *membership*, not a user — the same person can run a 3×/week
> strength pledge with friends and a different one at work. Any flat "your pledges"
> list is wrong.

---

## 8. Visual system

Dark base with bright accents, drawn from the existing tokens in
`frontend/tailwind.config.ts` re-weighted for a dark ground. Nothing new was invented.

| Role | Token | Hex |
| --- | --- | --- |
| Base | ink-dark | `#0A1426` |
| Surface | ink | `#14213D` |
| Border | — | `#23335A` |
| Accent (progress) | seafoam | `#6FD6C8` |
| Action (events) | coral | `#F6635C` |
| Text | cream | `#F7F3E8` |

- **Seafoam** is progress and completion: filled dots, the adherence ring, positive deltas.
- **Coral** is action and events: join card border, primary buttons, streak flame. Once or twice per screen, never more.
- Secondary text is cream at 55% opacity; tertiary at 38%.

**Type.** Space Grotesk 600/700 for screen titles, numerals and card headings; Inter
400/500/600 for everything else; section labels at 11px / 0.07em / uppercase.

**Components.**
- Cards — 16px radius, 1px border, 14–16px padding. No shadows on dark.
- Tiles — square, 16px radius, 10px grid gap, 2 columns. Photo tiles carry a bottom gradient scrim.
- Completion dots — one per unit of target. 13px on summaries, 38px where tappable. Filled dots carry a soft accent glow.
- Adherence ring — the only place a percentage is drawn as an arc, because it is the only true percentage in the app.
- Buttons — 999px radius, 44px minimum height.
- Bottom sheet — 22px top radius, grabber, scrim at 62%.
- Icons — inline SVG on a 24px grid, 2px stroke. No emoji, including in the tab bar.

> **Dots for counts, ring for the aggregate.** Dots encode the target in the mark
> itself — three dots *is* three. A ring can't distinguish 2-of-3 from 67% of
> anything, so it's wrong for a pledge and right for the one real percentage.

---

## 9. Data model

`Completion` replaces the metric-comparison logic entirely — it is a fact, not a
judgment, which is what kills the sawtooth at the root instead of patching it.

```
Pledge
  groupId, userId, pledgeId
  label            "Strength"
  targetPerWeek    1-7
  metricKind?      weight | reps | lift | none — tracked, never scored
  lockedAt

Completion
  groupIdUserId, date, pledgeId
  detail?          { minutes, note, metricValue } — optional, unscored
  photoKey?
  UNIQUE (userId, pledgeId, date)

WeekScore                       materialised at week close
  groupId, userId, weekStart
  completed, target, adherencePct, fullWeek

Event
  groupId, eventId, hostUserId
  startsAt, theme, location?, isVirtual
  closedAt?        organiser may close early

EventRsvp
  eventId, userId, mode         in_person | virtual
```

Gone from v1: `previousMetricValue`, `currentMetricValue` comparisons,
`durationPoints`, `kitBonusPoint`, and the LLM judge that decided whether a workout
counted toward a goal. Nothing in v2 has to decide whether a workout "counts".

DynamoDB key shapes for these tables are in [environments.md](./environments.md#v2-key-shapes).

---

## 10. Carried-over bugs

| Bug | Detail | In v2 |
| --- | --- | --- |
| Kit bonus never fires when Kit hasn't logged | `kitBonus.ts:10` returns 0 whenever `kitTotalPoints` is `null`, and `getKitLog` returns `null` with no log. If Kit skips a day, nobody gets the bonus — the opposite of intent. | Delete. "Beat one named person" is the most demotivating mechanic in the app. |
| Challenges hardcoded to 1 point | `AdhocChallenge` has no `points` field; `createLog.ts:81` hardcodes `matched ? 1 : 0`. | Moot — challenges become events, which carry no points. |
| Sawtooth metric scoring | Comparison against last-seen value, not best-ever or a trajectory. | Fixed structurally: metrics no longer score. |

---

## 11. Sequencing

Each phase is shippable on its own, and phase 2 should run for a real challenge
before phase 3 is built.

| Phase | Ships | Why here |
| --: | --- | --- |
| 1 | Bug fixes on v1 | Keeps the current app usable while v2 is built. No redesign. |
| 2 | Scoring reset: completions, adherence, streaks; metrics decoupled from points | Smallest change with the largest effect on the last-place problem. Test the thesis before building anything new. |
| 3 | Pledges: real entity, multiple per membership, weekly targets, commitment cap | The schema migration. |
| 4 | Group surface: member tiles, daily rotation, photos | Depends on completions carrying optional detail from phase 2. |
| 5 | Events: create, RSVP modes, lifecycle, shared photo slot | The differentiator. Needs the tile grid to decay into. |
| 6 | Charts per metric kind | Cosmetic until there's enough phase-3 data to plot. |

---

## 12. Open questions

Sections 1–11 are settled. These are not.

**Where do quiet members sit in the rotation?** Daily rotation gives them equal
position, but a member who hasn't logged in a week arguably needs surfacing rather
than fairness. Weighting them upward risks reading as a public callout. Currently:
pure rotation, quiet treatment on the tile only.

**Does the viewer's own tile rotate, or pin first?** Pinning makes you easy to find;
rotating makes you a peer rather than the protagonist. Currently rotating.

**What does the daily board mean for you specifically?** "Logged today" is daily;
pledge progress is weekly. Your own tile currently reads as logged regardless of
pledge state. Not wrong, but undecided.

**Is flat scoring too flat for the competitive members?** Binary completion may drain
the fun for whoever enjoyed the volume race. Keeping total minutes and longest
session visible as unscored status is the hedge; a handicap system (score against
your own prior baseline) preserves more tension if the group skews competitive.

**Does "ate clean" survive contact with self-reporting?** It's fuzzy and
unverifiable — the same surface that invited workarounds in v1. Tolerable while
nothing rides on it but adherence to your own pledge; revisit if it's gamed.
