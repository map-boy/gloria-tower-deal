# Gloria Tower

Utility billing for a rental building. A technician reads meters, the system
turns each reading into a bill, the client pays and sends proof, and the
recovery agent confirms it.

## Four portals

Everyone opens the same URL and lands where they belong.

| Portal | Who | What they do |
| --- | --- | --- |
| **Client** | tenants | See what they owe, pay, send proof, ask questions |
| **Technician** | field staff | Register clients with a starting meter reading, record readings |
| **Recovery** | collections | Set prices, check proof, mark paid, chase overdue, keep records |
| **Admin** | owners | Everything, plus assigning who is what |

Staff sign in with Google; their role comes from the staff directory an admin
manages. Clients never get an account — they enter with their room number, the
phone the technician wrote down, and a password they choose the first time.

## The money loop

1. Recovery sets the price per unit for electricity and water, and the monthly
   rent.
2. A technician registers a client, writing down the meter numbers showing that
   day. Every bill they ever get is measured from those.
3. The technician records a new reading. The system bills
   `(new − previous) × price` and the client has **5 days** to pay.
4. The client pays however they normally do and uploads a photo of the proof.
5. Recovery checks it and marks it paid, or part paid with the figure actually
   received.

A bill freezes the price it was raised at, so changing prices never rewrites
what a client was already told to pay.

**Readings that go backwards are rejected.** A meter reading lower than the
last one means a misread or a replaced meter, and billing it silently as zero
would bury a mistake the technician needs to fix on the spot.

## Reminders

Two SMS messages inside the 5 day window: one the moment the bill is raised,
another on day 3. Past day 5 the bill shows as overdue and recovery gets an
alert naming how many clients are late.

## Photo retention

Payment photos are deleted **7 days** after upload to stay inside the free
storage tier. The recovery agent downloads anything worth keeping before then,
and gets a warning the day before a batch expires. The payment record — amount,
meter reading, who approved it and when — stays forever either way.

## The watchdog

A scheduled check every 6 hours tells recovery and admin if something is
broken: billing detached, storage near the free limit, Firestore not
answering, or SMS failing. Findings land in the same alerts list as everything
else.

## Cost control

- **Instance caps** (`maxInstances: 3`) bound how fast anything can spend.
- **A billing kill switch** detaches the billing account if spend passes the
  budget. A hard stop, not a throttle: the project goes dead and stays dead
  until a human re-attaches billing.

## Configuration

Frontend (`.env`, and the same values in Vercel):

```
VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID,
VITE_FIREBASE_APP_ID, VITE_FIREBASE_VAPID_KEY
```

SMS, on the functions side:

```bash
firebase functions:secrets:set MIC_API_KEY
firebase functions:config:set   # or set MIC_SMS_ENDPOINT / MIC_SENDER_ID as env vars
```

`MIC_SMS_ENDPOINT` is the provider's send URL. Until both it and the key are
set, messages are written to the `smsLog` collection marked `not_configured`
rather than silently dropped, and the watchdog reports them.

## Running it

```bash
npm install
npm run dev
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

## Layout

```
src/
├── 1_core/       # Domain types and the billing maths (pure, tested)
├── 2_backend/    # Firebase services
└── 3_frontend/   # Shared UI kit, components, and the four portals
functions/        # Roles, billing, reminders, retention, watchdog, kill switch
```
