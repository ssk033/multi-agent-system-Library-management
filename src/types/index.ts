// src/types/index.ts
// Shared type definitions for the Autonomous Library Management System

export type UserRole = 'STUDENT' | 'LIBRARIAN' | 'ADMIN';
export type StudentStatus = 'ACTIVE' | 'INACTIVE';
export type LoanStatus = 'ACTIVE' | 'RETURNED' | 'OVERDUE';
export type AcquisitionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type NotificationType = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
export type AuditAction = 
  | 'BOOK_ISSUED' 
  | 'BOOK_RETURNED' 
  | 'BOOK_RENEWED'
  | 'ACQUISITION_REQUESTED' 
  | 'ACQUISITION_APPROVED' 
  | 'ACQUISITION_REJECTED'
  | 'STUDENT_REGISTERED'
  | 'STUDENT_UPDATED'
  | 'BOOK_ADDED'
  | 'BOOK_UPDATED'
  | 'BOOK_DELETED'
  | 'POLICY_UPDATED'
  | 'SETTINGS_UPDATED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT';

// Agent types
export type AgentName = 'supervisor' | 'discovery' | 'circulation' | 'acquisition';
export type AgentStatus = 'started' | 'completed' | 'error' | 'handoff';
export type ToolExecutionStatus = 'started' | 'completed' | 'error';

export interface AgentTraceEvent {
  id: string;
  timestamp: string;
  agent: AgentName | 'system';
  type: 'agent_start' | 'agent_end' | 'tool_call' | 'tool_result' | 'handoff' | 'error' | 'final_response' | 'approval_required';
  message: string;
  data?: Record<string, unknown>;
  duration?: number;
  channel?: 'agent' | 'tool' | 'database' | 'human';
}

export type StreamEvent =
  | { type: 'trace'; trace: AgentTraceEvent }
  | { type: 'token'; text: string }
  | { type: 'books'; books: BookCard[] }
  | { type: 'confirmation'; confirmation: ConfirmationRequest }
  | { type: 'interrupt'; confirmation: ConfirmationRequest; turnId: string; sessionId: string }
  | { type: 'done'; message: string; sessionId: string }
  | { type: 'error'; message: string };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  traceEvents?: AgentTraceEvent[];
  bookCards?: BookCard[];
  confirmationRequired?: ConfirmationRequest;
}

export interface BookCard {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  availableCopies: number;
  totalCopies: number;
  description?: string;
  similarityScore?: number;
}

export interface ConfirmationRequest {
  id: string;
  action: 'issue_book' | 'return_book' | 'renew_book' | 'create_acquisition';
  message: string;
  data: Record<string, unknown>;
  confirmed?: boolean;
}

export interface LibrarySettings {
  maxLoansPerStudent: number;
  loanDurationDays: number;
  finePerDay: number;
  renewalLimit: number;
  renewalDurationDays: number;
}

export interface DashboardStats {
  totalBooks: number;
  availableCopies: number;
  issuedBooks: number;
  registeredStudents: number;
  overdueBooks: number;
  pendingAcquisitions: number;
  totalOutstandingFines: number;
}

export interface AgentExecutionLog {
  id: string;
  sessionId: string;
  agentName: AgentName;
  action: string;
  input: string;
  output: string;
  toolsUsed: string[];
  durationMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  createdAt: string;
}

export interface MonthlyStats {
  month: string;
  issues: number;
  returns: number;
}

export interface CategoryDistribution {
  category: string;
  count: number;
}

export interface PopularBook {
  title: string;
  author: string;
  borrowCount: number;
}

export interface BookDTO {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  publicationYear: number | null;
  category: string;
  description: string | null;
  deweyDecimal: string | null;
  totalCopies: number;
  availableCopies: number;
  similarity?: number;
}

export interface LoanDTO {
  id: string;
  bookId: string;
  studentId: string;
  bookTitle: string;
  isbn: string;
  studentName: string;
  rollNo: string;
  issuedAt: string;
  dueDate: string;
  returnedAt: string | null;
  fineAmount: number;
  projectedFine: number;
  renewalCount: number;
  status: LoanStatus;
  daysRemaining: number;
}

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
  studentId: string | null;
}
