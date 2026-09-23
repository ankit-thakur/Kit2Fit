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

**R8 — At most three pledges, under a weekly commitment ceiling.** Three is the
rule people are shown: it bounds the screen and the cognitive load. The ceiling
(`Group.commitmentCap`, default 14) is a quiet backstop against *dilution* —
padding a third slot with something you never miss to inflate your denominator.
It surfaces only if someone hits it.

Neither cap changes how adherence is computed. R2 still pools across whatever
pledges a member holds, and R3 still holds — the cap only means the property
matters across one to three pledges rather than arbitrarily many. Do not
"simplify" later to per-pledge averaging.

**R9 — Pledges are visible, and changes take effect next week.** The current
week is locked the moment it starts. A hard lock for the whole challenge is
brittle — someone who pledges 5 and finds by week 2 that it was wrong is stuck
failing for six weeks, which produces exactly the disengagement v2 exists to
remove. Free editing is worse: it lets you lower a target on Sunday night to
save a streak, which is the actual gaming vector. Next-week-effective changes
block the rescue and allow the correction, and since R10 shows the pledge beside
the score, the group sees what changed.

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

**Log the activity, derive the completion.** One tap satisfies a pledge.

### The screen

Two marks doing two different jobs:

- **Today's pledges — a checklist.** One row per pledge, unchecked at the start
  of each day, each row carrying the pledge name and a chevron.
- **This week — dots.** The summary underneath, display only.

Dots are right for weekly progress, where completions are interchangeable — any
three workouts, not *these* three. A checklist is right for today, where the rows
are distinct things you either did or didn't. Neither mark does the other's job
well.

### The interaction

| State | Tap does |
| --- | --- |
| Row unchecked | Marks it complete **and** opens the detail sheet |
| Row already checked | Opens the detail sheet in edit mode |
| Inside the sheet | "Remove today's entry" undoes it |

The completion is recorded before the sheet appears — never a form first. If
filling in a form is the price of logging, people stop logging, and a tracker
nobody updates is dead. The sheet opening is also what makes the interaction
safe: you cannot accidentally complete something without it appearing to tell
you, so undo is always one level deep and the checkbox never needs its own
sub-44px hit target.

### The detail sheet

Everything in it is optional and none of it is scored.

| Field | Purpose |
| --- | --- |
| Title | A few words — "Bench day". Shown on the member's tile |
| Note | Longer, for their own record |
| Photo | Shown on their tile |
| Metric | One number, if the pledge defines one — "Bench 225", "Slept 8" |

> **Detail never touches the score.** Ninety minutes and twenty minutes are both
> exactly one completion. This is the rule that stops volume creeping back in the
> way it did in v1 — and the reason there is no `minutes` field: duration is a
> metric like any other if a member cares about it, never a first-class one.

### Metrics

A metric is a named number recorded on a date. Some belong to a pledge and are
captured when it is completed; some belong to the day and can be recorded on a
rest day. Those are the same record with the pledge left off, not two systems:

```
MetricEntry { groupIdUserId, date, metricKey, value, pledgeId? }
```

The distinction matters because weight is the metric people most want to track
and rest days are exactly when they weigh in. Hang it off completions only and
the series goes gappy — which is v1's jagged-graph problem returning in a new
costume.

A pledge names its own metric (`metricLabel`, `metricUnit`) rather than picking
from a list of kinds. Freeform beats an enum here for the same reason v1's
`goalCategory` failed: a fixed vocabulary never fits everyone's goal.

### No verification

Nothing checks whether the activity matches the pledge. A completion is a fact
the member asserts, and the LLM judge is gone entirely.

The consequence is that **pledge naming carries the weight instead**. Someone who
writes "Bench press 225" has painted themselves into a corner on a day they swim;
"Strength" has not. One line of onboarding copy — *name it broadly enough that a
good week counts* — does more here than any validation would.

### Backfill

Logging stays open for the previous week through **Monday**, then seals. You can
recover a day you forgot; you cannot repair a streak three weeks later.

This moves when standings settle. A week's `WeekScore` is written **Tuesday
00:00 group time**, not Sunday midnight, because Monday's entries can still
change it. During Monday, last week reads as provisional, and a Monday backfill
that completes a target extends the streak — which is the point of the grace
period.

