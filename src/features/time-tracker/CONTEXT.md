# Time Tracker

Signed-in personal time tracking for an **account owner**: **projects** to attribute hours to, optional **clients** for billing, and **invoices** the **client** can mark paid—without payment processing. User-facing copy is product-generic; it does not use **David J. Perry** or **Focus Disorder** as defaults or letterhead.

## Language

### Time Tracker

The portfolio **project** where an **account owner** tracks time against **projects**, optionally groups those **projects** under **clients**, and issues **invoices**. Shipped name in v1: **Time Tracker** (Mobile menu, tab title, **shareable route**).

_Avoid_: Calling it Toggl; treating it as a team or workspace product; defaulting names, letterhead, or empty copy to **David J. Perry** or **Focus Disorder**.

### Account owner

The signed-in person whose Time Tracker data this is; sole reader/writer of their **tracker store** in v1. Firebase Auth via Google or email/password, same **sign-in provider** set as **Game Manager**.

_Avoid_: “User” alone; anonymous Firebase identities as owners; treating a **client** as a signed-in account.

### Tracker store

The **account owner**’s durable Time Tracker data (**clients**, **projects**, **time entries**, **invoices**).

_Avoid_: Confusing with Game Timer **room** state in Realtime Database; sharing a store with **Game Manager**.

### Tracker surfaces

Primary mobile areas of Time Tracker: **Timer**, **History**, **Projects**, and **Clients**, plus account/sign-in. The **client invoice page** is separate—it is not one of these surfaces.

_Avoid_: A desktop-first dashboard layout for v1.

### Client

A billing party the **account owner** may attach **projects** to, identified in v1 by a display name only. Not a signed-in user. Views **invoices** through a bookmarkable **client invoice page**.

_Avoid_: Customer, account, company; billing address, email, or tax ids on the **client** in v1.

### Client deletion

Removing a **client**. Blocked while that **client** has any **invoices**. With none, the **client** is removed and their **projects** become unassigned; **projects** and **time entries** are not deleted.

_Avoid_: Cascading delete of **projects**, **time entries**, or **invoices**; an archived-client state in v1.

### Project

A named body of work the **account owner** attributes time to. Has zero or one **client**; a **client** is not required. A **client** may be attached, switched, or cleared after **time entries** already exist, so long as none of those entries are on an **invoice**. May be **billable** at a per-project **hourly rate**. Distinct from a portfolio-site **project** (a mini-app on this site).

_Avoid_: Job, engagement, workspace; Toggl **tasks** (sub-projects)—out of scope for v1; requiring a **client** before time can be tracked; silently rewriting a **project**’s **client** while its **time entries** sit on an **invoice**.

### Project deletion

Removing a **project**. Blocked while that **project** has any **time entries**. Uninvoiced entries must be moved or deleted first; invoiced entries stay until **invoice deletion**.

_Avoid_: Cascading delete of **time entries**; an archived-**project** state in v1.

### Billable

A **project** setting, off by default. When on, time on that **project** can be charged at its **hourly rate** and included on **invoices**. Turning **billable** on requires an **hourly rate** greater than zero. A **project** may have a **client** and not be **billable**, or be **billable** with no **client** (those **time entries** cannot be invoiced until a **client** is attached). **Billable** may be cleared only when none of the **project**’s **time entries** are on an **invoice**.

_Avoid_: Per-entry billable flags in v1; charging time on a non-billable **project**; defaulting new **projects** to **billable**.

### Hourly rate

USD charged per hour on a **billable** **project**. Required and greater than zero while **billable** is on; kept if **billable** is later turned off. Set on the **project**, not on the **client** or the **time entry**. Applied at **invoice generation** from the **project**’s current rate and frozen on that **invoice** at confirm. Later **hourly rate** edits do not change issued **invoices**. V1 uses one currency (USD) for rates, **invoice totals**, and **amount paid**.

_Avoid_: Per-client or per-entry rates in v1; mixed currencies; rewriting issued **invoices** when the **project** rate changes; historical per-entry rates.

### Time entry

