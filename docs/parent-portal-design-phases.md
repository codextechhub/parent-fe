# M28 Parent Portal: design breakdown and build phases

**Design:** `backend/docs/designs/Parent Portal - Desktop.html` (bundled
export, 124 KB of markup once unescaped, 52 `sc-if` blocks all accounted for,
28 `sc-for` collections, 376 unique bindings). Its mock data (`parent-data.js`,
decompressed from the bundle) is Mrs. Patricia Okafor with two children, Tobi
(JSS1 A) and Somto (Primary 4), at Brightfield Schools, Lekki Branch on 17 Sep
2025. The phone frame, `Parent Portal - Mobile.html` (61 blocks), shares the
same data and adds only navigation; its extra flags are listed in 1.3.

**Backend contract:** `backend/docs/parent-portal-api-plan.md` (19 October
2026), including its section 9 ("As built"), and FRD v1.2
(`backend/docs/frd/functional-requirements/28-parent-portal/`, 14 October
2026). The backend is **shipped**: 23 routes under `/v1/portal/parent/`,
commits `40a7acae`, `ad24f7aa`, `0f4a35b7`, `d3526087`, `b6574e3c`. Where the
design and the backend disagree, the backend wins; the mismatches are
enumerated in 2.3.

**Where it is built:** this plan proposes a new `parent-fe` project at
`/Users/mac/Documents/Dev-Projects/GitHub/parent-fe`, mirroring `student-fe`,
served at the school's address under `/parent/`
(`bright-star.xvs.codexng.com/parent/`). The backend already assumes this
path: card checkouts return to `/parent/fees/paid?reference=`
(`PARENT_APP_BASE_URL` overrides). Awaiting the owner's confirmation; see "The
one decision" below.

## What this app is, and is not

A **parent** holds no role and no permission key. The backend admits them by a
`StudentGuardian` row in the asserted tenant whose `user = request.user`;
anybody else is 404. One parent account carries **several children**, in one
or several branches of one school; a parent of children at two different
schools has two separate sign-ins (FR-009).

The app's shape follows from that:

- Sign-in is a **device session**, as the student app's is
  (`session: "device"`, an `account` key, an HttpOnly refresh cookie). There
  is one account per parent on this phone, not several siblings sharing it.
- The switcher **in the header switches children** (`child_id` in memory), not
  accounts. A sibling with their own guardian is a different mother and lives
  under a different sign-in.
- Scoped reads name the child: `children/<id>/timetable/`,
  `children/<id>/attendance/`, etc.; cross-child reads
  (`fees/`, `home/`, `notices/`) return per-child blocks plus a `combined` or
  family block.
- The parent writes **only** three fields on their own record (phone,
  alt_phone, address) and takes **payments actions**. Everything else is a
  read.

### The rules this app shares with school-fe and student-fe

school-fe's `CLAUDE.md` is the house rulebook; the parts that apply word for
word are **Field Access impact** reporting, **ship-check**, **Wrapping up:
report in plain words**, **Asking, suggesting and disputing: use a real
example**, **Fixing problems: root cause, not symptom**, **Comments: short
inline, the story in the doc block**, **Writing punctuation** (no em dashes),
**Vocabulary: it is a branch, never a campus**, and **Brands** (this app is
XVS: `SchoolMark` and `LoadingMark`, the school's crest first, the XVS crest
as the fallback, never the bare CodeX mark).

`PageShell`, `PageHeader`, `ScrollArea`, `SchoolMark`, `LoadingMark`,
`src/index.css`, the floating-tab-bar shell and the push-settings plumbing
are copies of student-fe's, which are copies of school-fe's. Keep them in
step: a fix to one belongs in all three.

---

## 1. What the design contains

### 1.1 Screens

Size is the markup inside each screen's span (SVG stripped), a fair proxy for
how much there is to build.

