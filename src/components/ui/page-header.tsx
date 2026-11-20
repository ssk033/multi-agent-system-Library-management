export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{eyebrow}</p>}
        <h1 className="mt-1 text-[1.55rem] font-semibold tracking-[-0.035em] text-foreground">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