A record of tracked time attributed to exactly one **project**, with a start, an end (start must be before end), and an optional **description**. Duration is start-to-end, not a separate field. Created by the **Timer** (play starts it, pause completes it) or by **manual time entry**. Belongs to at most one **invoice**. The **account owner** can edit **project**, start, end, and **description**, or delete it, from **History** only when it is not on an **invoice**. Overlapping **time entries** are allowed.

_Avoid_: Timer session; timesheet row; putting the same **time entry** on two **invoices**; editing a **time entry** while it is on an **invoice**; treating pause as a gap inside one **time entry**; per-entry billable flags; editing duration as a third source of truth; rejecting overlaps.

### Description

Optional free text on a **time entry** saying what the time was for. Set or changed on the **Timer** before and during a **running timer**; stored on pause. Shown on the **time entry** row inside an **invoice**’s nested **project** expansion. Editable on **History** after the row is complete.

_Avoid_: Tags; required notes before play; treating **description** as a different record from the **time entry**; editing **description** on the pinned **running timer** row in **History**.

### Timer

The **tracker surface** with the play/pause control. Play starts a **time entry** on the selected **project**; pause completes that **time entry**. Play starts a new **time entry**, even on the same **project**. At most one **time entry** is running. Defaults to the last-selected **project**; if none exists, the control is empty and play is disabled. Changing **project** while running completes the current **time entry** and starts a new one on the newly selected **project**. Switching **tracker surfaces** does not pause. Optional **description** can be set or changed here while running. When the selected **project** is **billable** with an **hourly rate**, the face also shows this run’s amount (duration × **hourly rate**, nearest cent)—the same money math as **invoice generation**.

_Avoid_: Treating the **Timer** as the only place **time entries** exist; multiple simultaneous running **time entries**; resume-as-same-row after pause; retconning a running **time entry**’s **project** without splitting; showing an amount on a non-**billable** **project**; treating the live amount as an **invoice**.

### Running timer

The in-progress **time entry** on the **Timer**: selected **project**, start timestamp, and optional **description**. Persisted so refresh and backgrounding restore it. Pause writes the completed **time entry** when the **tracker store** is reachable, except a run shorter than one second is discarded (no **History** row). On sign-out, Time Tracker tries to pause and write; if that fails, the **running timer** is kept for that **account owner** on the device and restored at next sign-in. A different **account owner** on the same device does not see it.

_Avoid_: Queuing **History** edits or **invoice generation** while offline; treating tab memory alone as the record of a run; discarding a run because of a sign-out mis-tap; showing one owner’s **running timer** to another.

### Keep display on

While a **running timer** is active, Time Tracker requests that the device avoid sleeping (same best-effort behavior as **Game Timer**).

_Avoid_: Implying a guarantee on every OS or browser; leaving the display awake after pause.

### Settings cog

Top-bar settings control in the same chrome location as **Game Timer**. Holds the **browser fullscreen toggle** (personal, per-app; see portfolio **browser fullscreen toggle**) and the **issuer name**.

_Avoid_: A second fullscreen control on the **Timer** face; sharing Game Timer’s fullscreen preference; putting **David J. Perry** or **Focus Disorder** in settings as a default **issuer name**.

### Issuer name

The **account owner**’s name shown as the originator on **invoices** and the **client invoice page**. Set in the **settings cog**. Defaults from the Firebase display name when one exists; otherwise empty until set. Never defaults to **David J. Perry** or **Focus Disorder**.

_Avoid_: Site brand as letterhead; per-invoice letterhead in v1; blocking **invoice generation** on an empty **issuer name**.

### Online-first

Auth, the **tracker store**, **invoice generation**, and the **client invoice page** require connectivity in v1. The **running timer** is the exception: it is a local start timestamp that can outlive a drop, then writes on pause.

_Avoid_: Full offline **History** / **Clients** sync in v1.

### History

The **tracker surface** with a scrollable list of **time entries**. A **running timer** is pinned at the top (project, start, live duration)—visible, not editable, not deletable until pause files it. The **account owner** opens an uninvoiced completed entry to edit **project**, start, end, and **description**, or to delete it, and creates **manual time entries** here (same fields). Entries that are on an **invoice** are visible and not editable, including delete.

