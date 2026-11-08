# Teen Liwa v2 — D1 and CMS rollout

## Database

The new production database is configured in `wrangler.json`:

- D1 database name: `teenliwa-v2`
- D1 database ID: `7912cd75-0a35-4bdc-9aa0-6679ca80d20d`
- Worker binding: `TEENLIWA_V2`
- Migration directory: `migrations-v2/`

Cloudflare requires a binding name to be a valid JavaScript identifier. The database name may contain hyphens, so the configured binding is `TEENLIWA_V2` and the database name remains `teenliwa-v2`.

## Apply the schema before deploying

Run from the repository root:

```bash
npm install
npx wrangler d1 migrations apply teenliwa-v2 --remote
```

Verify the tables:

```bash
npx wrangler d1 execute teenliwa-v2 --remote --command "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;"
```

Do not deploy the new Worker before the migration succeeds. The v2 APIs intentionally return a service-unavailable response if their required D1 tables are missing.

## Worker secrets

Set secrets using Wrangler or the Cloudflare dashboard. Never add secret values to Git, D1 settings, or browser storage.

```bash
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SESSION_SECRET
npx wrangler secret put ZIINA_API_TOKEN
npx wrangler secret put ZIINA_WEBHOOK_SECRET
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put META_ACCESS_TOKEN
npx wrangler secret put META_APP_SECRET
```

The current CMS login is a single administrator configured with Worker secrets and signed, short-lived HttpOnly cookies. The `admin_users`, `admin_sessions`, and `cms_audit_logs` tables are reserved for a future multi-admin/role-management rollout and are not yet used by the login flow.\n\nUse a strong admin password (at least 16 characters) and a random session secret (at least 32 characters). Keep `ZIINA_TEST_MODE=true` until test payments and signed webhooks have been verified. Change the Worker var to `false` only when you are ready for live payments.

## R2 image storage

The Worker uses the existing R2 bucket binding:

- Binding: `BUCKET`
- Bucket: `bt-liwa`

R2 is for image/media objects only. Product records, settings, orders, customers, payments, campaigns, and leads live in D1. Do not put S3 keys into CMS forms or browser storage.

## CMS and storefront data sources

- Public product catalogue: active, non-deleted products from D1.
- Product create/update/archive: authenticated CMS API; prices are entered in AED and stored as integer fils.
- Checkout: the browser sends product IDs and quantities only. The server loads prices, validates quantity/availability, calculates delivery, reserves tracked stock, and persists the order before confirming checkout.
- Order management: authenticated CMS API; cancellation restores reserved stock once.
- Store settings: public-safe settings are read from D1; writes require an admin session.
- Meta campaigns: records are saved in D1 as drafts (paused). The current campaign CMS does not launch or spend ad budget through Meta automatically.
- Marketing leads: private D1 records; all list and mutation routes require an admin session.
- Ziina: payment attempts are separate from orders; verification checks the provider response, amount, and AED currency. Webhook signatures must be configured.

## Deploy

After the remote migration is applied and secrets are set:

```bash
npm run check
npx wrangler deploy
```

The repository CI also runs type-check, build, and Worker dry-run validation on pushes to `main`.

## Important first-run behavior

The new database starts empty. No sample products, sample orders, demo campaigns, or demo leads are inserted into D1. Add real product records through the authenticated CMS after the new Worker is deployed and verified.
