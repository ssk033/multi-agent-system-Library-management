import { z } from "zod";

export const emailSchema = z.string().trim().email().max(255);
export const passwordSchema = z.string().min(8).max(200);
export const uuidSchema = z.string().uuid();

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const bookSchema = z.object({
  isbn: z.string().trim().min(10).max(20),
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().min(1).max(500),
  publisher: z.string().trim().max(255).optional().nullable(),
  publicationYear: z.number().int().min(1400).max(2100).optional().nullable(),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().max(8000).optional().nullable(),
  deweyDecimal: z.string().trim().max(20).optional().nullable(),
  totalCopies: z.number().int().min(0).max(1000),
  availableCopies: z.number().int().min(0).max(1000).optional(),
});

export const studentCreateSchema = z.object({
  name: z.string().trim().min(2).max(255),
  email: emailSchema,
  password: passwordSchema,
  rollNo: z.string().trim().min(3).max(50),
  department: z.string().trim().max(100).optional().nullable(),
  semester: z.number().int().min(1).max(12).optional().nullable(),
});

export const loanIssueSchema = z.object({
  bookId: uuidSchema,
  studentId: uuidSchema.optional(),
  rollNo: z.string().trim().min(3).max(50).optional(),
});

export const loanActionSchema = z.object({
  loanId: uuidSchema,
});

export const acquisitionCreateSchema = z.object({
  bookTitle: z.string().trim().min(2).max(500),
  author: z.string().trim().max(500).optional().nullable(),
  reason: z.string().trim().min(10).max(4000),
});

export const decisionSchema = z.object({
  comment: z.string().trim().max(2000).optional().default(""),
});

export const chatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  sessionId: uuidSchema.optional(),
  turnId: z.string().min(8).max(120).optional(),
  bookId: uuidSchema.optional(),
  resume: z.object({ confirmed: z.boolean() }).optional(),
  confirmation: z
    .object({
      action: z.enum(["issue_book", "return_book", "renew_book", "create_acquisition"]),
      data: z.record(z.string(), z.unknown()),
      message: z.string().max(1000).optional(),
    })
    .optional(),
});

export const settingsSchema = z.object({
  maxLoansPerStudent: z.number().int().min(1).max(20),
  loanDurationDays: z.number().int().min(1).max(365),
  finePerDay: z.number().min(0).max(10000),
  renewalLimit: z.number().int().min(0).max(10),
  renewalDurationDays: z.number().int().min(1).max(365),
  blockBorrowWhenFinesDue: z.boolean(),
});

export const policySchema = z.object({
  policyName: z.string().trim().min(3).max(255),
  policyContent: z.string().trim().min(10).max(8000),
  category: z.string().trim().max(100).optional().nullable(),
});

export const staffUserSchema = z.object({
  name: z.string().trim().min(2).max(255),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["LIBRARIAN", "ADMIN"]),
});

export const roleUpdateSchema = z.object({
  role: z.enum(["LIBRARIAN", "ADMIN"]),
});

export const studentStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const catalogFromAcquisitionSchema = z.object({
  isbn: z.string().trim().min(10).max(20),
  totalCopies: z.number().int().min(1).max(100),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().max(8000).optional().nullable(),
});