| Screen | Size | States inside it | Collections | Writes |
|---|---|---|---|---|
| **Report card** (`reportOpen`) | 39.1 KB | letterhead; CA, exam, total, grade per subject; average, position, class teacher's remark, attendance line, next term; Download PDF. One sheet per term; the design draws only the current term's | `resultCards` | none |
| **Pay flow** (`payOpen`) | 15.1 KB | six steps. **Amount**: full or part, amount field with four errors (empty, zero, below ₦1,000, above balance), remaining-after line, "allocation note" when combined. **Method**: Card / Bank transfer / USSD, detail block, "entered on the gateway" line. **Confirm**: rows (child, invoice, method, amount), outcome buttons (prototype only). **Processing**, **Success** (amount, "applied to", reference, method, View receipt), **Pending** (same shape, "available after confirmation"), **Failed** (no charge, Try again) | `confirmRows` | start a payment |
| **Fees** | 7.1 KB | combined KPIs (billed, paid, outstanding, Pay all); per-child invoices, collapsible with lines; **owing** (Pay) / **fully paid**; payment history, each **with receipt** or "No receipt yet" | `invoices` > `inv.items`, `payments` | opens Pay |
| **Profile** | 6.5 KB | header (name, "Mother · guardian of N children · School, Branch"); "Your details" block (phone, alt phone, email, address, relationship) **viewing** / **editing** with phone and email errors, Save disabled until changed and valid; "Linked children" list with per-child View | `linkedChildren` | phone, alt phone, email, address |
| **Home** | 8.6 KB | greeting ("Welcome, Mrs. Okafor"); **outstanding** across both children banner (Pay all) **or** "All ... fees are fully paid"; one card per child (status chip, attendance %, average %, open-work count, top-3 results, fee line, Pay button, deep links); "Needs your follow-up" (assignments due soon, filtered to your children); latest notice; unread messages tile | `childCards` > `c.topResults`, `followUps` | none |
| **Results** | 5.3 KB | 4 tiles (average, position, subjects, term); card per subject (teacher, score bar, grade chip, CA/exam, remark); chart by subject; "View report card" | `resultCards`, `chart` | opens report card |
| **Attendance** | 5.0 KB | rate, encouragement line, present / absent / late counts; one calendar per month (present, late, absent); "Days to note"; "message the class teacher" aside | `calendars` > `mo.head`, `mo.cells`; `notes` | none |
| **Timetable** | 3.2 KB | today's list with Now/Next badges and "Next class" line; week grid with today's column; break rows | `todaySlots`, `weekDays`, `grid` | none |
| **Messages** | 3.9 KB | thread list (teacher, role, "about this child", unread count); thread view (messages, time); compose and send | `threadList`, `thread.messages` | send |
| **Assignments** | 2.9 KB | "This is {child}'s progress, for you to follow. Only {child} can submit work" banner; row per assignment (title, detail, subject, teacher, due, status, grade chip); graded feedback card | `assignmentRows`, `gradedFeedback` | none |
| **Notices** | 2.6 KB | list with unread dots and "N unread" / "Mark all as read"; notice detail, **unread** (Mark as read) / **read** | `noticeList` | mark read, mark all read |
| **Invoice sheet** (`invoiceDocOpen`) | 4.4 KB | letterhead; billed-to (parent + child), term, due; line items; totals (invoice total, paid to date, balance due); Download PDF; **owing** → Pay this invoice | `doc.items` | opens Pay |
| **Receipt sheet** (`receiptOpen`) | 3.8 KB | letterhead; received-from (parent + child); date and reference; lines; amount paid; method; balance after; "Paid by guardian" footer; Download PDF | `receipt.lines` | none |
| **Sign in** | 2.1 KB | email and password, each with an error; "Welcome back, Mrs. Okafor" aside; "Powered by CodeX Vision" footer | none | sign in |
| **Child switcher** (`showSwitcher`) | 1.3 KB | "Viewing" header, one button per child (initials, first name, class); "childScopeNote" footer | `childTabs` | none |

### 1.2 Overlays

| Overlay | Size | States |
|---|---|---|
| **Pay** (`payOpen`) | 15.1 KB | six steps above |
| **Report card** (`reportOpen`) | 39.1 KB | the sheet above |
| **Invoice sheet** (`invoiceDocOpen`) | 4.4 KB | the sheet above |
| **Receipt** (`receiptOpen`) | 3.8 KB | the sheet above |
| **Child switcher** (`showSwitcher`) | 1.3 KB | the row above |
| **Toasts** | small | success / info / error |

### 1.3 Shared chrome and row models

- **Sidebar (desktop):** nine items (Home, Results, Attendance, Timetable,
  Assignments, Fees, Notices, Messages, Profile), unread badges on Notices
  and Messages, Sign out. School name and "Lekki Branch · Guardian" at the
  top.
- **Header:** screen title, "2025/2026 · First Term", the parent's initials,
  name and "Guardian · N children".
