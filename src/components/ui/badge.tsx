import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  slate: "bg-[#f2f4f7] text-[#344054] dark:bg-white/8 dark:text-[#d0d5dd]",
  indigo: "bg-[#eeedfe] text-[#3e349e] dark:bg-[#5145cd]/20 dark:text-[#c9c4fb]",
  violet: "bg-[#f3f0ff] text-[#5145cd] dark:bg-[#7565e8]/20 dark:text-[#ddd7ff]",
  blue: "bg-[#eef4ff] text-[#1849a9] dark:bg-sky-400/15 dark:text-sky-200",
  amber: "bg-[#fffaeb] text-[#b54708] dark:bg-amber-400/15 dark:text-amber-200",
  emerald: "bg-[#ecfdf3] text-[#067647] dark:bg-emerald-400/15 dark:text-emerald-200",
  rose: "bg-[#fef3f2] text-[#b42318] dark:bg-rose-400/15 dark:text-rose-200",
};

export function Badge({
  className,
  tone = "slate",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium tracking-wide", tones[tone], className)}
      {...props}
    />
  );
}
