# Letting Partners Portal

The internal lettings CRM, property management and publishing portal. It is a
separate Next.js application inside this repository, deployed as its own Vercel
project on its own domain (`portal.lettingpartners.co.uk`), and it feeds the
public website over an authenticated API.

```
letting-partners/          public website (www.lettingpartners.co.uk)
└── portal/                this application (portal.lettingpartners.co.uk)
```

The two applications share no code and no build. They are joined only by the
website API described below.

## Stack

| Concern     | Choice                                        |
| ----------- | --------------------------------------------- |
| Framework   | Next.js 16 (App Router, React 19)             |
| Language    | TypeScript, strict                            |
| Database    | PostgreSQL 14+                                |
| ORM         | Drizzle ORM + drizzle-kit migrations          |
| Auth        | Email OTP (Resend), database-backed sessions  |
| Storage     | Vercel Blob                                   |
| Styling     | CSS design tokens + Tailwind utilities        |
| Tests       | Node test runner (`node --test`)              |

## Getting started

```bash
cd portal
npm install
cp .env.example .env.local     # then fill in DATABASE_URL and AUTH_SECRET
npm run db:migrate
npm run db:seed
npm run dev                    # http://localhost:3003
```

Generate an `AUTH_SECRET` with:

```bash
openssl rand -base64 48
```

Or, if openssl is not on your PATH:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### Running without a database server

If you have not provisioned Postgres yet, point `DATABASE_URL` at the embedded
build and everything works with no server and no credentials:

```
DATABASE_URL=pglite://./.pglite
```

That is PGlite - real Postgres compiled to WebAssembly, running in-process.
Migrations, the seed and the whole application work against it. It is for local
development only; production uses a `postgres://` URL.

Without `RESEND_API_KEY`, sign-in codes are printed to the dev server console
instead of being emailed, so you can sign in offline.

## Commands

| Command               | What it does                                            |
| --------------------- | ------------------------------------------------------- |
| `npm run dev`         | Dev server on port 3003                                 |
| `npm run build`       | Production build                                        |
| `npm run typecheck`   | `tsc --noEmit`                                          |
| `npm run lint`        | ESLint                                                  |
| `npm test`            | Business-logic tests                                    |
| `npm run db:generate` | Generate a migration from schema changes                |
| `npm run db:migrate`  | Apply pending migrations                                |
| `npm run db:studio`   | Drizzle Studio                                          |
| `npm run db:seed`     | Reset and seed development data (refuses on production)  |
| `npm run db:verify`   | Assert the database rejects what it should (needs a seed) |
| `npm run smoke`       | Sign in as each role and request every route             |

Never use `db:push` against production - it applies schema changes without a
migration file, so the change is not reproducible.

## Architecture

Business rules live in `services/`, never in pages or components. A page loads
data and renders; it does not decide who may see what or how much anyone earns.

Rules that need testing are extracted into pure modules with no database or
`server-only` import, and the service layer delegates to them. That is why the
state machine, the ownership rules and the listing rules can be unit tested
directly.

| Module                          | Responsibility                                            |
| ------------------------------- | --------------------------------------------------------- |
| `services/permissions.ts`       | Authorisation, plus SQL scope filters for every list query |
| `services/access-rules.ts`      | The ownership rules themselves, pure and tested            |
| `services/phone-lookup.ts`      | Who owns a number: landlord, follow-up lock, not-interested |
| `services/commission-engine.ts` | All money. The only place a commission figure is derived   |
| `services/deals.ts`             | The pipeline, and the atomic closing transaction           |
| `services/deal-state.ts`        | Legal stage transitions, pure and tested                   |
| `services/listing-rules.ts`     | Publish readiness and rent derivation, pure and tested     |
| `services/properties.ts`        | Property onboarding, rooms, publishing                     |
| `services/calls.ts`             | Call lifecycle writes                                      |
| `services/follow-ups.ts`        | Follow-ups, the not-interested register, the call log      |
| `services/cross-sell.ts`        | Cross-sell search and collaborations                       |
| `services/chat.ts`              | Customer and internal chat, kept strictly apart            |
| `services/website.ts`           | The public projection of a property                        |
| `services/images.ts`            | Image library, with alt text at upload time                |
| `services/reports.ts`           | Daily report, performance, funnel                          |
| `services/users.ts`             | Staff accounts, profile, audit reads                       |
| `services/audit.ts`             | Append-only audit log and activity timeline                |
| `lib/phone.ts`                  | UK phone normalisation                                     |
| `lib/money.ts`                  | Pence arithmetic, rent conversion, PKR display             |

### Rules the code will not let you break

- **Money is integer pence.** Percentages are basis points (1000 = 10.00%).
  Nothing holds money in a float.
