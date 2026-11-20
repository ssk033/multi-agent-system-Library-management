# Project documentation

**Autonomous Multi-Agent Library Management System**

Next.js, LangGraph, PostgreSQL, and pgvector. Generative AI laboratory project.

This is the operating manual. Diagrams and table-level notes also live in `ARCHITECTURE.md`, `AGENT_WORKFLOWS.md`, `DATABASE_SCHEMA.md`, `API_DOCUMENTATION.md`, and `PROJECT_REPORT.md`.

## 1. What was wrong with sign-in

The login inputs were not broken. The form submitted, and the server log recorded `POST /login`. Two later steps made it look dead.

1. No database was configured. `DATABASE_URL` was absent, so Auth.js threw `DATABASE_URL is not set` inside the credentials callback. That exception was reported as an authentication failure, and an earlier version of the form left the button on "Signing in..." when the server action rejected. The seeded emails were only text on the page. They had never been inserted, because the seed script had not been run.
2. The dev server that was already running had started before `.env.local` existed. Next.js reads environment files when the process starts. Creating the file later does not attach the database to that process.

The form now does three things. Clicking a seeded account fills the email and password. A missing database returns the message "The database is not connected" and re-enables the button. After the database is seeded, those same accounts sign in.

What was verified after the fix:

- Local Postgres 16 with pgvector is running in Docker as `library-postgres`.
- `npm run db:setup`, `npm run db:push`, and `npm run db:seed` completed.
- `student@library.edu` / `Student@123` reached `/overview` as Aarav Sharma, with 1 issued book, ₹0.00 fines, and 22 catalog titles.
- `/books` listed the seeded textbooks and the category filter.

Embeddings were not created. `GEMINI_API_KEY` is empty, and the seed refuses to invent vectors. Keyword search works. Semantic search returns HTTP 503 until a real key is added and the seed is run again.

## 2. Purpose

Students ask for books, loans, fines, and purchases in ordinary language. A supervisor agent chooses a specialist. The specialist may only call a fixed tool. The tool calls a service that uses Drizzle. Circulation changes are one database transaction with row locks. A purchase stays `PENDING` until a librarian approves it. The model cannot run SQL and cannot approve spending.

## 3. How to run it

From `autonomous-library`:

```powershell
npm install --legacy-peer-deps
npm run dev
```

The app is at http://localhost:3000. The current `.env.local` points at the local container:

```text
DATABASE_URL=postgresql://library:library@localhost:5432/library
```

That file is gitignored. The container was started with:

```powershell
docker run -d --name library-postgres -e POSTGRES_USER=library -e POSTGRES_PASSWORD=library -e POSTGRES_DB=library -p 5432:5432 pgvector/pgvector:pg16
```

If Docker Desktop is not running, start it before `npm run dev`. Recreate the data with:

```powershell
npm run db:setup
npm run db:push
npm run db:seed
```

`db:seed` truncates the library tables. Do not point it at a database you need to keep. It refuses `NODE_ENV=production` unless `SEED_ALLOW_PRODUCTION=true`.

For Neon, replace `DATABASE_URL` with the pooled Neon string (`sslmode=require`) and restart the dev server. Hosts containing `neon.tech` use the Neon WebSocket driver. Every other host, including this Docker database, uses `node-postgres`. Both paths support transactions and `SELECT … FOR UPDATE`.

Add `GEMINI_API_KEY` to `.env.local` and run `npm run db:seed` again when you want real embeddings and model routing. Model names stay in `GEMINI_MODEL` and `GEMINI_EMBEDDING_MODEL`. The defaults are `gemini-2.5-flash` and `text-embedding-004` (768 dimensions).

## 4. Seeded accounts

Click a row on the login page to fill the form, then press Sign in.

| Role | Email | Password | What you should see |
| --- | --- | --- | --- |
| Student | `student@library.edu` | `Student@123` | Aarav Sharma. Assistant, catalog, own loans, policies. One active loan of *Operating System Concepts*. |
| Librarian | `librarian@library.edu` | `Librarian@123` | Catalog editing, all loans, returns, students, acquisitions, analytics. |
| Admin | `admin@library.edu` | `Admin@123` | Librarian access plus settings, audit, users, and agent activity. |

The other students are `student02@library.edu` through `student15@library.edu`, all with `Student@123`.

Useful records already in the database:

| Person or book | State |
| --- | --- |
| Kabir, `student03@library.edu` | Three held books. A new loan is refused. |
| Meera, `student04@library.edu` | ₹20 outstanding fine from a late return. New loans are blocked. |
| Tara, `student15@library.edu` | Account status `INACTIVE`. Sign-in is refused. |
| Kurose and Ross, ISBN `9780136681557` | Zero available copies. Both copies are on loan, one of them overdue. |
| Acquisition queue | *Reinforcement Learning* by Sutton is pending. An extra Kurose request is pending. One request is approved and one is rejected. |

## 5. Pages

