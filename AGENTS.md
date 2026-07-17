<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
# MenuFy — Repository Guidance

## Project overview

MenuFy is a multi-tenant SaaS for digital restaurant menus and QR codes. Customers do not create their own accounts in the MVP: accounts are provisioned by a `SUPER_ADMIN`. A `CLIENT_ADMIN` can manage only the data owned by their `clientId`.

Current stack:

- Next.js 16 with App Router and TypeScript
- Tailwind CSS; use shadcn/ui incrementally for basic UI components
- Auth.js with Credentials and JWT sessions
- Prisma 7 with PostgreSQL on Neon
- Vercel for Preview and Production deployments
- npm as the package manager

Communicate with the maintainer in Brazilian Portuguese. Be direct, explain risky commands before suggesting them, and prefer a small number of verifiable steps.

## Repository layout

- `app/`: routes, layouts, route handlers and generated Prisma client
- `app/api/auth/[...nextauth]/route.ts`: Auth.js route handler
- `app/generated/prisma/`: generated code; never edit manually
- `lib/auth/`: authentication guards, tenant rules and login rate limiting
- `lib/data/`: tenant-scoped and public read queries
- `lib/services/`: validated business mutations
- `lib/prisma.ts`: shared Prisma client
- `lib/audit.ts`: business and security audit logging
- `lib/error-logger.ts`: internal application error logging
- `prisma/schema.prisma`: database schema
- `prisma/migrations/`: immutable migration history
- `prisma/seed.ts`: local/manual initial data seed
- `auth.ts`: Auth.js configuration
- `instrumentation.ts`: automatic server error capture
- `proxy.ts`: temporary site-wide Basic Auth protection

## Local commands