_Avoid_: Burying past time only inside **Projects** or **Clients**; requiring the **Timer** to add time after the fact; editing invoiced rows in place.

### Manual time entry

Creating a **time entry** by specifying **project**, start, end, and optional **description** on **History**, without running the **Timer**.

_Avoid_: Timer-only logging; calling this a different kind of record from a **time entry** started on the **Timer**.

### Invoice

A request for payment issued to one **client**, covering **time entries** whose **projects** belong to that **client**. Has an **invoice identity**, **invoice total**, an **amount paid**, and a derived **payment status**. No payment processing in v1.

_Avoid_: Bill, statement, timesheet; treating payment-processor checkout as in scope; editing an **invoice**’s **client** in place to correct a mistake.

### Invoice identity

The **invoice number** and issued date that label an **invoice** on its expansion header, together with total duration, **invoice total**, and **payment status**.

### Invoice number

A sequential identifier per **account owner**, unique among their **invoices**.

_Avoid_: Restarting numbers per **client** in v1; using only a date as the identity.

### Invoice total

The USD sum due on one **invoice**, from its **billable** **time entries**. Each **time entry** amount is exact duration × the frozen **hourly rate**, rounded to the nearest cent; **project** and **invoice** totals are sums of those amounts.

_Avoid_: Rounding time to 6- or 15-minute increments in v1; rounding only the **invoice total** so inner rows don’t add up.

### Amount paid

USD recorded as received on one **invoice**. `0` is unpaid; at least the **invoice total** is paid; in between is partially paid. “Mark unpaid” / “mark paid” set this to `0` or to the **invoice total**.

_Avoid_: Recording partial payment as a percentage only.

### Payment status

Unpaid, partially paid, or paid—derived from **amount paid** vs **invoice total**. Both the **client** (on the **client invoice page**) and the **account owner** (on **Clients**) can change **amount paid**, including paid → unpaid when a mark was a mistake. Changing **payment status** does not by itself unlock **time entries**.

_Avoid_: Treating paid as an irreversible seal; conflating “marked paid” with money actually received through a processor; client-only or owner-only payment marks.

### Unpaid balance

For one **client**, the USD still due: remaining (**invoice total** minus **amount paid**) summed across that **client**’s not-fully-paid **invoices**. Shown on the **client invoice page**, and as **unpaid** in the **client money summary** on **Clients**.

_Avoid_: A site-wide balance across all **clients**; treating fully paid **invoices** as still due.

### Client money summary

Four USD amounts on **Clients** for one **client**: **total** (**paid** + **unpaid** + **uninvoiced**), **paid** (**amount paid** on that **client**’s **invoices**, not more than each **invoice total**), **unpaid** (the **unpaid balance**—invoiced but still due), and **uninvoiced** (current **hourly rate** applied to uninvoiced **billable** **time entries** for that **client**, the same set **invoice generation** would pick with no date range).

_Avoid_: Including non-**billable** time or a **running timer**; mixing other **clients**; putting this four-way split on the **client invoice page** (that page still shows **unpaid balance** only).

### Pay all invoices

An action on one **client** that sets **amount paid** to each not-fully-paid **invoice**’s **invoice total**—settling the **unpaid balance** in one step. Available to the **client** and the **account owner**. Does not create a single combined **invoice**.

_Avoid_: Allocating a custom lump across **invoices** in v1; a processor checkout; unlocking **time entries**.

### Invoice generation

The **account owner** creating an **invoice** for one **client** from uninvoiced **billable** **time entries** on that **client**’s **projects**. An optional date range limits which entries are included; with no range, all outstanding qualifying entries are included. **Hourly rate** is taken from each **project** at this moment and frozen on the **invoice** when the owner confirms the preview.

_Avoid_: Per-row checkbox picking in v1; including non-**billable** or already-invoiced **time entries**; creating an **invoice** with no qualifying **time entries**; leaving issued **invoice** amounts tied to a live **project** rate.

### Invoice expansion

