import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { listLoans } from "@/services/loanService";
import { getStudentById, serializeStudent } from "@/services/studentService";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  let student: ReturnType<typeof serializeStudent>;
  let loans: Awaited<ReturnType<typeof listLoans>>;
  try {
    student = serializeStudent(await getStudentById(id));
    loans = (await listLoans({ ...session.user, role: "LIBRARIAN" })).filter((loan) => loan.studentId === student.id);
  } catch {
    notFound();
  }
  return (
      <div>
        <Link href="/students" className="text-[13px] text-muted">Back to students</Link>
        <section className="panel mt-4 p-6">
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">{student.name}</h1>
          <p className="mt-1 text-[13px] text-muted">{student.rollNo} · {student.email} · {student.department}</p>
          <p className="mt-4 text-[13px]">Status {student.status} · Active loans {student.activeLoansCount} · Fines {formatCurrency(student.finesDue)}</p>
        </section>
        <div className="mt-3 space-y-2">
          {loans.map((loan) => (
            <p key={loan.id} className="panel px-4 py-3 text-[13px]">{loan.bookTitle} · {loan.status} · due {formatDate(loan.dueDate)}</p>
          ))}
        </div>
      </div>
  );
}
