# Autonomous Multi-Agent Library Management System

Students talk to the library in ordinary language. A LangGraph supervisor decides which specialist should act, those specialists call fixed tools, and the tools change Neon PostgreSQL only through validated service functions. A librarian still has to approve any request to buy a book.

This repository is a Generative AI laboratory project. It is a Next.js application with role-based access, circulation transactions, retrieval-augmented search, and a dashboard that shows the agent handoff as it happens.

## Problem statement

A conventional library desk repeats the same work: find a title, check whether a copy is free, decide whether the student may borrow it, calculate a fine, and record a purchase request when the shelf is empty. Doing that from a single chatbot would hide the decision and would let the model invent SQL or policy. The system needs separate responsibilities, shared state, and a person in the loop before money is committed.

## Objectives

- Accept natural-language library requests and route them through a supervisor.
- Search the catalog with embeddings stored in pgvector, and fall back to keyword search when embeddings are absent.
- Answer policy questions from stored policy text and the live settings row, rather than from the model's memory.
- Issue, return, and renew books in one database transaction with row locks.
- Open acquisition requests as `PENDING` and require an authenticated librarian to approve or reject them.
- Show execution traces, catalog, loans, students, analytics, and settings in a role-aware dashboard.

## Proposed solution

The browser talks to Next.js route handlers. The assistant route streams a LangGraph run. The graph has a supervisor and three workers: discovery, circulation, and acquisition. Workers do not write SQL. They call tools in `src/agents/tools.ts`, and those tools call services that use Drizzle. Consequential writes wait for an explicit confirmation from the signed-in user. Purchase approval is not a tool the chat can complete. It is a dashboard action tied to the librarian's session.

```mermaid
flowchart TD
  student[Student or librarian] --> ui[Next.js dashboard]
  ui --> api[API routes and server actions]
  api --> graph[LangGraph supervisor]
  graph --> discovery[Discovery agent]
  graph --> circulation[Circulation agent]
  graph --> acquisition[Acquisition agent]
  discovery --> rag[Embeddings and pgvector]
  circulation --> tx[Locked PostgreSQL transaction]
  acquisition --> pending[Pending acquisition request]
  pending --> librarian[Librarian approval]
  rag --> neon[(Neon PostgreSQL)]
  tx --> neon
  librarian --> neon
```

## Technology stack

| Area | Choice |
| --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript |
| Interface | Tailwind CSS 4, local UI primitives, Lucide, Recharts, Framer Motion |
| Agents | LangGraph.js, LangChain.js, Google Gemini |
| Data | Neon PostgreSQL, pgvector, Drizzle ORM |
| Auth | Auth.js with credentials and JWT sessions |
| Tests | Vitest |

Model names are read from the environment. The defaults are `gemini-3.5-flash` for chat and `gemini-embedding-001` for embeddings. Embeddings are requested at 768 dimensions. `gemini-2.5-flash` and `gemini-2.0-flash` are retired for new API keys, so the server maps those two names to `gemini-3.5-flash`. Confirm the names in Google AI Studio before a demo, because availability changes.

## Multi-agent architecture

Shared graph state carries the user text, messages, traces, observations, completed agents, book cards, and an optional confirmation. The supervisor classifies the request. If `GEMINI_API_KEY` is missing or the model call fails, it uses the deterministic planner in `src/lib/routing.ts` and the trace says so. It does not pretend the model answered.

Typical paths:

- "Find books about artificial intelligence" goes supervisor, discovery, supervisor, final response.
- "I want to borrow a book on machine learning" goes supervisor, discovery, circulation. Circulation prepares a confirmation. After the user confirms, the commit node issues the book.
- "The book is unavailable. Can the library purchase it?" goes supervisor, discovery, acquisition. The request stays pending.

The graph stops after six specialist iterations. Traces record agent starts, handoffs, tool names, and database commits. They do not include hidden model reasoning.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/AGENT_WORKFLOWS.md](docs/AGENT_WORKFLOWS.md).

## RAG

Book descriptions and the five library policies are embedded only when a Gemini key is present. The seed script stores the vector returned by the embedding API. It never inserts a fabricated vector. A SHA-256 content hash skips unchanged text. Search uses cosine distance (`<=>`) and a similarity threshold (`0.55` for books, `0.4` for policies, both configurable). If embeddings are missing, discovery uses keyword search and labels that result as keyword search.