- **Row-scoped flags (14):** `item.badge`, `c.badge` / `c.owing` (child
  cards), `cell.sub` (timetable), `d.isToday`, `a.gradeLabel` (assignment),
  `inv.open` / `inv.owing`, `doc.owing`, `p.hasReceipt` / `p.noReceipt`,
  `notice.read` / `notice.unread`, `t.unread` (message thread).
- **Phone frame only (`Parent Portal - Mobile.html`):** a bottom tab bar
  (`showTabs`), a More sheet (`isMore`), back buttons (`showBack`), the
  school line (`showSchool`), lists and details as separate screens
  (`isNoticeList` / `isNoticeDetail`, `isThreadList` / `isThread`), day tabs
  on the timetable (`t.isToday`, `t.badge`), and the `headerSub` subtitle.

### 1.4 The mock family, and what it does not exercise

**One** mock parent, Mrs. Patricia Okafor, with **two** children at **one**
branch: Tobi (JSS1 A, part-paid at ₦50,000 owing, mixed assignment states,
one late day) and Somto (Primary 4, fully paid, no outstanding work). Her
guardian record names email, phone and alt-phone. Three notices (two unread),
two message threads (one unread with Mr. Eze about Tobi, one with the
Bursar). Three confirmed payments in history.

**One family means every unhappy state is undrawn.** The build has to draw
these itself from the backend (see 2.2):

- a parent with children in **two branches** (`show_branch: true`), each
  card naming its branch;
- a parent with **one** child (no child switcher, "Viewing all children"
  recedes);
- a **held term** (`results` state `withheld`), a term **not published**
  (`not_published`);
- an **unpublished timetable** (`published: false`) for one child while the
  other has one;
- a **Home block** that could not be read (`available: false`);
- **Fees unavailable** (503 `FINANCE_UNAVAILABLE`), one child **in credit**
  (`IN_CREDIT`), one child's books unreadable while the other's are fine
  (combined block then also `available: false`);
- several invoices on one child (the design draws one per child);
- the **pay-all queue** of two or more open invoices across the children;
- a payment stuck in **"Online" / "waiting for confirmation"** method;
- a parent whose **email is their sign-in** (common) and so cannot be edited
  by them (always, per the backend);
- the "I am a teacher as well as a parent" case: this parent reaches her
  class as a teacher through school-fe and her child as a parent through
  parent-fe, with no bleed either way.

---

## 2. What the backend can serve

### 2.1 The four buckets

All routes under `/v1/portal/parent/`, trailing slash, `?tenant=<slug>`.
Money is kobo. 404 means "not a parent, or not a child of yours". No route
declares `pending_tenant_surface`: a school that has not gone live has no
parents.

| Screen | Bucket | Endpoint |
|---|---|---|
| Sign in | **Served, wired by platform** | `POST /v1/user/auth/login/` with `session: "device"`, then `device/refresh/` and `device/sign-out/` |
| Shell, header, child list | **Served, not wired** | `GET me/` |
| Home | **Served, not wired** | `GET home/` (per-child + family blocks, each with `available`) |
| Child record | **Served, not wired** | `GET children/<id>/` |
| Timetable, Attendance, Results, Session, Report card | **Served, not wired** (reuses pupil services) | `GET children/<id>/timetable/`, `attendance/?term=`, `results/?term=`, `results/session/?session=`, `results/report-card/?term=` |
| Fees combined | **Served, not wired** | `GET fees/` (per-child, `combined`, `min_part_payment`, `pay_all` steps) |
| Payment history | **Served, not wired** | `GET fees/payments/` (merged, newest first, each naming its child) |
| Receipt (JSON or PDF) | **Served, not wired** | `GET fees/payments/<ref>/receipt/`, `?as=pdf` |
| Invoice sheet (JSON or PDF) | **Served, not wired** | `GET fees/invoices/<ref>/`, `?as=pdf` |
| Pay by card | **Served, not wired** | `POST fees/invoices/<ref>/pay/` → `{checkout_url, reference, amount, balance_after, child}`; return at `/parent/fees/paid?reference=`, then the public status route |
| Pay by bank transfer | **Served, not wired** | `GET/POST children/<id>/fees/transfer-account/` (`ISSUED` / `NONE` / `UNAVAILABLE`); `GET children/<id>/fees/transfer-account/deposits/?since=<as_of>` |
| Profile | **Served, not wired** | `GET/PATCH profile/`; PATCH takes `phone`, `alt_phone`, `address` only; `email_editable: false` |
| Notices | **Served, not wired** | `GET notices/`, `GET notices/<id>/`, `POST notices/<id>/read/`, `POST notices/read-all/`. Each notice names the children it is for |
| Messages | **Served, wired** (Phase 8) | `GET/POST messages/conversations/`, `GET messages/conversations/<id>/`, `GET/POST messages/conversations/<id>/messages/`, `POST messages/conversations/<id>/read/`, `GET messages/unread-count/`, `GET messages/contacts/?child=` |
| Assignments | **Absent, parked** | hidden |

