// src/db/schema.ts
// Drizzle ORM schema for Neon PostgreSQL with pgvector

import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  integer, 
  numeric,
  timestamp, 
  pgEnum,
  index,
  uniqueIndex,
  boolean,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Custom pgvector column type
import { customType } from 'drizzle-orm/pg-core';

const EMBEDDING_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS || '768');

export const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return `vector(${EMBEDDING_DIMENSIONS})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: unknown): number[] {
    const text = String(value);
    return text
      .replace(/[\[\]]/g, "")
      .split(",")
      .filter((part) => part.length > 0)
      .map(Number);
  },
});

// ==================== ENUMS ====================

export const userRoleEnum = pgEnum('user_role', ['STUDENT', 'LIBRARIAN', 'ADMIN']);
export const studentStatusEnum = pgEnum('student_status', ['ACTIVE', 'INACTIVE']);
export const loanStatusEnum = pgEnum('loan_status', ['ACTIVE', 'RETURNED', 'OVERDUE']);
export const acquisitionStatusEnum = pgEnum('acquisition_status', ['PENDING', 'APPROVED', 'REJECTED']);
export const auditActionEnum = pgEnum('audit_action', [
  'BOOK_ISSUED', 'BOOK_RETURNED', 'BOOK_RENEWED',
  'ACQUISITION_REQUESTED', 'ACQUISITION_APPROVED', 'ACQUISITION_REJECTED',
  'STUDENT_REGISTERED', 'STUDENT_UPDATED',
  'BOOK_ADDED', 'BOOK_UPDATED', 'BOOK_DELETED',
  'POLICY_UPDATED', 'SETTINGS_UPDATED',
  'USER_LOGIN', 'USER_LOGOUT',
]);
export const notificationTypeEnum = pgEnum('notification_type', ['INFO', 'WARNING', 'ERROR', 'SUCCESS']);

// ==================== TABLES ====================

// USERS - Authentication and role management
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('STUDENT'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('users_email_idx').on(table.email),
]);

// STUDENTS - Extended student profile linked to users
export const students = pgTable('students', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  rollNo: varchar('roll_no', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  department: varchar('department', { length: 100 }),
  semester: integer('semester'),
  activeLoansCount: integer('active_loans_count').notNull().default(0),
  finesDue: numeric('fines_due', { precision: 10, scale: 2 }).notNull().default('0.00'),
  status: studentStatusEnum('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('students_roll_no_idx').on(table.rollNo),
  uniqueIndex('students_email_idx').on(table.email),
  uniqueIndex('students_user_id_idx').on(table.userId),
  check('students_loans_non_negative', sql`${table.activeLoansCount} >= 0`),
  check('students_fines_non_negative', sql`${table.finesDue} >= 0`),
]);

// BOOKS - Library book catalog with vector embeddings
export const books = pgTable('books', {
  id: uuid('id').defaultRandom().primaryKey(),
  isbn: varchar('isbn', { length: 20 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  author: varchar('author', { length: 500 }).notNull(),
  publisher: varchar('publisher', { length: 255 }),
  publicationYear: integer('publication_year'),
  category: varchar('category', { length: 100 }).notNull(),
  description: text('description'),
  deweyDecimal: varchar('dewey_decimal', { length: 20 }),
  totalCopies: integer('total_copies').notNull().default(1),
  availableCopies: integer('available_copies').notNull().default(1),
  embedding: vector('embedding'),
  contentHash: varchar('content_hash', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('books_isbn_idx').on(table.isbn),
  index('books_category_idx').on(table.category),
  index('books_title_idx').on(table.title),
  index('books_author_idx').on(table.author),
  check('books_copy_bounds', sql`${table.availableCopies} >= 0 AND ${table.totalCopies} >= 0 AND ${table.availableCopies} <= ${table.totalCopies}`),
]);

// LOANS - Book borrowing transactions
export const loans = pgTable('loans', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookId: uuid('book_id').references(() => books.id, { onDelete: 'restrict' }).notNull(),
  studentId: uuid('student_id').references(() => students.id, { onDelete: 'restrict' }).notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  returnedAt: timestamp('returned_at', { withTimezone: true }),
  fineAmount: numeric('fine_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  renewalCount: integer('renewal_count').notNull().default(0),
  status: loanStatusEnum('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('loans_book_id_idx').on(table.bookId),
  index('loans_student_id_idx').on(table.studentId),
  index('loans_status_idx').on(table.status),
  index('loans_due_date_idx').on(table.dueDate),
  uniqueIndex('loans_one_held_per_student_book')
    .on(table.studentId, table.bookId)
    .where(sql`${table.status} IN ('ACTIVE', 'OVERDUE')`),
  check('loans_fine_non_negative', sql`${table.fineAmount} >= 0`),
  check('loans_renewal_non_negative', sql`${table.renewalCount} >= 0`),
]);

// ACQUISITION_REQUESTS - Book purchase/acquisition requests
export const acquisitionRequests = pgTable('acquisition_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookTitle: varchar('book_title', { length: 500 }).notNull(),
  author: varchar('author', { length: 500 }),
  isbn: varchar('isbn', { length: 20 }),
  reason: text('reason').notNull(),
  requestedByAgent: varchar('requested_by_agent', { length: 50 }),
  requestedByStudentId: uuid('requested_by_student_id').references(() => students.id),
  suggestedCategory: varchar('suggested_category', { length: 100 }),
  suggestedDeweyDecimal: varchar('suggested_dewey_decimal', { length: 20 }),
  estimatedCost: numeric('estimated_cost', { precision: 10, scale: 2 }),
  priority: varchar('priority', { length: 20 }).default('MEDIUM'),
  status: acquisitionStatusEnum('status').notNull().default('PENDING'),
  librarianComment: text('librarian_comment'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
}, (table) => [
  index('acquisition_requests_status_idx').on(table.status),
]);

// LIBRARY_POLICIES - Library rules and policies with embeddings for RAG
export const libraryPolicies = pgTable('library_policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  policyName: varchar('policy_name', { length: 255 }).notNull(),
  policyContent: text('policy_content').notNull(),
  category: varchar('category', { length: 100 }),
  embedding: vector('embedding'),
  contentHash: varchar('content_hash', { length: 64 }),
  isActive: boolean('is_active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// LIBRARY_SETTINGS - Configurable library parameters
export const librarySettings = pgTable('library_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  settingKey: varchar('setting_key', { length: 100 }).notNull(),
  settingValue: varchar('setting_value', { length: 500 }).notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('library_settings_key_idx').on(table.settingKey),
]);

// AUDIT_LOGS - System audit trail
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  action: auditActionEnum('action').notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id'),
  details: text('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('audit_logs_user_id_idx').on(table.userId),
  index('audit_logs_action_idx').on(table.action),
  index('audit_logs_created_at_idx').on(table.createdAt),
]);

// NOTIFICATIONS - System notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: notificationTypeEnum('type').notNull().default('INFO'),
  isRead: boolean('is_read').notNull().default(false),
  link: varchar('link', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('notifications_user_id_idx').on(table.userId),
  index('notifications_is_read_idx').on(table.isRead),
]);

// AGENT_EXECUTION_LOGS - Multi-agent system execution tracking
export const agentExecutionLogs = pgTable('agent_execution_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: varchar('session_id', { length: 100 }).notNull(),
  agentName: varchar('agent_name', { length: 50 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  input: text('input'),
  output: text('output'),
  toolsUsed: text('tools_used'), // JSON array stored as text
  durationMs: integer('duration_ms'),
  status: varchar('status', { length: 20 }).notNull().default('success'),
  errorMessage: text('error_message'),
  userId: uuid('user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('agent_logs_session_idx').on(table.sessionId),
  index('agent_logs_agent_name_idx').on(table.agentName),
  index('agent_logs_created_at_idx').on(table.createdAt),
]);

// CHAT_SESSIONS - Track chat conversations
export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// CHAT_MESSAGES - Store chat history
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => chatSessions.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 20 }).notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  traceEvents: text('trace_events'), // JSON stored as text
  metadata: text('metadata'), // JSON stored as text
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('chat_messages_session_idx').on(table.sessionId),
]);