How an **invoice** is shown on the **client invoice page** and on **Clients**: a collapsible row for the **invoice** (**invoice identity**, total duration, **invoice total**, **payment status**). Nested under it, one collapsible row per **project** on that **invoice** (**project** name and that **project**’s duration and amount on this **invoice**). Nested under each **project**, the **time entries** (date, duration, amount, **description** if any).

_Avoid_: A single **project** name on the **invoice** header; flattening all **time entries** onto the **invoice** row.

### Invoice deletion

The **account owner** removing an **unpaid invoice**. Attached **time entries** are not deleted; they become uninvoiced and eligible for edit or a later **invoice**. A paid or **partially paid** invoice must be returned to unpaid before it can be deleted. This is the unwind for incorrect billing.

_Avoid_: Deleting **time entries** when tearing down an **invoice**; deleting a paid or **partially paid** invoice without first clearing **payment status**; a “reassign client” action that rewrites live billed history.

### Client invoice page

The unauthenticated, bookmarkable **client invoice link** unique to one **client** where that **client** sees their **invoices**, the **unpaid balance**, **pay all invoices**, and per-invoice **amount paid**. Not **paste-unfurl eligible**.

_Avoid_: Per-invoice secret URLs as the bookmark target; requiring the **client** to sign in; guessable client ids; short spoken codes; social-preview HTML for this route.

### Client invoice link

The capability URL for a **client**’s **client invoice page**: a high-entropy secret the **account owner** copies from **Clients**. Anyone who has it can view **invoices** and change **amount paid**. See [ADR 0027](../../../docs/adr/0027-time-tracker-client-invoice-capability-url.md).

_Avoid_: Treating this as a signed-in **account owner** route.

### Link regeneration

The **account owner** replacing a **client**’s **client invoice link** secret. The previous URL stops working; the **client** needs the new bookmark.

_Avoid_: Leaving leaked links valid forever; rotating on a timer with no owner action.

## Relationships

- An **account owner** has many **clients**, **projects**, **time entries**, and **invoices**.
- A **project** has zero or one **client**. Time can be tracked on a **project** with no **client**.
- A **time entry** belongs to exactly one **project**, and therefore follows that **project**’s **client** when one is set.
- An **invoice** belongs to exactly one **client** and may include many **time entries**.
- A **time entry** belongs to at most one **invoice**. Unassigned **projects** (no **client**) cannot contribute **time entries** to any **invoice**.
- A **project**’s **client** may be attached, switched, or cleared whenever none of that **project**’s **time entries** are on an **invoice**.
- A **time entry** on an **invoice** is not editable, paid or not. Unlocking it requires **invoice deletion**, which first requires **payment status** unpaid.
- **Invoice deletion** of an **unpaid invoice** releases its **time entries** so they can be edited or placed on another **invoice**. Paid and **partially paid** **invoices** must be marked unpaid before deletion.
- Both the **client** and the **account owner** can change an **invoice**’s **amount paid** (and thus **payment status**), including **pay all invoices** for that **client**.
- **Unpaid balance** is per **client**, not across the **account owner**’s whole book.
- **Client money summary** on **Clients** shows **total**, **paid**, **unpaid**, and **uninvoiced** for that **client**.
- **Billable** **projects** with no **client** cannot contribute **time entries** to an **invoice** until a **client** is attached.
- Non-**billable** **projects** never contribute **time entries** to an **invoice**.
- **Invoice generation** includes only uninvoiced **billable** **time entries** for that **client**, optionally filtered by date range (default: all outstanding), after a confirmed preview.
- An **invoice** is presented as an **invoice expansion**: **invoice** → **project** aggregates → **time entries**.
- **Time entries** from the **Timer** and from **manual time entry** are the same kind of record; both appear on **History**.
- Pause completes the current **time entry**; the next play creates a new one. At most one **time entry** runs at a time.
- Changing **project** on the **Timer** while running completes the current **time entry** and starts a new one on the new **project**.
- Switching **tracker surfaces** does not pause a **running timer**. The **running timer** persists across refresh and backgrounding; pause writes to the **tracker store** when online. It appears pinned on **History** but cannot be edited or deleted until pause.
- **Keep display on** engages while a **running timer** is active.
- **Issuer name** is the originator on **invoices**; it is not site branding.
- The **client invoice page** is how a **client** sees **invoices**, the **unpaid balance**, and records **amount paid**; the **account owner** can do the same from **Clients**, and holds the **client invoice link** (with **link regeneration**).
- **Client deletion** is blocked while **invoices** exist; otherwise **projects** become unassigned.
- **Project deletion** is blocked while any **time entries** remain.