Use Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
npm run lint
npm run build
```

Prisma commands:

```bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name <descriptive_name>
npx prisma generate
npx prisma migrate status
npx prisma studio
```

Vercel uses:

```bash
npm run vercel-build
```

This runs `prisma generate`, `prisma migrate deploy`, and `next build`.

There is no automated test script yet. Do not claim tests passed unless a test runner exists and was executed.

## Git workflow

- Use `git checkout`; do not use `git switch`.
- Branch flow: `feature/*` or `fix/*` -> `homolog` -> `main`.
- `homolog` is the Preview/homologation branch.
- `main` is Production.
- Never commit directly to `homolog` or `main`.
- Pull requests from feature or fix branches must target `homolog` first.
- Keep commits small and use Conventional Commit prefixes such as `feat:`, `fix:`, `chore:`, `refactor:` and `docs:`.
- Do not commit, push, open a PR, merge, or delete a branch unless the user explicitly requests that action.
- Preserve unrelated changes in a dirty worktree.
- Before proposing a PR, run the applicable verification commands and inspect `git status`.

## Multi-tenant security rules

Tenant isolation is mandatory and is enforced in application code.

- A `CLIENT_ADMIN` may access only resources whose `clientId` equals the authenticated session's `clientId`.
- Never trust a `clientId` received from forms, query strings, route parameters, request bodies, or client components.
- Resolve ownership from the authenticated user with helpers from `lib/auth/tenant.ts`.
- Use `getTenantFilter`, `resolveClientId`, and the existing guarded data/service layers.
- For tenant-owned resources, do not query only by a user-supplied `id`. Use a scoped query such as `findFirst({ where: { id, ...getTenantFilter(user) } })`.
- Do not introduce direct tenant-resource Prisma queries in route handlers or UI components when an existing function in `lib/data` or `lib/services` can be used.
- A `SUPER_ADMIN` may read all tenants, but mutations that create tenant-owned data must receive an explicit target client and validate it.
- Products, categories, menus, and join records must belong to the same client. Reject cross-client associations.
- Public queries must return only explicitly selected public fields and only active, visible, published data. Use `getPublicMenuBySlug` as the established boundary.
- When access should be indistinguishable from a missing resource, return/not-found rather than revealing that another tenant owns the ID.

## Authentication and authorization

- Roles are `SUPER_ADMIN` and `CLIENT_ADMIN`.
- There is no public signup in the MVP.
- Sessions use JWT and include `id`, `role`, and `clientId`.
- Server pages must use the guards from `lib/auth/guards.ts`.
- Do not authorize only in the UI. Every read and mutation must be authorized on the server.
- Failed login attempts are rate-limited and audited. Do not weaken or bypass this protection.
- Do not assign `actorId` to a failed login when the identity has not been authenticated.
- Never return whether an e-mail exists or whether the password alone was incorrect.

## Plans and business rules

- Every client belongs to a plan.
- Menu limits are enforced server-side using `Plan.maxMenus`; hiding a button in the UI is not enforcement.
- Draft and published menus count toward the limit. Archived menus do not.
- `Plan.isActive` controls whether a plan is offered for new assignments; it must not automatically block existing clients.
- `Client.isActive` controls client access.
- Store currency as integer cents, for example `4990` for R$ 49,90. Do not use floating-point money values.
- Prefer archive/deactivate operations over destructive deletion when history or relations must be preserved.

## Prisma and database rules

- Runtime database access uses the pooled `DATABASE_URL`.
- Prisma migrations use `DATABASE_URL_UNPOOLED`.
- Local development uses the Neon `development` branch.
- Vercel Preview deployments use isolated Neon preview branches.
- Vercel Production uses the Neon main branch.
- After changing `schema.prisma`, run format, validate, create a named migration, and generate the client.
- Use `prisma migrate dev` locally and `prisma migrate deploy` in deployed environments.
- Do not use `prisma db push` for committed schema changes.
- Do not use `prisma db pull` as a routine migration workflow.
- Never edit or delete an already-applied migration. Create a new migration instead.
- Never edit `app/generated/prisma` manually.
- Do not run the seed automatically in Production. The seed is a deliberate manual operation.
- Schema changes, destructive queries, and data backfills require explicit review.

## Input validation and mutations

- Validate all external input with Zod on the server.
- Prefer `.strict()` schemas for mutation payloads so unexpected fields are rejected.
- Do not accept ownership fields in update payloads.
- Mutations belong in `lib/services`, not directly in React components.
- Use transactions when a mutation validates and writes related records together.
- Preserve the established serializable transaction/retry behavior for plan quota enforcement.
- Use stable business error classes for expected conflicts, forbidden actions, and missing resources.

## Logging and sensitive data

- `AuditLog` records who performed business or security actions.
- `ErrorLog` records application failures.
- Keep the internal logger; do not add Sentry unless the user explicitly changes this decision.
- Unexpected server errors should pass through the existing error logger and structured `console.error` fallback.
- Expected validation and business errors should be handled without leaking internal stack traces to users.
- Never log or commit passwords, hashes, tokens, cookies, authorization headers, Auth.js secrets, database URLs, or full environment objects.
- Never expose audit/error logs to a `CLIENT_ADMIN` unless an explicitly scoped product requirement is added.
- Keep `.env`, `.env.local`, and real credentials out of Git. `.env.example` contains names and placeholders only.
- Seed credentials use `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD` locally/manual only.

## Next.js and UI conventions

- Prefer Server Components. Add `"use client"` only when browser state, effects, or event handlers require it.
- Keep authorization, Prisma access, secrets, and business rules on the server.
- Do not import server-only modules into Client Components.
- Reuse data and service functions instead of duplicating Prisma logic.
- Keep shadcn/ui usage basic and incremental; do not install large component sets preemptively.
- Ask before adding a new production dependency and explain why the current stack is insufficient.
- The Basic Auth in `proxy.ts` intentionally protects the whole site during private development. Before launch, update the matcher deliberately so published menu routes can be public without exposing admin/dashboard routes.
- Tighten the Content Security Policy only after accounting for the actual image/storage domains and required Next.js assets.

## Definition of done

For ordinary TypeScript changes:

```bash
npm run lint
npm run build
```

For Prisma schema or migration changes, also run:

```bash
npx prisma format
npx prisma validate
npx prisma migrate status
```

Before handing off work:

- Confirm tenant isolation remains intact.
- Confirm no secret or generated file was staged.
- Review `git status` and summarize changed files.
- State exactly which checks were run and whether they passed.
- Mention any check that could not be run and why.
- Do not describe work as complete when build, lint, migration, or deployment errors remain.