**Bucket 3 (exists but closed) is empty.** The portal has no pending-tenant
surface: a school not live has no parents.

**Bucket 4 (absent) is small and deliberate:** Assignments. No owning module.
The design shows it; the plan hides it (owner decision 4 in the backend
plan). Messages was in this bucket until the messaging module (Module 32)
shipped its parent routes; it is built, see Phase 8.

### 2.2 Served, and no screen draws it (reverse audit)

Each of these must be built anyway, because a real parent will reach it:

1. **Several branches** (`show_branch: true`): each child's card names the
   branch, and the "Lekki Branch" line in the header recedes to "N children
   across M branches".
2. **One child only:** the child switcher recedes; the header says "Guardian
   of {first name}"; the Home drops the "both children" copy; combined
   totals collapse to one line.
3. **A held term / not published** on Results (`state: withheld`,
   `not_published`) and the matching report-card 404.
4. **An unpublished timetable** (`published: false`) for a child.
5. **A Home block that could not be read** (`available: false` with a
   sentence). The design draws every block as if it always arrives.
6. **Fees unavailable** (503 `FINANCE_UNAVAILABLE`) for one child, with
   `combined` dropping to `available: false`.
7. **In credit** (`IN_CREDIT`) and **several invoices on one child** (the
   design draws one per child).
8. **The `pay_all` queue:** one checkout per child in sequence (owner
   decision 5). The pay sheet steps through them: step 1 of N, confirmed and
   on to step 2.
9. **"Online" / "Waiting for confirmation"** as the method on a pending
   card payment, until the webhook books it.
10. **A term picker** on Results and Attendance, and a **session picker** on
    Session results; the design shows only the current term for the showing
    child.
11. **A notice withdrawn** and **edited after publishing** (`edited_at`).
12. **The parent's notification inbox** (`/v1/notify/`), and the bell count
    on Home; no screen draws it.
13. **Reissue / revoke** flows live in school-fe (M11), not here, but the
    "Your access to {child} ended" case the parent sees here (next request
    is 404) needs a graceful sign-out, not a crash.

### 2.3 Elements nothing could serve as drawn, and their rulings

Where the design and the backend disagree, the backend wins. These are each
a decision the backend already took; call them out so no screen "builds the
design" and then is unbuilt again.

1. **The design's "Edit email" field.** Backend: `email_editable: false`.
   Ruled: show email read-only on the Profile edit sheet with a line "Your
   email is the address you sign in with. Ask the school to change it."
2. **USSD as a third payment method.** Backend: Card and Bank transfer
   only (the gateway's USSD is reachable from Card's checkout page, so no
   second button here). Ruled: drop USSD from the pay sheet, same as
   student-fe.
3. **Prototype "outcome" buttons** on the Confirm step. Not built.
4. **"Pay all" as one combined checkout.** Backend decision 5: one checkout
   per child in sequence. The sheet shows "Step 1 of 2 · Tobi's First Term",
   runs it, then "Step 2 of 2 · Somto's First Term". The design's
   `allocationNote` and `payIsCombined` recede.
5. **Messages, Assignments, the Messages tile and badge, the "Needs your
   follow-up" list on Home.** Neither module existed when this was ruled:
   hidden, no empty nav item, no "coming soon". Messages has since shipped
   and is built (Phase 8): its badge sits on the tab bar, and Home still
   carries no Messages tile because `home/` serves no message block.
   Assignments and the follow-up list stay hidden.
6. **The combined "Pay fees" button on the Home outstanding banner.**
   Kept, but it opens the pay-all queue (point 4), not a merged charge.
7. **`c.feeStatus`, `c.feeLine` and `c.openWork` on the child card.** Fee
   status and line come straight from `home/` per-child blocks. "Open work"
   comes from assignments, which is parked (point 5); the field recedes.
