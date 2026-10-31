# Al Agua Papos dashboard
React 19 + Vinext, shadcn/ui (Radix), Recharts, Cloudflare D1. Private Sites hosting.

The dashboard uses Clip for sales and deposits, and its own database for manual expenses. Google Sheets is optional read-only history and never feeds metrics automatically.

## Develop
Use Node >=22.13, npm install, and npm run dev. Configure CLIP_TOKEN in ignored .dev.vars for local preview and as a secret in Sites for production. No credentials belong in source. D1 binding is DB. R2 binding is BUCKET for private expense receipts.

After npm run build, apply each pending local migration once:
`node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_petite_harrier.sql`

Apply drizzle/0001_neat_mandroid.sql using the same command before starting the current app. Then npm run dev. Production migrations are applied by Sites publishing. Keep the deployed Site owner-private; its authentication is the access boundary for business data. Changing the audience requires adding explicit business-member authorization.

Validation: npm exec tsc -- --noEmit; npm run build. Historical Sheets import is optional: configure GOOGLE_SHEET_ID server-side for the source workbook. Financial analysis notes and workbook identifiers are intentionally excluded from this public repository.
