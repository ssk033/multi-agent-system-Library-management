import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-medium tracking-[-0.01em] transition duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[#4539b8] dark:hover:bg-[#9b92f4]",
        secondary: "border border-border bg-card text-foreground hover:bg-[#f3f5fa] dark:hover:bg-[#1c2433]",
        ghost: "text-muted hover:bg-[#eef1f7] hover:text-foreground dark:hover:bg-white/5",
        danger: "bg-[#b42318] text-white hover:bg-[#912018]",
      },
      size: {
        default: "h-9",
        sm: "h-8 px-2.5 text-xs",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
