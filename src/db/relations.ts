import { relations } from "drizzle-orm";
import {
  acquisitionRequests,
  agentExecutionLogs,
  auditLogs,
  books,
  chatMessages,
  chatSessions,
  loans,
  notifications,
  students,
  users,
} from "./schema";

export const usersRelations = relations(users, ({ one, many }) => ({
  student: one(students, {
    fields: [users.id],
    references: [students.userId],
  }),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
  chatSessions: many(chatSessions),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  loans: many(loans),
  acquisitionRequests: many(acquisitionRequests),
}));

export const booksRelations = relations(books, ({ many }) => ({
  loans: many(loans),
}));

export const loansRelations = relations(loans, ({ one }) => ({
  book: one(books, { fields: [loans.bookId], references: [books.id] }),
  student: one(students, { fields: [loans.studentId], references: [students.id] }),
}));

export const acquisitionRelations = relations(acquisitionRequests, ({ one }) => ({
  student: one(students, {
    fields: [acquisitionRequests.requestedByStudentId],
    references: [students.id],
  }),
  reviewer: one(users, {
    fields: [acquisitionRequests.reviewedBy],
    references: [users.id],
  }),
}));

export const chatSessionRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, { fields: [chatSessions.userId], references: [users.id] }),
  messages: many(chatMessages),
}));

export const chatMessageRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const agentLogRelations = relations(agentExecutionLogs, ({ one }) => ({
  user: one(users, { fields: [agentExecutionLogs.userId], references: [users.id] }),
}));