8. **"Message the class teacher" aside on Attendance.** Messages is parked;
   the sentence stays as copy but is not a link.
9. **"Both children" copy on combined totals.** Reads "across your {N}
   children" from `me/`.
10. **"Generated by CodeX Vision" / "Paid by guardian" footers** on the
    receipt and invoice sheets. Not added. The receipt JSON serves whatever
    the backend already stamps; the sheet renders what it serves.
11. **"Phone number: 0803 ..."** validation ("11 digits, Nigerian"). Backend:
    7-15 digits, any country. Ruled: no front-end validation beyond what the
    backend's refusal sentences give.
12. **The sign-in's "Welcome back, Mrs. Okafor" aside.** First-time sign-in
    draws a neutral welcome; the greeting personalises once a session is in
    hand.

---

## 3. The phases

Every phase ships: it builds, `npx eslint . --max-warnings 0`, typecheck and
tests pass, and each screen is driven in a browser signed in as a seeded
parent against the real API at 390px, upright tablet, sideways tablet and
desktop, at **lagoon-view** (two branches) and **sunrise-academy** (one).

### Phase 0: seed and readiness (backend seeder, no screens)

The backend has no `seed_parent_portal_scenarios` yet. Pupils are seeded
(`seed_student_portal_scenarios`); each pupil carries one or two guardians
through M11's seeder, but none of them is addressable in a parent app without
a password. Add, through the real services:

- **the full family:** one parent of two children at one school, one child's
  books part-paid with a confirmed and a pending card payment, the other
  fully paid, a published timetable on one and not on the other;
- **the two-branch parent:** one parent of two children at two branches of a
  school with `show_branch: true`;
- **the one-child parent:** so the switcher recedes;
- **the held-term parent:** one child whose term is withheld;
- **the teacher-and-parent:** one staff member who is also a guardian;
- **the two-school parent:** one guardian with children at two separate
  schools, so FR-009 can be driven;
- **the revoked parent:** a guardian whose link to one child is ended between
  reads.

Each parent signs in with `Parent@School2026`, named in the seeder's output.
Blocked, this phase, on the backend.

### Phase 1: the `parent-fe` project

- Vite + React + TypeScript + Tailwind + RTK Query + vite-plugin-pwa; base
  `/parent/`, port **5176** (strict); `/v1` proxy; CI running eslint first,
  as the other apps do; a `.claude/launch.json` entry; the overflow probe
  pointed at `/parent/`.