### Charts

- **Noisy metrics** (weight): a 7-day trailing average as the line, raw
  weigh-ins as faded points behind it. Never plot raw dailies as the primary
  series.
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

The card stays in place and changes what it holds. It does **not** become a tile
of its own: one tile means one person, and a combined event tile would break the
rule that makes the grid readable.

| Window | Phase | The card is |
| --- | --- | --- |
| until start | Upcoming | Join card above the grid — when, where, what, who is coming |
| start → +3h | Live | "Happening now". Late joins still accepted |
| +3h → end of day | Recap | The join control becomes a small gallery of attendees' photos |
| next day | Gone | Photos remain on each attendee's own tile |

So the event has two views that do not fight: the card is the *together* view,
tiles stay the *individual* view. Each attendee's photo lands on their own tile
as well as in the gallery.

Three hours, not one: people finish, shower, and post later. A short window kills the
photo moment, which is the entire payoff. The organiser may close an event early but
never has to.

### Creating one

- **Group detail** (inside the You tab) — the primary entry point.
- **Your week** — a secondary ingress while you're already logging.
- **Dashboard empty state** — when nobody is hosting, the join slot reads "Nobody's
  hosting today — start something." The highest-intent moment in the app.

### Notification

An event nobody sees is useless, and a dashboard card only reaches people who
happen to open the app. A 6pm run posted at 2pm needs a push.

**The only push notification is an invitation.** Events are time-sensitive and
low-volume — a few a week. Someone logging a workout is neither, and pushing it
turns the app into noise. Anything else worth saying is a digest, not a push.

The push opens a **brief event page**: when, where, what, who has RSVP'd and how,
the two join buttons, and — once the event has run — somewhere to add a photo.

**Delivery is Web Push + a service worker, with VAPID keys.** No vendor and no
Firebase; the backend signs and sends with the `web-push` package from a Lambda.

| Platform | Works |
| --- | --- |
| Android / Chrome | From an ordinary browser tab |
| iOS / Safari | **Only once the app is added to the Home Screen** (iOS 16.4+) |
| Desktop | From an ordinary tab |

The iOS restriction is a platform limit, not a library one — FCM, OneSignal and
everything else sit on the same Safari API and hit the identical wall. Switching
libraries does not get past it. What follows from it:

1. Ship a `manifest.json` and a service worker so the app is installable.
2. Make "Add to Home Screen" an explicit onboarding step with instructions,
   not something people are left to discover.
3. Ask for notification permission **after** someone has joined a group and seen
   the point — never on first load, where it is reflexively denied, and denial
   is sticky.

For a group of six who already know each other, "add this to your home screen"
is a message you can send. At scale it would be a real funnel problem.

---

## 7. Screens & navigation

Three tabs: **Home · Your week · You**

### Home — `/`
- Group name, challenge week, days left
- Your week summary: adherence ring, per-pledge dot rows, streak. Read-only; opens Your week
- Upcoming event card, if any
- Member tile grid, 2 columns, daily rotation

### Log — `/log`
- **Today's pledges** as a checklist: name, chevron, tap to complete
- Detail sheet on tap — title, note, photo, the pledge's metric
- **This week** below: dots per pledge, fraction, per-pledge streak
- Aggregate adherence; last week shows provisional through Monday
- Secondary create-event ingress

Named for the verb people come here for. The week summary lives inside it.

### You — `/you`
- Profile: name, nickname, photo
- A card per group; pledges nest inside each, up to three
- Pledge editor: freeform label, times per week, optional metric label and unit
- Commitment meter while editing — "8 of 14 committed"
- Members, invite link, admin controls
- Primary create-event entry point

### Event — `/e/{eventId}`
Where a push lands. When, where, what; who has RSVP'd and in which mode; the two
join buttons; and after the event has run, somewhere to add a photo.

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

## 8a. Dates

A group carries an IANA `timeZone` fixed at creation, and every date is resolved
in it server-side. Scoring is per group, so a per-user zone would put two
members' completions in different weeks. `commitmentCap` (R8) is likewise stored
per group rather than hardcoded.

