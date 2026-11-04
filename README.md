# SignMatrix Engine (Documenso)

> **SignMatrix Engine** is a customized deployment of the Documenso open-source electronic-signature platform. It provides a web application for preparing, sending, tracking, and signing documents, with supporting APIs, background processing, and configurable storage, email, and PDF-signing providers.

[![Live application](https://img.shields.io/badge/Live%20app-Railway-7B2CEB)](https://documenso-app-production-1e13.up.railway.app/signin)

## Table of contents

- [Overview](#overview)
- [What the application does](#what-the-application-does)
- [Architecture and request flow](#architecture-and-request-flow)
- [Repository layout](#repository-layout)
- [Technology stack](#technology-stack)
- [Document lifecycle](#document-lifecycle)
- [APIs and integrations](#apis-and-integrations)
- [Data and storage](#data-and-storage)
- [Security considerations](#security-considerations)
- [Run locally](#run-locally)
- [Deploy on Railway](#deploy-on-railway)
- [Global availability and scaling](#global-availability-and-scaling)
- [Configuration reference](#configuration-reference)
- [Useful commands](#useful-commands)
- [Testing and quality checks](#testing-and-quality-checks)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License and upstream project](#license-and-upstream-project)

## Overview

The repository is a TypeScript-first npm-workspaces monorepo. Its main production service is `apps/remix`: a React Router v7 application served by a Hono/Node server. The server combines the browser UI with REST/tRPC endpoints and job handling, while shared packages provide business logic, authentication, PostgreSQL access, email, UI components, and PDF signing.

The repository description mentions contract lifecycle and AI verification. The checked-in code clearly implements document preparation/signing workflows and contains optional Google Vertex AI configuration; the exact AI verification capabilities and their availability depend on the enabled application features and deployment configuration. Do not treat optional integrations as enabled merely because their environment variables exist in `.env.example`.

### Live application

- **Sign-in:** [documenso-app-production-1e13.up.railway.app/signin](https://documenso-app-production-1e13.up.railway.app/signin)
- The URL is a public application endpoint. This README intentionally does **not** publish a password or shared account credentials. Do not commit credentials, API tokens, signing keys, or other secrets to Git; rotate any credentials that have already been exposed publicly.

## What the application does

At a high level, an authorized user can prepare documents for signing, define recipients and signature fields, send requests, and follow document status through completion. The schema and application architecture include:

- **Documents and envelopes:** A document is managed as an envelope, with one or more envelope items, metadata, recipients, fields, and audit events. Envelopes can represent documents or templates.
- **Recipient workflows:** Recipients can be signers, approvers, viewers, assistants, or CC recipients. Signing can be parallel or ordered/sequential, depending on document settings.
- **Signature fields:** Fields include signatures, initials, names, email, date, text, number, radio, checkbox, and dropdown types.
- **Templates and folders:** The data model supports templates, direct-link template workflows, and folders/subfolders for organizing work.
- **Signing and sealing:** A signing provider produces a cryptographic PDF signature; an asynchronous job can seal/finalize a document after required actions complete.
- **Notifications and integrations:** Configurable email delivery and webhooks communicate events such as document sent, opened, signed, completed, rejected, or cancelled.
- **Organizations and teams:** The schema supports memberships, roles, groups, team-level API tokens, and organization settings.
- **Account protections:** Authentication-related schema includes sessions, password-reset and verification tokens, audit events, two-factor settings, and passkeys. The enabled sign-in options depend on deployment configuration.

Features and limits can vary by edition, configuration, and external services. This documentation describes repository evidence and should not be interpreted as a legal, compliance, or security certification.

## Architecture and request flow

The application is a monorepo, not a collection of unrelated services. `apps/remix` is the primary web service; workspace packages are imported into it and built together with Turborepo.

```text
Browser
  │ HTTPS
  ▼
Railway public domain / reverse proxy
  │
  ▼
Hono server (apps/remix/server)
  ├── /api/v1/*     legacy REST API (ts-rest)
  ├── /api/v2/*     current API (tRPC OpenAPI)
  ├── /api/trpc/*   app's session-aware tRPC calls
  ├── /api/jobs/*   background-job endpoints
  └── /*            React Router web application
        │
        ├── @documenso/lib       business logic and provider selection
        ├── @documenso/auth      authentication support
        ├── @documenso/prisma    PostgreSQL data access and migrations
        ├── @documenso/signing   PDF signature implementations
        ├── @documenso/email     templates and email transport
        └── @documenso/ui        shared interface components
               │
               ├── PostgreSQL database
               ├── file storage (database or S3-compatible service)
               ├── email provider
               ├── signing certificate / cloud signing service
               └── optional queue, webhook, and AI integrations
```

A normal browser request reaches the Hono server in `apps/remix/server/`. The server mounts API handlers and routes remaining requests to the React Router app. Application logic calls shared packages and persists state through Prisma. Work that should happen asynchronously—such as sending email, invoking a webhook, or sealing a completed document—is dispatched through the configured jobs provider and handled by job definitions under `packages/lib/jobs/`.

### Main code paths

- `apps/remix/server/router.ts` mounts the HTTP routes and middleware.
- `apps/remix/server/main.js` starts the production Node server.
- `apps/remix/app/routes/` contains React Router route modules; route folders include authenticated, unauthenticated, and recipient-facing areas.
- `packages/trpc/server/` contains current tRPC and OpenAPI route implementations.
- `packages/api/v1/` contains the maintained-but-deprecated v1 REST API.
- `packages/lib/server-only/`, `client-only/`, and `universal/` separate server-only, browser-only, and shared logic.
- `packages/prisma/schema.prisma` defines the PostgreSQL data model; migrations live under `packages/prisma/migrations/`.

## Repository layout

```text
.
├── apps/
│   ├── remix/             Main signing web app, route modules, Hono server
│   ├── docs/              Documentation site (Next.js/Fumadocs, MDX content)
│   └── openpage-api/      Public analytics API application
├── packages/
│   ├── api/               Legacy REST API contracts and handlers
│   ├── app-tests/         Playwright end-to-end tests
│   ├── auth/              Authentication-related client and server code
│   ├── email/             Email templates, renderer, and transports
│   ├── lib/               Shared business logic, jobs, schemas, utilities
│   ├── prisma/            Prisma schema, client generation, migrations
│   ├── signing/           PDF signing transports and helpers
│   ├── trpc/              tRPC client, React integration, server routers
│   ├── ui/                Shared components and design primitives
│   ├── ee/                Enterprise Edition functionality
│   ├── assets/            Shared static assets
│   ├── tailwind-config/   Shared Tailwind configuration
│   └── tsconfig/          Shared TypeScript configuration
├── docker/
│   ├── Dockerfile         Multi-stage production image for the main app
│   ├── start.sh           Applies Prisma migrations and starts the server
│   └── development/       Local PostgreSQL, mail, Redis, and conversion services
├── scripts/               Repository scripts
├── railway.toml           Railway build configuration (Dockerfile builder)
├── render.yaml            Render deployment blueprint (separate platform option)
├── package.json           npm workspace scripts and root dependencies
├── turbo.json             Turborepo task configuration
└── .env.example           Documented environment variable template
```

## Technology stack

- **Primary language:** TypeScript (the repository also contains MDX documentation, JavaScript configuration, shell scripts, and SQL-related database artifacts).
- **Runtime/package management:** Node.js (the root package requires Node.js 20+ and npm 10+; the checked-in Docker image is based on Node 24 Alpine) and npm workspaces.
- **Web application:** React 19, React Router v7, Vite, and Hono.
- **Data:** PostgreSQL 15-compatible database, Prisma ORM, and Kysely integrations.
- **API:** tRPC for app and current API calls; ts-rest for the deprecated v1 REST API; OpenAPI support for tRPC endpoints.
- **UI:** Tailwind CSS, Radix UI, and shared components in `packages/ui`.
- **PDF:** `@libpdf/core`, PDF.js, and project signing transports.
- **Email and jobs:** React Email/Nodemailer-compatible provider adapters; local, BullMQ/Redis, and Inngest job options are described in the environment configuration and architecture.
- **Build/test:** Turborepo, Vite, Biome, Prisma, and Playwright.

## Document lifecycle

The common signing flow is:

1. **Prepare:** A user creates a document or template and uploads one or more source files. Uploads are handled by the selected storage transport.
2. **Configure:** The sender adds recipients, assigns their roles, places fields on document pages, and chooses relevant delivery, expiry, reminder, or signing-order options.
3. **Send:** The envelope moves from draft to pending. The app persists the workflow and schedules recipient notifications through a job and email provider.
4. **Review and sign:** Recipients access their signing flow, review the document, and complete fields permitted for their role. Recipient status and audit data are recorded.
5. **Finalize:** Once workflow requirements are met, a sealing job invokes the configured signing transport to create a signed PDF. The resulting document is stored using the configured upload provider and the envelope is marked complete.
6. **Notify and audit:** Notifications and configured webhook events can be dispatched. Audit records capture document lifecycle events and relevant actor/request metadata.

Exact workflow rules are implemented in application services and may depend on settings, permissions, recipient authentication, and configured signing capabilities.

## APIs and integrations

### API endpoints

The architecture document describes these server mounts:

- **`/api/v1/*`:** ts-rest REST API. It is marked deprecated but maintained in this codebase; API-token authentication is used.
- **`/api/v2/*` and `/api/v2-beta/*`:** current tRPC-to-OpenAPI endpoints. The route families include document, template, envelope, folder, recipient, and field operations. The architecture lists API-token or session-cookie authentication.
- **`/api/trpc/*`:** internal session-based frontend-to-backend calls.
- **`/api/jobs/*`:** job-related endpoints.

Consult the route source and generated/current API documentation before integrating; endpoint details and schemas can change between versions.

### Provider choices

Provider selection is configuration-driven, so the app can be adapted to a deployment's infrastructure:

| Capability | Options represented in this repository/configuration | Main configuration |
|---|---|---|
| File storage | Database or S3-compatible object storage | `NEXT_PUBLIC_UPLOAD_TRANSPORT` and `NEXT_PRIVATE_UPLOAD_*` |
| PDF signing | Local certificate, Google Cloud HSM; CSC-related settings also appear in `.env.example` | `NEXT_PRIVATE_SIGNING_*` |
| Email | SMTP, SMTP API, Resend, or MailChannels | `NEXT_PRIVATE_SMTP_*` / provider-specific values |
| Background jobs | Local, BullMQ/Redis, or Inngest | `NEXT_PRIVATE_JOBS_PROVIDER` and provider credentials |
| AI | Optional Google Vertex AI configuration | `GOOGLE_VERTEX_*` |
| Billing | Optional Stripe integration | `NEXT_PRIVATE_STRIPE_*` and billing feature flag |
| Authentication | Password-based and optional OAuth/OIDC/passkeys, subject to feature flags and provider setup | `NEXT_PRIVATE_*` auth values and `NEXT_PUBLIC_DISABLE_*` flags |

Not all providers are configured by default. For example, an email transport needs valid provider credentials, and production PDF signing requires a properly configured certificate or signing service. See `.env.example` and the official self-hosting documentation for provider-specific instructions.

## Data and storage

`packages/prisma/schema.prisma` uses PostgreSQL. It models users and sessions, organizations and teams, envelopes, document items, recipients, fields, signatures, audit records, API tokens, webhooks, and related configuration. Prisma migrations are the source of truth for schema updates.

The default upload transport in the example configuration is database-backed. This is convenient for development and small deployments but can increase database size and load. For production volumes, configure durable S3-compatible object storage and confirm its bucket, access policy, region, endpoint, and backup strategy. Do not rely on a container's writable filesystem for persistent documents: application containers can be replaced during deployment or restart.

The database and uploaded files contain sensitive business and personal information. Configure backups, access control, retention, recovery testing, and encryption according to your organization's requirements.

## Security considerations

- **Never publish secrets.** Do not put passwords, API keys, OAuth client secrets, database URLs, private keys, or signing certificates in this README, source code, build arguments, or public issue reports. Set secret values in Railway's service variables or a suitable secret manager.
- **Rotate exposed credentials.** If the sample/demo credentials supplied outside this repository are valid, treat them as compromised because they were shared in a public context. Change the password and revoke any associated sessions or tokens. Do not assume demo credentials are safe for production.
- **Generate unique encryption keys.** Set strong, random `NEXT_PRIVATE_ENCRYPTION_KEY` and `NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY` values (at least 32 characters as indicated by `.env.example`) and keep them stable across restarts and deployments. Losing/changing keys can make previously encrypted data inaccessible.
- **Use a strong auth secret.** Set a private, randomly generated `NEXTAUTH_SECRET`; do not reuse examples or a development secret.
- **Use TLS and a correct public URL.** Configure the app's public URL variables to the externally reachable HTTPS domain so generated links, callbacks, and browser behavior use the right host.
- **Configure real email and signing providers.** Test email delivery and signature validation before production. A server starting successfully does not prove that signing or email is fully configured.
- **Protect admin access and user onboarding.** Disable signup where appropriate and use strong individual accounts, MFA/passkeys where available, and least-privilege team roles.
- **Review network-facing integrations.** Restrict webhook destinations and integration credentials; never enable test-only rate-limit bypasses in production.
- **Keep dependencies and backups maintained.** Apply upstream security updates, monitor service logs, and regularly test database and object-storage restore procedures.

## Run locally

### Prerequisites

- Node.js 20 or later and npm 10 or later (the repository's Docker image uses Node 24).
- Docker Engine and Docker Compose for the development dependencies.
- A local `.env` file with database, URL, authentication, and encryption settings.

### Setup

From the repository root:

```bash
npm ci
cp .env.example .env
```

Edit `.env` before running the application. For the included development Compose file, the PostgreSQL service is exposed on port `54320` with the local development database values shown in `docker/development/compose.yml`. Set both `NEXT_PRIVATE_DATABASE_URL` and `NEXT_PRIVATE_DIRECT_DATABASE_URL` to that local database URL. Set the public and internal app URLs to `http://localhost:3000`, configure a unique local `NEXTAUTH_SECRET` and encryption keys, and set up a local email transport as needed. Do not reuse these development values in production.

Then use the repository's development bootstrap:

```bash
npm run d
```

`npm run d` runs the development setup (`npm run dx`), compiles translations, and starts the Remix app. `npm run dx` installs dependencies, starts the services defined in `docker/development/compose.yml`, applies development migrations, and seeds the development database. The Compose stack includes PostgreSQL, Inbucket for local email inspection, Redis, and Gotenberg for optional DOCX-to-PDF conversion.

To start dependencies and the app in separate steps:

```bash
npm run dx:up
npm run prisma:migrate-dev
npm run prisma:seed
npm run dev
```

The application is served on port 3000 by default. Inbucket's web UI is exposed on port 9000. Stop local services with:

```bash
npm run dx:down
```

`npm run d` and the seed step are development conveniences. Do not run a development seed command against a production database.

## Deploy on Railway

This repository includes `railway.toml`, which tells Railway to use the Docker builder and `/docker/Dockerfile`. The Dockerfile builds the `@documenso/remix` workspace dependency graph and produces a production image. Its startup script (`docker/start.sh`) runs `prisma migrate deploy` and then starts `build/server/main.js` on `0.0.0.0`; Railway should route traffic to the service's configured `$PORT`.

The repository's `railway.toml` specifies the build method, but it does not provision the database, fill in application secrets, or configure every integration. Configure and verify those in your Railway project.

### Railway setup outline

1. **Create a Railway project and connect this GitHub repository.** Select the branch you intend to deploy. Confirm the detected configuration uses the repository's `railway.toml` and Dockerfile.
2. **Add a PostgreSQL service** to the Railway project. Wait until it is healthy and obtain its private connection URL using Railway's service-reference variable mechanism.
3. **Configure the application service variables.** At minimum set:
   - `NEXT_PRIVATE_DATABASE_URL` — PostgreSQL connection URL reachable by the app service.
   - `NEXT_PRIVATE_DIRECT_DATABASE_URL` — direct/non-pooled connection URL suitable for Prisma migrations. It may equal the database URL if Railway does not use a pooler.
   - `NEXTAUTH_SECRET` — strong, unique random value.
   - `NEXT_PRIVATE_ENCRYPTION_KEY` and `NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY` — independent, strong, random values (at least 32 characters).
   - `NEXT_PUBLIC_WEBAPP_URL` — the complete public HTTPS URL Railway assigns or your custom domain uses.
   - `NEXT_PRIVATE_INTERNAL_WEBAPP_URL` — the app's internal URL for server-side self-requests, if needed by the configured features. Ensure it resolves from the service; do not copy `localhost` from a local example.
   - `PORT` — use Railway's injected port configuration; the server must bind to `0.0.0.0` and the port expected by Railway.
4. **Configure optional integrations.** Add production SMTP/API email credentials, durable object storage, signing certificate/HSM/CSC configuration, OAuth credentials and callback URLs, and any queue/Redis, webhook, billing, or Vertex AI settings that the enabled features require. Use Railway's encrypted variables rather than committing values.
5. **Set the domain and auth callback URLs.** Generate a Railway domain or attach a custom domain, enforce HTTPS, then update public URL variables and third-party OAuth callback/allowed-origin settings to match that exact hostname.
6. **Deploy and inspect logs.** Verify image build completion, Prisma migrations, server startup, and Railway health status. Confirm the public sign-in page loads and test key workflows with non-production documents and recipients.
7. **Back up and monitor.** Configure database backups and retention, object-storage durability, service health alerts, and a tested restore process before handling real documents.

### Railway operational notes

- The Docker startup script runs database migrations before starting the web server. A migration failure prevents normal startup; inspect deploy logs and resolve database connectivity or migration errors before retrying.
- For a pooled database URL, use an appropriate direct connection URL for migrations when required. Prisma's `directUrl` is configured from `NEXT_PRIVATE_DIRECT_DATABASE_URL` in the schema.
- Use Railway's injected runtime port and ensure health checks target a real endpoint. The app's documented health check is `/api/health`; verify the deployed build responds successfully at the platform's configured health-check path.
- Keep the same encryption keys across redeployments. Store them securely and maintain controlled backups; replacing them can break access to previously encrypted values.
- Do not use database-backed document uploads as a substitute for a backup strategy. For larger or business-critical deployments, configure an S3-compatible store and its own lifecycle/backup policies.
- The repository's `render.yaml` is for Render, not Railway, and should not be used as the Railway configuration source.

## Global availability and scaling

A Railway public domain makes the application reachable over the internet; it does **not** by itself mean the app is deployed in every country or runs active-active in multiple regions. A Railway deployment normally runs in the region(s) explicitly selected for its services. Actual latency, availability, data residency, and failover depend on Railway service placement, the database and storage regions, and your own deployment topology.

For a globally used production service:

- Choose an app region near the primary database and object-storage region to reduce server-to-database latency. Place all components where the platform supports private connectivity and your data-residency obligations permit.
- Use a CDN or edge cache only for cacheable static assets. Do not cache authenticated pages, recipient-specific signing links, private API responses, or confidential documents as public content.
- Treat PostgreSQL as stateful and plan backups, point-in-time recovery if offered by the platform, and a tested restore/failover procedure. A second web instance is not high availability if it shares a single unavailable database.
- Use durable object storage for document bytes and configure it for the required redundancy, lifecycle, and access controls.
- Before horizontal scaling, verify how the selected background-job provider coordinates work across replicas. Use a shared/managed queue provider such as BullMQ/Redis or Inngest where appropriate; do not assume every worker is safely coordinated merely because the web service has multiple replicas.
- Keep secrets, domain/callback settings, and storage policies consistent across environments. Use separate development, staging, and production databases and credentials.
- Load test with representative document sizes and concurrency, monitor app/database/queue metrics, and validate recovery before describing the service as globally redundant.

The provided Railway URL is a working-style public URL supplied for this deployment. This repository configuration alone does not establish its current uptime, region, redundancy, production readiness, or which optional providers are active; check the Railway project settings and live service health for those facts.

## Configuration reference

The complete variable list and comments are in [`.env.example`](.env.example). Important groups include:

| Group | Common variables | Purpose |
|---|---|---|
| Application URLs | `NEXT_PUBLIC_WEBAPP_URL`, `NEXT_PRIVATE_INTERNAL_WEBAPP_URL`, `PORT` | Public links, server-side requests, listening port |
| Authentication | `NEXTAUTH_SECRET`, `NEXT_PRIVATE_GOOGLE_*`, `NEXT_PRIVATE_MICROSOFT_*`, `NEXT_PRIVATE_OIDC_*` | Session/auth security and optional identity providers |
| Database | `NEXT_PRIVATE_DATABASE_URL`, `NEXT_PRIVATE_DIRECT_DATABASE_URL` | PostgreSQL pooled/runtime and direct/migration connectivity |
| Encryption | `NEXT_PRIVATE_ENCRYPTION_KEY`, `NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY` | Application-level encryption keys |
| Storage | `NEXT_PUBLIC_UPLOAD_TRANSPORT`, `NEXT_PRIVATE_UPLOAD_*` | Database or S3-compatible document storage |
| Signing | `NEXT_PRIVATE_SIGNING_TRANSPORT`, `NEXT_PRIVATE_SIGNING_*` | Local, cloud-HSM, or CSC signing setup and timestamping |
| Email | `NEXT_PRIVATE_SMTP_TRANSPORT`, `NEXT_PRIVATE_SMTP_*`, `NEXT_PRIVATE_RESEND_API_KEY` | Transactional email provider and sender identity |
| Jobs | `NEXT_PRIVATE_JOBS_PROVIDER`, `NEXT_PRIVATE_REDIS_URL`, `NEXT_PRIVATE_INNGEST_EVENT_KEY` | Background job execution |
| AI | `GOOGLE_VERTEX_PROJECT_ID`, `GOOGLE_VERTEX_LOCATION`, `GOOGLE_VERTEX_API_KEY` | Optional Vertex AI integration |
| Billing/telemetry | `NEXT_PRIVATE_STRIPE_*`, `NEXT_PUBLIC_FEATURE_BILLING_ENABLED`, `NEXT_PUBLIC_POSTHOG_KEY` | Optional billing and analytics/feature configuration |
| Feature controls | `NEXT_PUBLIC_DISABLE_*`, `NEXT_PRIVATE_ALLOWED_SIGNUP_DOMAINS` | Sign-in/sign-up and feature policy switches |

Only configure variables for features you intend to use. Treat all `NEXT_PRIVATE_*` values and provider credentials as server-side secrets. Public-prefixed variables may be included in client configuration; never put secrets in them.

## Useful commands

Run commands from the repository root unless noted otherwise.

| Command | Purpose |
|---|---|
| `npm ci` | Install the exact dependencies from `package-lock.json` |
| `npm run dev` | Compile translations and start the Remix app in development |
| `npm run d` | Set up local dependencies/database and start the app |
| `npm run dx:up` / `npm run dx:down` | Start/stop development Docker services |
| `npm run prisma:migrate-dev` | Apply development Prisma migrations |
| `npm run prisma:seed` | Seed the development database |
| `npm run prisma:studio` | Open Prisma Studio for the configured local database |
| `npm run typecheck -w @documenso/remix` | Generate React Router types and type-check the app |
| `npm run lint` | Run Biome checks across the repository |
| `npm run format` | Format code with Biome |
| `npm run test:e2e` | Run the Playwright end-to-end suite |
| `npm run build` | Build all workspace packages (long-running; run when needed for release/deployment verification) |

Always run Playwright with `CI=true` in headless CI environments. For an individual E2E spec against a running server, use the repository's documented pattern, for example:

```bash
CI=true npm run test:dev -w @documenso/app-tests -- e2e/path/to/file.spec.ts
```

## Testing and quality checks

Use the narrowest relevant checks while developing. The repository's agent guidance recommends `npm run typecheck -w @documenso/remix` for app type checking instead of a full build, and requires `CI=true` for Playwright. E2E tests are under `packages/app-tests`; they exercise the app against a real server/database rather than relying on mocked service behavior.

Before deploying a change, run appropriate type/lint/tests, build the deployment image through the normal CI/deployment pipeline, and check migration and startup logs in a staging environment.

## Troubleshooting

### App does not start after deploy

Check Railway deploy logs for Prisma migration errors, missing environment variables, or failed server startup. Confirm the app can reach PostgreSQL and that `NEXT_PRIVATE_DIRECT_DATABASE_URL` is suitable for migrations.

### Sign-in, links, or OAuth callbacks use the wrong host

Set `NEXT_PUBLIC_WEBAPP_URL` to the exact public HTTPS address. Update OAuth provider redirect/callback URLs to match it, then redeploy if the app needs the new values at runtime/build time.

### Emails are not arriving

Verify the selected `NEXT_PRIVATE_SMTP_TRANSPORT`, provider credentials, sender address/domain verification, and provider logs. Test in staging before inviting real signers.

### Signing is unavailable or PDF signatures fail validation

Confirm the selected signing transport and certificate/key material are configured correctly. Review [`SIGNING.md`](SIGNING.md) and the official signing-certificate documentation linked there. A running web app does not guarantee a signing certificate is installed or valid.

### Uploaded documents disappear or database grows rapidly

Check `NEXT_PUBLIC_UPLOAD_TRANSPORT`. If using database-backed storage, document bytes are stored in the database. Configure persistent S3-compatible storage for production scale and retain independent backups.

### Health check fails

Confirm the service binds to `0.0.0.0`, uses Railway's runtime port, and responds at `/api/health`. Review application logs and Railway's health-check configuration.

## Contributing

- Read [`AGENTS.md`](AGENTS.md) for repository conventions, test guidance, and code style.
- Read [`ARCHITECTURE.md`](ARCHITECTURE.md) for deeper codebase structure and API/job/provider diagrams.
- Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a change.
- Keep secrets and real customer documents out of commits, test fixtures, and issue attachments.
- For a feature request, bug report, or security issue, use the appropriate repository process and avoid disclosing vulnerabilities publicly before coordinated remediation.

## License and upstream project

This codebase is based on [Documenso](https://github.com/documenso/documenso), an open-source document-signing project. Review the repository's [`LICENSE`](LICENSE), [`CLA.md`](CLA.md), and upstream terms before redistributing or deploying modified code. Product branding, enterprise features, and third-party provider terms may have additional requirements.

Additional references:

- [Documenso documentation](https://docs.documenso.com/)
- [Self-hosting guides](https://docs.documenso.com/developers/self-hosting)
- [Repository architecture](ARCHITECTURE.md)
- [Environment template](.env.example)
- [Signing certificate guide](SIGNING.md)