Numeric borrowing rules are enforced by `library_settings`, not by the prose the model retrieves. The policy tool returns both the matching passages and the current settings.

## Database

`users` holds the login and role. `students` holds the library profile and points at `users` through `user_id`. Loans, books, acquisitions, policies, settings, audit logs, notifications, agent logs, and chat history are separate tables. Circulation uses `SELECT … FOR UPDATE` inside a transaction. A partial unique index allows only one held loan per student per book.

Setup and column notes are in [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md).

## API

Authenticated JSON routes live under `src/app/api`. The assistant `POST /api/chat` response is server-sent events. Route details are in [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

## Why sign-in fails before the database exists

The login form only checks email and password after it can read the `users` table. The seeded addresses are not built into the application. They are inserted by `npm run db:seed`. If `DATABASE_URL` is missing, the form stays editable and reports that the database is not connected. Clicking a seeded-account row fills the email and password. It does not create the account.

## Installation

Requirements: Node.js 20 or newer. A Gemini API key is required for live model calls and embeddings. The database can be Neon, or a local Postgres 16 container with pgvector.

```powershell
cd autonomous-library
npm install --legacy-peer-deps
Copy-Item .env.example .env.local
```

Edit `.env.local` and set real values. Do not commit that file.

Generate `AUTH_SECRET` with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Local database used for development

Docker Desktop can run the same schema without a Neon account:

```powershell
docker run -d --name library-postgres -e POSTGRES_USER=library -e POSTGRES_PASSWORD=library -e POSTGRES_DB=library -p 5432:5432 pgvector/pgvector:pg16
```

Set this in `.env.local`:

```text
DATABASE_URL=postgresql://library:library@localhost:5432/library
```

The server uses the Neon driver when the host contains `neon.tech` and `node-postgres` for every other host, including this container. Restart `npm run dev` after creating `.env.local`. Next.js reads that file only when the process starts.

The seed writes embeddings only when `GEMINI_API_KEY` is set. Without a key, discovery stays on keyword search. Restart `npm run dev` after any change to `.env.local`.

## Neon setup

1. Create a Neon project and copy the pooled connection string into `DATABASE_URL`. Include `sslmode=require`.
2. Enable pgvector and create the HNSW indexes:

```powershell
npm run db:setup
```

3. Push the Drizzle schema:

```powershell
npm run db:push
```

`db:setup` runs `CREATE EXTENSION IF NOT EXISTS vector` and the statements in `drizzle/manual/001_vector_indexes.sql`. The seed script also attempts the indexes after the rows exist.

## Gemini configuration

Set `GEMINI_API_KEY`, `GEMINI_MODEL`, and `GEMINI_EMBEDDING_MODEL`. Keep `EMBEDDING_DIMENSIONS=768` unless you also change the `vector(768)` column and rebuild every embedding. A dimension mismatch throws instead of writing a bad vector. The embedding call uses the Gemini `embedContent` API with `outputDimensionality`, because the LangChain embedding client does not pass that parameter and `gemini-embedding-001` otherwise returns 3072 values.

Without a key, or when the configured chat model returns an error, the supervisor and specialists still call the real database tools through the deterministic plan. The trace says the plan was used. Semantic search and policy RAG stay on the keyword path until embeddings exist.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon connection string. Server only. |
| `GEMINI_API_KEY` | Google AI Studio key. Server only. |
| `GEMINI_MODEL` | Chat and tool-calling model. Default `gemini-3.5-flash`. |
| `GEMINI_EMBEDDING_MODEL` | Embedding model. Default `gemini-embedding-001`. |
| `EMBEDDING_DIMENSIONS` | Expected vector size. Default `768`. |
| `AUTH_SECRET` | Auth.js JWT secret. |
| `AUTH_URL` | Public origin, for example `http://localhost:3000`. |
| `NEXTAUTH_URL` | Same origin, kept for Auth.js compatibility. |
| `SIMILARITY_THRESHOLD` | Minimum book cosine similarity. Default `0.55`. |
| `POLICY_SIMILARITY_THRESHOLD` | Minimum policy similarity. Default `0.4`. |
| `SEMANTIC_RESULT_LIMIT` | Maximum semantic hits. Default `5`. |
| `SEED_ALLOW_PRODUCTION` | Must be `true` before seed will wipe a production database. Default `false`. |
| `DEFAULT_MAX_LOANS` | Seed default for the borrowing limit. |
| `DEFAULT_LOAN_DURATION_DAYS` | Seed default loan length. |
| `DEFAULT_FINE_PER_DAY` | Seed default fine in rupees. |

## Migrations and seed data

```powershell
npm run db:setup
npm run db:push
npm run db:seed
```

`db:generate` writes a Drizzle SQL migration when you change `src/db/schema.ts`. `db:push` applies the current schema directly, which is the path used in development.

The seed is destructive. It truncates library tables and reloads them. It refuses to run when `NODE_ENV=production` unless `SEED_ALLOW_PRODUCTION=true`.

The development seed contains:

- 34 engineering titles across artificial intelligence, machine learning, systems, databases, networks, security, mathematics, and software practice.
- 25 students. `student15@library.edu` (Tara) is inactive.
- 10 loans, including active, overdue, and returned rows. Kabir (`student03`) is at the 3-book limit. Meera has a ₹20 fine. Kurose and Ross (`9780136681557`) has zero available copies.
- 5 policies.
- 4 acquisition requests: two pending, one approved, one rejected.
- Embeddings only when `GEMINI_API_KEY` is set.

Development accounts created by the seed:

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@library.edu` | `Student@123` |
| Librarian | `librarian@library.edu` | `Librarian@123` |
| Admin | `admin@library.edu` | `Admin@123` |

Other students use `student02@library.edu` through `student25@library.edu` with the password `Student@123`.

## Running the application

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in, then use **AI Library Assistant** or **Book Catalogue**. Suggested prompts are on the assistant page. A student can also press **Borrow** on an available title; the same confirmation and loan rules apply. Returning, renewing, and acquisition requests open a confirmation dialog before any write.

`npm run db:seed` replaces every user id. A browser that still holds the previous JWT is sent back to the login page. Sign in again after a reseed. The overview is one database statement, cached for about 12 seconds, so sidebar changes do not repeat that work on every click.

`npm run build` and `npm start` run the production server.

## Testing

```powershell
npm run typecheck
npm run lint
npm test
```

Unit tests cover fine calculation, borrowing limits, copy decrement, supervisor routing, role permissions, and a mutex that lets only one of eight parallel borrowers take the last copy. The database integration file runs only when `DATABASE_URL` is set. It issues the last copy concurrently, returns a book, renews a loan, and approves an acquisition.

Latest local run, without Neon credentials:

- `tsc --noEmit` passed.
- `eslint src tests --max-warnings 0` passed.
- Vitest: 22 passed, 1 skipped. The skipped test is `tests/integration/database.integration.test.ts`.

## Deployment

- Import the repository into Vercel. Set the same environment variables. Do not set `SEED_ALLOW_PRODUCTION` on Vercel.
- Create the Neon database, run `npm run db:setup`, `npm run db:push`, and, for a first demo, `npm run db:seed` from a trusted machine.
- Point `AUTH_URL` and `NEXTAUTH_URL` at the Vercel origin.
- Rebuild embeddings from **Settings** is not required after a normal seed. `POST /api/books/embeddings` rebuilds missing vectors for an administrator if descriptions change later.

## Roles

Students can use the assistant, search the catalog, borrow an available copy, and return or renew their own loans. Librarians manage inventory, loans, students, acquisitions, and analytics. Administrators also manage users, policies, settings, audit logs, and the agent monitor. `src/proxy.ts` blocks pages and API prefixes. Each route handler checks the permission again. `GET /api/session` checks that the JWT user still exists after a reseed.

## Documentation

- [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md) is the full project manual, including the sign-in failure, local database, agents, schema, and demo script.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/AGENT_WORKFLOWS.md](docs/AGENT_WORKFLOWS.md)
- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)
- [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
- [docs/PROJECT_REPORT.md](docs/PROJECT_REPORT.md)

## Future scope

- Move the LangGraph checkpointer from process memory to a durable store so a confirmation can resume after a server restart.
- Add payment recording so fines can be cleared inside the product.
- Add a librarian review step before an AI-suggested Dewey number is stored on a new catalog row.
- Add load tests against Neon for the last-copy lock, beyond the local mutex test and the optional integration test.

## Verification

With Neon and a Gemini key configured, `student@library.edu` opens the overview as Aarav Sharma. The seeded catalog has 34 titles. Aarav's active loan is *Operating System Concepts*. Students borrow from the catalogue with **Borrow**, and return or renew from **Active Loans**. Semantic search uses the stored 768-dimension embeddings. If the chat model is unavailable, the same tools still run from the deterministic plan and the trace says so.