- **A landlord is their phone number.** Normalisation keeps the last 10 digits,
  so `+44 7911 123456`, `07911 123456` and `0044 7911 123456` are one landlord.
  A partial unique index enforces it in the database, not just in code.
- **A follow-up locks its number** to the fronter who created it. Overriding is
  an agent/admin power and always writes an audit entry.
- **Nothing is deleted.** Retries add attempts. Failures walk a deal back a
  stage. Records are archived with `deletedAt`, never removed.
- **Commission is snapshotted at closing.** Changing a rule tomorrow cannot
  alter a sale that completed today.
- **Cross-sell splits the agent pool, not the gross.** There is a test for this
  because it is the easy mistake to make.
- **Customer chat never reaches a fronter**, at the permission layer and in the
  navigation.

### Website listing status vs deal pipeline

Two separate fields, deliberately:

- `listingStatus` - `DRAFT`, `READY_TO_PUBLISH`, `PUBLISHED`, `UNPUBLISHED`,
  `LET_AGREED`, `INACTIVE`, `ARCHIVED`
- `dealStage` - `AVAILABLE`, `VIEWING`, `VERIFICATION`, `CLOSING`,
  `CLOSED_SUCCESSFUL`, `CLOSED_UNSUCCESSFUL`

A property can be published and in verification at the same time. Overloading
one field would make that impossible to express.

### Database guarantees

The important rules are enforced by the schema, not only by application code:

| Index / constraint                          | What it prevents                              |
| ------------------------------------------- | --------------------------------------------- |
| `landlords_normalized_phone_unique`         | Two landlords on the same number               |
| `follow_ups_active_phone_unique`            | Two fronters holding the same number           |
| `deals_one_success_per_room` / `_property`  | A second successful closing on the same unit   |
| `deals_one_active_per_room` / `_property`   | Two live deals on the same unit                |
| `properties_available_rooms_within_total`   | More available rooms than exist                |
| `cross_sell_splits_total_100`               | A split that does not add up to 100%           |
| `property_images_single_cover`              | Two cover photos on one listing                |

## Public website integration

The website already calls this contract, so publishing a property from the
portal makes it appear on the site with no change to the website's data layer.

```
GET  /api/website/properties            -> { ok, properties: [...] }
GET  /api/website/properties/:idOrSlug  -> { ok, property: {...} }
POST /api/public/chat                   -> start or continue a visitor chat
GET  /api/public/chat?visitorToken=...  -> that visitor's thread
```

The property endpoints require the header `x-website-api-key`, matching
`WEBSITE_API_KEY` in both projects. The website proxies them through its own
`/api/website/*` routes, so the key never reaches a browser.

The response is built from an explicit whitelist in `services/website.ts`. A
column added to `properties` later cannot leak: it has to be added to the
projection deliberately. Never exposed:

- landlord identity or contact details
- commission of any kind
- the originating fronter or any internal ownership
- internal notes and the deal pipeline
- the full street address (area plus outward code only)

The chat endpoint is unauthenticated by necessity - visitors are anonymous - so
it is rate limited per visitor token and per IP, and only ever returns the
thread belonging to the token presented.

## Deployment

Two Vercel projects from this one repository.

**Public website** - Root Directory: `/` (repository root).

**Portal** - Root Directory: `portal`. Set every variable from
`.env.example`, and make sure `WEBSITE_API_KEY` is byte-for-byte identical in
both projects. Point the portal project at `portal.lettingpartners.co.uk` and
set `NEXT_PUBLIC_SITE_URL` to the live website origin so CORS allows it.

Run `npm run db:migrate` against the production database as part of the release
- it is not run automatically by the build.

The website needs these variables to reach the portal:

```
WEBSITE_API_BASE_URL=https://portal.lettingpartners.co.uk/api/website
WEBSITE_API_KEY=<the same value as the portal>
```

## Testing

```bash
npm test
```

### Verifying against a real database

```bash
npm run db:verify   # the database rejects duplicate landlords, stolen
                    # follow-ups, double closings, impossible room counts
                    # and splits that do not total 100%
npm run smoke       # every route, as admin, agent and fronter, asserting
                    # that role gates actually gate
```

`db:verify` writes raw SQL that bypasses every service, so it proves the
guarantees are in the schema rather than only in application code.

### Unit tests

Covers phone normalisation across every UK format, the commission waterfall
including the cross-sell split and rounding, rent conversion, postcode parsing,
the legal deal transitions, the ownership rules (including that one fronter
cannot take another's follow-up), and publish readiness.

`npm test` fails rather than passing silently if no test files are found - the
Node 20 runner does not discover TypeScript files given a directory, so
`scripts/run-tests.mjs` collects them explicitly.
