# Cash Power Tracker

A small rental building tool. A tenant types the room number that is on their
door plus their name, and they are in — no admin approval, no account to open.
They pay their rent and cash power however they already do (phone, Irembo,
cash), then send a screenshot or photo of the payment along with what they
paid and their cash power meter reading. The admin sits with that in front of
them and marks it paid, or partial with the amount actually received.

## How it works

**Tenant**
- Enters room number + name on the landing screen. Phone is optional, and so
  is "do you have cash power?" — rooms without a meter simply never see the
  reading field.
- Sees only their own room and their own submissions. Nothing about the
  building, other rooms, or other tenants.
- Sends a payment: amount paid, cash power reading typed free-form (meter
  numbers are not in any sequence), an optional note, and a photo or
  screenshot as proof.

**Admin**
- Signs in with Google. Bootstrap admins are listed in `authService.ts`,
  `firestore.rules` and `functions/index.js`; anyone else needs a doc in the
  `admins` collection.
- Gets a bell alert and a push notification the moment a tenant submits.
  Clicking the alert opens that tenant's screen with what they uploaded.
- Sees every room registered, every submission, and what is still waiting to
  be marked.
- Marks a submission **paid**, or **partial** with the figure actually
  received, and can edit any field on any room or submission — a mistyped
  reading, a wrong amount, a name.
- Can free a room number so a new tenant can claim it.

**Rooms are never hard-coded.** A room doc is created the first time someone
types its number, so the building can be any shape and grow as tenants arrive.
The first anonymous browser to claim a room number owns it; anyone else typing
the same number is told to talk to the admin.

## Photo retention

Payment photos are deleted 14 days after upload by a daily Cloud Function
(`cleanupExpiredScreenshots`, also callable on demand as
`cleanupScreenshotsNow`) to stay inside the free Storage tier. The submission
record — amount, cash power reading, notes, admin decision — stays forever, so
the archive still shows that this person read this meter and paid this much.

## Tech stack

- **Frontend:** React + Vite + TypeScript + Tailwind
- **Backend:** Firebase — Firestore, Storage, Cloud Functions, FCM
- **Auth:** anonymous sign-in for tenants (their uid owns the room),
  Google sign-in for admins

There is no payment-provider integration. Everything about Irembo APIs, bank
webhooks and generated invoices was removed — payment proof is a photo, and
confirmation is the admin's own judgement.

## Project structure

```
src/
├── 1_core/       # Domain types and formatters
├── 2_backend/    # Firebase services (auth, storage, notifications)
└── 3_frontend/   # React components and hooks
functions/        # claimRoom, submission alerts, screenshot cleanup
```

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Firebase project values
npm run dev
```

Deploy rules and functions with `firebase deploy --only firestore:rules,storage,functions`.
