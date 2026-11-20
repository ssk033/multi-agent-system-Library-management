import type { ConfirmationRequest } from "@/types";

export function confirmationMatches(
  confirmation: ConfirmationRequest | null | undefined,
  action: ConfirmationRequest["action"],
  ids: { bookId?: string; loanId?: string; bookTitle?: string },
): boolean {
  if (!confirmation?.confirmed || confirmation.action !== action) return false;
  if (ids.bookId && confirmation.data.bookId !== ids.bookId) return false;
  if (ids.loanId && confirmation.data.loanId !== ids.loanId) return false;
  if (ids.bookTitle && confirmation.data.bookTitle !== ids.bookTitle) return false;
  return true;
}