## Flagged ambiguities

- **Project vs portfolio project**: Resolved — in this context a **project** is a body of work. Time Tracker itself is a portfolio **project**.
- Attach **client** after time is logged: Resolved — allowed.
- Change or clear a **project**’s **client** when no **time entry** on that **project** is invoiced: Resolved — allowed.
- Correcting billed time: Resolved — **invoice deletion** of an **unpaid invoice**, not in-place client rewrite. Paid or **partially paid** invoices return to unpaid first, then can be deleted.
- **Time entry** vs timer session: Resolved — the record is a **time entry** (covers **Timer**-started and **manual time entry**).
- Editing or reassigning a **time entry** on an **invoice**: Resolved — never, while it remains on the **invoice**.
- Who may change **payment status**: Resolved — both the **client** and the **account owner**.
- Partial payment: Resolved — **amount paid** vs **invoice total**, USD. **Pay all invoices** fully settles every not-fully-paid **invoice** for that **client**.
- **Invoice generation**: Resolved — uninvoiced **billable** **time entries** for that **client**, optional date range defaulting to all outstanding; preview then confirm. No per-row picker in v1.
- Play/pause: Resolved — pause completes the **time entry**; play starts a new one; at most one running.
- Change **project** while running: Resolved — split: complete current **time entry**, start a new one on the new **project**.
- Uninvoiced **time entry** edits: Resolved — **project**, start, end, optional **description**; duration derived; delete allowed. No tags or per-entry billable. **Manual time entry** uses the same fields.
- **Invoice expansion**: Resolved — **invoice** header is **invoice identity**, duration, **invoice total**, **payment status**; nested **project** expansions with name and project-level duration/amount; **time entries** inside each **project**.
- **Hourly rate** on an **invoice**: Resolved — **project** rate at **invoice generation**, frozen at preview confirm. Issued **invoices** are not rewritten when the **project** rate changes.
- **Client invoice page** access: Resolved — unauthenticated **client invoice link** (capability URL); **link regeneration** invalidates the old bookmark. [ADR 0027](../../../docs/adr/0027-time-tracker-client-invoice-capability-url.md).
- **Client deletion** / **project deletion**: Resolved — no cascade, no archive. **Client deletion** requires zero **invoices**, then unassigns **projects**. **Project deletion** requires zero **time entries**.
- **Running timer**: Resolved — persisted start + **project**; surfaces don’t pause it; store/invoices stay **online-first**. **Keep display on** while running. **Settings cog** (Game Timer placement) holds **browser fullscreen toggle**. Pinned on **History**, not editable until pause.
- **Description** on the **Timer**: Resolved — optional, editable during the run, stored on pause; **History** edits it after complete.
- **Client** fields: Resolved — display name only in v1.
- **Issuer name**: Resolved — settings field, default Firebase display name if any, never **David J. Perry** / **Focus Disorder**. Empty does not block **invoice generation**.
- Product name: Resolved — **Time Tracker** for v1.
- New **project** **billable** / **hourly rate**: Resolved — not **billable** by default; **billable** requires a rate > 0; **billable** off only when no **time entries** are invoiced. Rate may still change for future **invoices**.
- Overlapping **time entries**: Resolved — allowed; each row still needs start before end. No split/reject/warn in v1.
- Duration to money: Resolved — exact duration × **hourly rate**, nearest cent per **time entry**; totals are sums. No time-increment rounding in v1.
- **Running timer** on sign-out: Resolved — pause-and-write if online; otherwise keep for that **account owner** on the device. Not visible to another account.
- Sub-second run: Resolved — duration under one second is discarded; no **time entry**.