| Path | Who | Data source |
| --- | --- | --- |
| `/` | Public | Landing page. |
| `/login` | Public | Credentials form. |
| `/overview` | Signed in | Counts from the database. Students see only their own loans and fines. |
| `/assistant` | Signed in | Streams the LangGraph turn and stores the chat. |
| `/books` | Signed in | Keyword search. Semantic mode needs Gemini. Staff can add, edit, and delete. Delete is refused when a loan still references the book. |
| `/books/[id]` | Signed in | One title and related titles. |
| `/students` | Librarian, admin | Registration and profiles. |
| `/loans` | Signed in | Students see their own rows. Staff see active loans and can issue. |
| `/returns` | Librarian, admin | Return and renew with a confirmation dialog. |
| `/acquisitions` | Librarian, admin | Approve, reject, or catalog. The decision is audited. |
| `/agents` | Admin | Rows written after real assistant turns. Empty until someone uses the assistant. |
| `/analytics` | Librarian, admin | Circulation, categories, borrowers, acquisition trend. |
| `/policies` | Signed in | The five stored policies. Admins can edit them. |
| `/settings` | Admin | Limits, fines, users, and the audit list. |

The sidebar hides routes the role cannot open. `src/proxy.ts` also blocks the URL, and each API handler checks the permission again.

## 6. Multi-agent flow

```mermaid
flowchart TD
  user[Signed-in user] --> supervisor[Supervisor]
  supervisor --> discovery[Discovery]
  supervisor --> circulation[Circulation]
  supervisor --> acquisition[Acquisition]
  discovery --> supervisor
  circulation --> supervisor
  acquisition --> supervisor
  supervisor --> confirm[Confirmation card]
  confirm --> commit[Commit node]
  commit --> database[(PostgreSQL transaction)]
  supervisor --> answer[Final answer]
```

Shared state holds the user text, traces, observations, completed agents, book cards, and an optional confirmation. The supervisor may consult Gemini for the next agent. `resolveRoute` accepts that choice only when it is still in the deterministic plan and the iteration count is under six. If the key is missing or the model errors, the trace says the deterministic plan was used.

Example plans:

- "Find books about artificial intelligence" goes to discovery.
- "I want to borrow a book on machine learning" goes to discovery, then circulation, then a confirmation. Nothing is written until the user confirms.
- "The book is unavailable. Can the library purchase it?" goes to discovery, then acquisition. The row stays `PENDING`.

Write tools return a confirmation object instead of writing when the server confirmation does not match the book, loan, or title. The commit node is what calls `issueBook`, `returnBook`, `renewBook`, or `createAcquisitionRequest`. Approve and reject tools exist for staff and always refuse in chat, because the chat runner never sets `explicitLibrarianAction`.

Traces show agent, tool, database, and approval events. They do not include hidden model reasoning. The assistant stores them on the chat message. The admin monitor aggregates `agent_execution_logs` after the turn.

## 7. Circulation rules

Defaults live in `library_settings` and can be changed by an administrator:

- 3 held books, counting active and overdue loans
- 14-day loan
- ₹5 per day, and any partial day counts as one day
- 1 renewal, which extends the current due date
- no new loan while `fines_due` is greater than zero
- one held copy of a title per student

Issue locks the student and the book, rechecks eligibility, inserts the loan, and decrements `available_copies` in one transaction. Return locks the loan, stores the fine, restores a copy, and adds the fine to the student. A partial unique index rejects a second held loan of the same book.

## 8. Retrieval

Book descriptions and policy text are embedded only from the Gemini embedding API. A SHA-256 content hash skips unchanged text. Search uses cosine distance and drops rows below `SIMILARITY_THRESHOLD` (books, default 0.55) or `POLICY_SIMILARITY_THRESHOLD` (policies, default 0.4). The policy tool also returns the live settings. Those numbers, not the prose, are what circulation enforces. Dewey numbers are labeled as suggestions for a librarian to verify.

Without embeddings, discovery uses keyword search over title, author, ISBN, and description and labels the match as keyword search.

## 9. Database

`users` stores the login, bcrypt password, and role. `students` stores the roll number, fines, and loan count, and points at `users`. Librarians and administrators do not have a student row. Loans, books, acquisitions, policies, settings, audit logs, notifications, agent logs, and chat messages are separate tables. Column lists are in `DATABASE_SCHEMA.md`.

## 10. API

JSON responses are `{ "ok": true, "data": ... }` or `{ "ok": false, "error": "..." }`. `POST /api/chat` is server-sent events with `trace`, `token`, `books`, `confirmation`, and `done`. The route list is in `API_DOCUMENTATION.md`.

`GET /api/health` is public and reports whether the database answers and whether a Gemini key is present. It does not return either secret.

## 11. Security

- `DATABASE_URL` and `GEMINI_API_KEY` are read on the server.
- Zod validates request bodies.
- Student tools ignore a roll number and use the session student id.
- Students cannot read another student's loans, approve purchases, or open settings.
- Login allows 8 attempts per email each 10 minutes. Chat allows 30 requests per user and IP each minute. Both limiters are in memory.
- User text placed in a prompt is fenced. Unexpected server errors return a generic message.

## 12. Tests

```powershell
npm run typecheck
npm run lint
npm test
```

Unit tests cover the fine formula, borrowing refusals, route plans, the permission matrix, and a mutex where only one of eight borrowers receives the last copy. `tests/integration/database.integration.test.ts` runs when `DATABASE_URL` is set and checks concurrent issue, return, renewal, and approval against the real database.

## 13. Current limits

- The local database password is a development credential for the Docker container. Replace `DATABASE_URL` with Neon before deployment, then run setup, push, and seed there.
- There are no embeddings until a Gemini key is supplied.
- The LangGraph checkpointer is process memory. A confirmed write can still finish from the signed confirmation payload after a restart.
- Fines are a balance. There is no payment step.
- Agent activity stays empty until someone completes an assistant turn.
