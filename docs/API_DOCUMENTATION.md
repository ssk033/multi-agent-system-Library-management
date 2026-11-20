# API documentation

All JSON responses use `{ "ok": true, "data": ... }` or `{ "ok": false, "error": "..." }`. Status codes are 200, 201, 400, 401, 403, 404, 409, 429, or 500. Bodies are validated with Zod. The session comes from the Auth.js cookie. Callers cannot pass a role in the body.

`GET /api/health` is public. It reports whether `DATABASE_URL` answers `select 1` and whether `GEMINI_API_KEY` is set. It does not return either secret.

`GET` and `POST /api/auth/*` are the Auth.js credentials endpoints.

## Assistant

| Method | Path | Permission | Behavior |
| --- | --- | --- | --- |
| GET | `/api/chat` | assistant | List the caller's sessions. `?sessionId=` returns that session's messages. |
| POST | `/api/chat` | assistant | Run one graph turn. Response is `text/event-stream`. |

POST body:

```json
{
  "message": "Find three books on machine learning",
  "sessionId": "optional-uuid",
  "bookId": "optional-uuid",
  "turnId": "optional-client-turn-id",
  "resume": false,
  "confirmation": null
}
```

`confirmation` is `{ "id", "action", "message", "data", "confirmed" }` when the user accepts or declines a card. Actions are `issue_book`, `return_book`, `renew_book`, and `create_acquisition`.

SSE payloads:

| type | Meaning |
| --- | --- |
| `trace` | Agent, tool, database, or approval event |
| `token` | A piece of the final answer |
| `books` | Book cards for the UI |
| `confirmation` | A write is waiting for the user |
| `done` | Session id and final text |
| `error` | A safe error string |

More than 30 chat posts per user and IP in a minute return 429.

## Books

| Method | Path | Permission | Behavior |
| --- | --- | --- | --- |
| GET | `/api/books` | catalog.read | Query `q`, `author`, `isbn`, `category`, `availability`, `mode=semantic`. `categories=1` returns category names. Semantic mode returns 503 when `GEMINI_API_KEY` is missing. |
| POST | `/api/books` | catalog.write | Create a book. Embeds the description when Gemini is configured. |
| GET | `/api/books/:id` | catalog.read | One book. `?similar=1` adds related titles. |
| PATCH | `/api/books/:id` | catalog.write | Update fields. Re-embeds when the description hash changes. |
| DELETE | `/api/books/:id` | catalog.write | Delete the book. Returns 409 when any loan row still references it. |
| POST | `/api/books/embeddings` | settings | Rebuild missing or stale embeddings. Admin only. |

Semantic mode returns 503 when the embedding API is not configured. The catalog screen keeps keyword search available.

## Students

| Method | Path | Permission | Behavior |
| --- | --- | --- | --- |
| GET | `/api/students` | students.read | All student profiles. |
| POST | `/api/students` | students.write | Create a user with role `STUDENT` and a profile. |
| GET | `/api/students/:id` | students.read | One profile. |
| PATCH | `/api/students/:id` | students.write | Status, department, semester, and name. |

## Loans

| Method | Path | Who | Behavior |
| --- | --- | --- | --- |
| GET | `/api/loans` | own loans, or all loans for staff | Optional `status=HELD` or a loan status. Students only receive their rows. |
| POST | `/api/loans/issue` | student or staff with `loans.manage` | Body `{ "bookId", "rollNo?" }`. Students cannot set the borrower. |
| POST | `/api/loans/return` | owner or staff | Body `{ "loanId" }`. |
| POST | `/api/loans/renew` | owner or staff | Body `{ "loanId" }`. |

These three POSTs are the direct dashboard path. The assistant uses the same service functions after confirmation. A conflict such as zero copies or a duplicate held title returns 409.

## Acquisitions

| Method | Path | Permission | Behavior |
| --- | --- | --- | --- |
| GET | `/api/acquisitions` | acquisitions.read | Optional `status`. |
| POST | `/api/acquisitions` | assistant | Create or reuse a pending request. |
| POST | `/api/acquisitions/:id/approve` | acquisitions.decide | Body `{ "comment" }`. |
| POST | `/api/acquisitions/:id/reject` | acquisitions.decide | Body `{ "comment" }` required. |
| POST | `/api/acquisitions/:id/catalog` | catalog.write | Turn an approved request into a book. |

## Analytics, agents, policies, settings

| Method | Path | Permission | Behavior |
| --- | --- | --- | --- |
| GET | `/api/analytics` | analytics | Overview cards, monthly issue and return counts, categories, popular titles, borrowers, acquisition trend. |
| GET | `/api/agent-logs` | agents | Aggregates and recent execution rows. Admin only. |
| GET | `/api/policies` | policies.read | Active policies. `?q=` runs policy RAG or keyword retrieval. Embeddings are not returned. |
| POST | `/api/policies` | policies.write | Create or update a policy and refresh its embedding when possible. |
| GET | `/api/settings` | settings | Circulation and RAG settings. |
| PUT | `/api/settings` | settings | Update those values. |
| GET | `/api/notifications` | any signed-in user | The caller's notifications. |
| POST | `/api/notifications` | any signed-in user | Body `{ "id" }` marks that notification read for the caller. Omitting `id` returns the caller's list. |
| GET | `/api/audit` | audit | Recent audit rows. |
| GET | `/api/users` | users.manage | Staff and student accounts without password hashes. |
| POST | `/api/users` | users.manage | Create a librarian or administrator. |
| PATCH | `/api/users` | users.manage | Body `{ "userId", "role" }` sets the role to `LIBRARIAN` or `ADMIN`. |

Dashboard pages call these routes or the services directly on the server. Either way, the permission check runs on the server.
