import { cn } from "@/lib/utils";

/** Open pages with a supervisor node handing off to two specialists. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7 shrink-0", className)} aria-hidden="true">
      <path
        d="M16 6.2 6 10.5l1.9 14.1L16 20.7Z"
        className="fill-primary/12"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
      <path
        d="M16 6.2 26 10.5l-1.9 14.1L16 20.7Z"
        className="fill-primary/12"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
      <path d="M16 6.2v18.4" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M16 12.4 10.2 16.1M16 12.4l5.8 3.7" stroke="#5145CD" strokeWidth="1.05" strokeLinecap="round" />
      <circle cx="16" cy="12.4" r="1.75" fill="#5145CD" />
      <circle cx="10.2" cy="16.1" r="1.3" fill="#7565E8" />
      <circle cx="21.8" cy="16.1" r="1.3" fill="#7565E8" />
    </svg>
  );
}

export function BrandLockup({
  className,
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", inverse ? "text-white" : "text-foreground", className)}>
      <BrandMark />
      <span className="text-[13.5px] font-semibold tracking-[-0.03em]">Autonomous Library</span>
    </span>
  );
}