- The UI pieces house conventions name (`PageShell`, `PageHeader`,
  `ScrollArea`, `SchoolMark`, `LoadingMark`, the table's phone-card mode),
  copied from student-fe as the starting point; this app keeps them in step
  the way school-fe and student-fe do.
- The XVS crest and loader as the fallback brand; `/parent/manifest.webmanifest`
  from the backend route the student app pattern already lays down (per
  school, overridable).
- A service worker caching the app shell only. Parent data caching, if any,
  comes with Phase 3.
- `release.sh` and `deploy-staging.sh` copied from student-fe.
- `.github/` CI, hosting rule (`/parent/*` goes to this app and
  `/parent/manifest.webmanifest` to the backend) laid down in a tracking
  item, driven in Phase 7.

### Phase 2: sign-in, children, and the shell

- **Sign in** on this app's own page: a device-session sign-in, as
  student-fe does it, with the CSRF and refresh plumbing copied from there.
- **school-fe hand-off:** school-fe's sign-in page hands pupils to
  `/student/` and parents to `/parent/`: the sign-in moves into the app's
  device session and the account key is left under sessionStorage
  `xvs.parent.handover`, which this app adopts on start-up.
- **The shell:** the floating tab bar at every size (student-fe's pattern),
  More once there are more than five items; the sidebar from the design is
  kept for desktop (student-fe moved away from it on the owner's choice; the
  parent app's owner choice is open; the plan assumes the same floating-tab
  bar at every size unless the owner wants a desktop sidebar).
- **The child switcher** in the header: `me.children`, one per button, with
  initials and class; the active child is held in a URL segment (`?child=`)
  so a reload stays on the same child. Links to screens that are not
  per-child (Fees, Notices, Profile) carry no `child=`.
- **Branch line in the header:** reads from `me.show_branch` and the active
  child's branch; recedes at a one-branch school.
- **Sign out:** the device sign-out route, handed the sign-in's account key.

### Phase 3: shell + Home + Notices + Profile

- **Home:** family header; per-child cards from `home/` (each with their
  own `available`); combined outstanding banner; latest notice; the bell
  count. The design's "Needs your follow-up" and messages tile recede
  (2.3 point 5).
- **Notices:** the parent's feed is a union across the children, each notice
  carrying the first names of the children it is for; a two-pane layout on
  a sideways tablet and desktop, list-then-detail on a phone; mark read,
  mark all read; the unread badge in the tab bar.
- **Profile:** both blocks. "Managed by the school" (name, email, relationship)
  is read-only, email included; "Your details" edits `phone`, `alt_phone`,
  `address`, with per-field refusals under their box; Save disabled until
  changed; the Linked children list uses `me.children`.

### Phase 4: per-child screens (Timetable, Attendance, Results, Report card)

- The showing child comes from the switcher.
- **Timetable:** today's list and "Next"; the week grid on wide screens;
  the unpublished state (`published: false`).
- **Attendance:** rate, encouragement, counts; month calendars; days to
  note; a term picker.
- **Results, this term:** the four tiles, subject cards, chart; a term
  picker; held and not-published states.
- **Results, full session:** term strip, subject table, promotion,
  signed-off remark; a session picker.
- **Report cards:** render through `ReportCardSheet` from student-fe/
  school-fe, pointed at the child's released card; Download PDF prints
  through the browser.
- A banner above each screen names the showing child, so a scroll on a long
  screen never leaves a parent wondering whose attendance they are reading.

### Phase 5: Fees, invoices, receipts, paying

- **Fees:** the banner "normally paid by this account" (not "by your
  guardian"), combined KPIs, one card per child with its invoices (two
  panes on a sideways tablet), payment history naming each payment's child
  and method, the unavailable, in-credit, and family-can't-be-read states.
- **Invoice sheet:** JSON renders in a slide-over; Download PDF fetches
  `?as=pdf`.
- **Receipt sheet:** same, from JSON; Download PDF.
- **Pay** (card):
  - **One invoice:** amount (full or part, the minimum shown and enforced
    by the server's refusal sentences), then Paystack. Back at
    `/parent/fees/paid?reference=`: confirmed (receipt), still confirming
    (keeps asking), or failed (nothing charged, try again).
  - **Pay all:** step 1 of N for the oldest open invoice, confirm, run; on
    confirmation the sheet moves to step 2 and so on. A failed step offers
    Retry; Skip advances past it. Each step is its own `POST
    fees/invoices/<ref>/pay/` with its own `reference`.
- **Pay** (bank transfer): per-child, so the parent sees "Tobi's account"
  and "Somto's account". The sheet reads `children/<id>/fees/transfer-
  account/`, shows `ISSUED` (bank, number, name, copy buttons), `NONE` (POST
  to issue, respecting the server's rate limit), `UNAVAILABLE` (sentence).
  The panel watches deposits since `as_of`, shows "Arriving" and "Received",
  then re-reads `fees/`.
- Offline: Pay is disabled with a sentence.

### Phase 6: Push notifications

- **Offer** on Home after sign-in; Profile keeps the setting.
- **One subscription per browser, several parents' choices.** A parent only
  has one account per browser in this app (unlike student-fe), so the
  "several pupils per phone" machinery simplifies to "one parent, remember
  their push choice with the school".
- **Service worker:** `public/push-sw.js`, loaded into the generated
  worker, shows pushes and opens Notices or Fees by kind. A push about a
  specific child carries the child id and the app opens that child's
  record.
- **No scores or amounts on a locked screen** (student-fe's rule, same
  reason). "Tobi's result is ready" without the mark; "A payment on
  Somto's account was received", without the figure.

### Phase 7: ship it

- **Hosting rule:** `/parent/*` on the school subdomain goes to this app,
  `/parent/manifest.webmanifest` to the backend's per-school manifest.
- **`PARENT_APP_BASE_URL`** set in the backend's environment, so the card
  checkout's return URL points at the production app.
- **Guide system entry** in school-fe (the school admin needs to find
  parents, see their links and reissue). The parent app itself has no guide.
- **"Get the app" card** (student-fe's install flow, copied).
- **School-fe:** the staff screens the parent app depends on need a check
  pass against the shipped parent app. The reissue sheet, the Guardians
  tab's "Portal access" row, the Field Access switches on
  `school.guardians.alt_phone` and `school.guardians.portal_access`.

### Phase 8: Messages

Built against Module 32 (`backend/docs/messaging/messaging-design.md`,
sections 1, 2, 5, 9.4, 11 and 14, the last of which wins), whose parent routes
sit under `/v1/portal/parent/messages/`. No keys: the portal's own admission
applies.

- **Nav.** `Messages` (`/messages`, `MessageSquare`) is the eighth
  destination. The owner's four tabs (Home, Results, Fees, Notices) keep the
  bar, so Messages goes under More with Timetable, Attendance and Profile. To
  keep it from hiding there, the unread count shows on the More tab (the sum
  of what sits under it) and on Messages' own row in the sheet. It is family
  scoped and carries no `?child=`.
- **Badge.** `unread-count/` is read every 60 s while the app is in view, on
  regaining focus and on reconnecting (`AppShell`). Opening a conversation,
  or sending, invalidates it.
- **Routes.** `messages`, `messages/new` and `messages/:id`, all drawn by
  `MessagesPage`. A message alert (`/parent/messages/<id>`) opens the
  thread through the router with no change to `public/push-sw.js` or
  `routerPath`, since the backend names a `/parent/` path.
- **List.** Rows show the staff member's name and label ("Class teacher,
  JSS1 A"), the child (a chip, only when the parent has several), the last
  words, the time and an unread count. Child chips narrow the list with
  `?child=`. The `PUPIL` rows (a child's conversations the parent reads as
  primary parent) sit in their own section, "Your child's conversations with
  staff", each reading "Adaeze's conversation with Mr Kunle Adebayo. You can
  read it but not reply." They carry no unread count and no About chip.
- **Thread.** Oldest to newest under day headings; the newest 50 load, and
  "Show earlier messages" follows the `before` cursor, holding the view in
  place. Opening a conversation of the parent's own marks it read (and so
  does a message that arrives while it is open); a watched one is never
  marked. The newest page reads again every 20 s, on focus and on
  reconnecting. The box sends with a 4,000-character limit; `client_token`
  comes from `crypto.randomUUID`, is kept with the text, and is reused when
  the same text is retried after a failure, so a double tap or a retry
  never writes twice. When `can_send` is false the box gives way to
  `read_only_reason`.
- **New message.** Child (skipped for a parent of one; defaults to the child
  in the header switcher), then a member of staff from `contacts/?child=`
  (preselected when there is only one), then the words. `can_start: false`
  shows `can_start_reason` in place of the form. The conversation the
  backend returns (201 new, 200 existing) opens.
- **Phone first.** The list and an open conversation are separate full
  screens below 900 px; side by side from 900 px. Both read cleanly at 375
  and 768 with long names and unbroken text wrapping.
- **Offline.** What was last loaded stays on screen and the shell's offline
  bar shows the moment the browser goes offline (the shell listens for the
  browser's `online` and `offline` events). Send waits: the text stays
  and a line says it will go when the connection returns.
- **Home.** `home/` serves no message block, so Home is unchanged.
- **Field Access.** The portal serializers carry a fixed narrow shape and no
  Field Access switches (a deliberate deviation recorded in section 14.4 of
  the messaging design), so the screen shows exactly the fields the API
  returns and submits only `child`, `staff`, `body` and `client_token`.

### Parked: Assignments

No owning module. The design shows it; the plan hides the nav and tiles.
When the module ships, it starts from its own backend plan and a staff-side
design, and the parent app gets a new phase.

---

## 4. Order, and why

1. **Phase 0 first** because the design's single family leaves every
   unhappy state undrawn and no parent is addressable in a sign-in without
   a seeded account.
2. **Phase 1 next** because there is no project yet.
3. **Sign-in before everything else, with no backend wait.** Parents sign in
   through the ordinary tenant route the platform already serves (unlike
   student-fe, which waited on per-device sessions). Phase 2 can land as
   soon as the project exists.
4. **Reads before money.** Phase 3 (Home, Notices, Profile) proves the shell
   on the simplest full screens; Phase 4 (per-child screens) adds the child
   switcher's cost; Phase 5 (Fees + Pay) carries the only writes beyond
   profile edits and has the largest state machine.
5. **Push last** (student-fe pattern), once the rest is proven.
6. **Ship last.** The hosting rule, manifest route and `PARENT_APP_BASE_URL`
   are the last tie-ins and want the finished app.
7. **What we control:** everything. The backend is shipped. No phase is
   blocked except Phase 0, which is a backend seeder.
