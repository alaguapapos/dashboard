# Al Agua Papos dashboard

Private, mobile-first React dashboard built with Next.js, shadcn/Radix, and Recharts. Clip supplies live card/cash sales and actual settlement fees. Manual expenses and private receipt files use Supabase Postgres and Storage; owner access uses Supabase Auth.

## Development

Use Node 22 and `npm ci`. Configure `.env.local` from `.env.example` using your linked Vercel project's environment. Apply `supabase/migration.sql` to a new Supabase project and create an authorized owner account. Keep all service-role credentials and the Clip token server-side.

- `npm run dev`: local development
- `npm test`: financial/date/validation tests
- `npm run build`: standard Next.js production build
- `npm start`: run the production build

Deploy through the connected Vercel project with framework **Next.js**, build command **npm run build**, and default output directory. See [migration and verification instructions](docs/VERCEL-MIGRATION.md) before promoting a migration deployment.

## Privacy

All business API routes and receipt downloads require a verified account listed in `DASHBOARD_ALLOWED_EMAILS`. Expense tables have row-level security and no direct anonymous/user grants. Receipt uploads use signed staging URLs and server-side content validation; final files remain private.
