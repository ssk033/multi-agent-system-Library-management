# Agent workflows

The graph is defined in `src/agents/graph.ts`. State is `LibraryAnnotation` in `src/agents/state.ts`. Tool definitions are in `src/agents/tools.ts`.

## Agents

| Agent | Job | Tools |
| --- | --- | --- |
| Supervisor | Read the utterance, choose the next worker, or finish | None. It does not issue books or approve purchases. |
| Discovery | Semantic and keyword search, similar titles, policy retrieval | `searchBooksSemantic`, `searchCatalog`, `searchBooksByCategory`, `getBookDetails`, `checkBookAvailability`, `recommendSimilarBooks`, `searchLibraryPolicies`. Librarians and admins also get `getLibraryStatistics`. Admins get `getAuditLogs`. |
| Circulation | Eligibility, loans, fines, renewal | `issueBook`, `returnBook`, `renewBook`, `getStudentLoans`, `getOverdueLoans`, `calculateFine` |
| Acquisition | Restock and new-title requests, classification drafts | `createAcquisitionRequest`, `suggestBookClassification`, `prepareBookCatalogEntry`. Staff also see `getPendingAcquisitions`. Approve and reject tools are present and always refuse inside chat. |

## Supervisor decision

```mermaid
sequenceDiagram
  participant User
  participant Supervisor
  participant Discovery
  participant Circulation
  participant Commit
  User->>Supervisor: I want to borrow a book on machine learning
  Supervisor->>Discovery: Search the catalog
  Discovery-->>Supervisor: Matching titles and availability
  Supervisor->>Circulation: Prepare an issue
  Circulation-->>User: Confirmation card
  User->>Commit: Confirm
  Commit-->>User: Loan id, due date, transaction committed
```

`planRoute` in `src/lib/routing.ts` is the plan the supervisor follows. It does not wait on Gemini to pick the next agent. `resolveRoute` accepts only an agent that is still in that plan. A pending confirmation forces `confirm_gate` instead of another specialist. After six iterations the supervisor finishes. The reply is composed from tool observations.

## Discovery and RAG

```mermaid
flowchart TD
  query[User query] --> keyword[Keyword catalog or policy search]
  keyword --> hit{Any matching cards?}
  hit -->|yes| context[Pass books or policies to the agent]
  hit -->|no match, topical| embed{Gemini embeddings configured?}
  embed -->|yes| vector[Embed query, 8s timeout]
  vector --> search[pgvector cosine search]
  search --> context
  embed -->|no or timeout| context
  keyword --> context
  context --> answer[Grounded answer or book cards]
```

`searchBooksSemantic` embeds the query, reads the nearest books, and drops rows under `SIMILARITY_THRESHOLD`. `searchLibraryPolicies` does the same for policy text and always attaches `currentSettings`. The discovery prompt tells the model to quote those sources. If both vector search and the model are unavailable, the fallback answer is built from tool observations in `composeFallbackAnswer`.

Dewey suggestions come from Gemini structured output when a key exists, otherwise from a keyword table. Every suggestion includes the sentence that a librarian must verify it. `prepareBookCatalogEntry` returns a draft and does not insert a row.

## Book issuance

```mermaid
flowchart TD
  ask[Borrow request] --> find[Discovery finds a book id]
  find --> preview[previewIssue locks nothing yet]
  preview --> eligible{Student active, under limit, no blocking fine, copy free?}
  eligible -->|no| explain[Return the denial]
  eligible -->|yes| confirm[Ask the user to confirm]
  confirm --> lock[Transaction: lock student and book]
  lock --> recheck[Re-check copies and duplicate loan]
  recheck --> write[Insert loan, decrement available_copies, increment active_loans_count]
  write --> audit[Audit log BOOK_ISSUED]
```

The student id is taken from the session for a student. A librarian may pass a roll number. The same last copy cannot be issued twice: the book row is locked, `takeCopy` refuses zero, and the partial unique index `loans_one_held_per_student_book` rejects a second held loan of that title.

## Book return

```mermaid
flowchart TD
  request[Return request] --> loan[Find the caller's loan]
  loan --> confirm[Confirm the projected fine]
  confirm --> txn[Lock the loan row]
  txn --> fine[Ceil overdue days times fine_per_day]
  fine --> close[Set RETURNED, returned_at, fine_amount]
  close --> stock[Increment available_copies and decrement active_loans_count]
  stock --> balance[Add the fine to fines_due]
```

Overdue status is refreshed by `syncOverdue` before lists are read. A return of an already returned loan fails. A student cannot return another student's loan because `listLoans` and `returnBook` filter on the session student id.

## Renewal

An active loan renews once by adding `renewal_duration_days` to the current due date. Overdue loans, returned loans, and accounts with a fine are refused. The same confirmation gate wraps the write.

## Human approval

```mermaid
sequenceDiagram
  participant Student
  participant Acquisition
  participant Database
  participant Librarian
  Student->>Acquisition: Please purchase this unavailable title
  Acquisition->>Student: Confirm the request
  Student->>Database: Insert PENDING acquisition
  Database->>Librarian: Notification on the dashboard
  Librarian->>Database: Approve or reject with a comment
  Database->>Student: Decision notification and audit row
```

The model cannot set `APPROVED`. `approveAcquisition` checks the librarian or administrator session and writes `reviewed_by`. Rejection requires a comment of at least three characters. After approval, the librarian may catalog the title, which inserts the book through `bookService` and can generate an embedding if Gemini is configured.

## What the trace panel shows

Each event has an agent, a channel, and a short message. Channels are `agent`, `tool`, `database`, and `approval`. Examples:

- Supervisor: understanding the request, then delegating.
- Discovery: catalogue search started and completed. Semantic search is used only when a topical question has no keyword hit.
- Circulation: eligibility result.
- Database: transaction committed.
- Approval: confirmation required, or librarian decision recorded from the dashboard.

Token text is the final answer only. Intermediate model thoughts are not stored.