Still open: how a challenge that starts mid-week is handled — pro-rate week one,
or make it unscored practice.

## 9. Data model

`Completion` replaces the metric-comparison logic entirely — it is a fact, not a
judgment, which is what kills the sawtooth at the root instead of patching it.

```
Pledge                          at most 3 per membership
  groupId, userId, pledgeId
  label            "Strength" — freeform, never an enum
  targetPerWeek    1-7
  metricLabel?     "Bench" — names the optional number
  metricUnit?      "lbs"
  effectiveFrom    week this version starts (R9: changes apply next week)

Completion
  groupIdUserId, date, pledgeId
  title?           a few words, shown on the member's tile
  note?            longer, the member's own record
  photoKey?
  UNIQUE (userId, pledgeId, date)

MetricEntry                     pledgeId omitted = a day metric like weight
  groupIdUserId, date, metricKey
  value
  pledgeId?

PushSubscription                one per device, not per user
  userId, subscriptionId
  endpoint, keys { p256dh, auth }
  createdAt, lastSeenAt

WeekScore                       materialised at week close
  groupId, userId, weekStart
  done, pledged, adherencePct, fullWeek
  pledges[]        { pledgeId, completed, target, fullWeek }

Group
  groupId, name, timeZone, commitmentCap
  challengeStartDate, challengeEndDate, adminUserId, createdAt

GroupMembership                 no goal fields — pledges are separate
  groupId, userId, role, joinedAt, onboardedAt?

Event
  groupId, eventId, hostUserId
  startsAt, theme, location?, isVirtual
  closedAt?        organiser may close early

EventRsvp
  eventId, userId, mode         in_person | virtual
```

There is no `minutes` field. Duration is a metric like any other if a member
cares about it — making it first-class is how v1 ended up scoring volume.

`WeekScore` carries a per-pledge breakdown because R7 makes the streak a
*per-pledge* unit: a single aggregate `fullWeek` cannot answer "how many weeks
running have I kept my strength pledge". `done` and `pledged` are the source of
truth — `adherencePct` is rounded for display, so averages across weeks are
computed from the raw counts to avoid rounding drift.

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

Each milestone is shippable on its own. The order is what a greenfield v2 stack
allows, which is not the order a v1-modified-in-place would have taken: a
completion carries a `pledgeId`, so pledges must exist before completions can.

| # | Ships | Why here |
| --: | --- | --- |
| **M0** | Domain core: adherence, week math, rotation, under test | Pure functions, no AWS. Where the model can be subtly wrong, and the tests guard the invariants. ✅ |
| **M1** | Identity + groups: API on the shared pool, invites | Proves the shared-identity decision end to end before anything depends on it. Backend ✅ |
| **M2** | Pledges: up to three, targets, metric labels, commitment meter | The highest-stakes screen in the app. |
| **M3** | Completions + the log screen | Checklist, detail sheet, metrics, Monday backfill. |
| **M4** | Adherence + standings; week close Tuesday 00:00 | **The MVP — stop and run a real challenge here.** |
| **M5** | Group board: member tiles, daily rotation, photos | Needs completions carrying titles and photos. |
| **M6** | Push + PWA: manifest, service worker, subscriptions, send path | Independent of everything above, and it gates M7 being useful. |
| **M7** | Events: create, RSVP modes, lifecycle, recap gallery | The differentiator. Needs push to reach anyone and the board to sit above. |
| **M8** | Charts per metric kind | Cosmetic until there is data to plot. |

Everything past M4 is downstream of a thesis only a real group can test.

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

**Does a narrow pledge strand people?** With no verification, someone whose
pledge is "Bench press" and who swims instead either checks it loosely or gets
nothing — and the person having a rough week who managed a walk gets nothing
either, which is the discouragement v2 exists to remove. Deliberately left
straightforward for now: onboarding steers toward broad labels, and a separate
unscored "logged something else" is the fallback if broad labels aren't enough.

**Do standalone day metrics need surfacing?** `MetricEntry` supports a metric
with no pledge, but only the per-pledge field is in the UI. Weight was v1's
dominant goal, so this probably wants a home — it is a UI addition with no
migration whenever it earns one.
