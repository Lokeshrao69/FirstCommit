import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerGhost" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px";

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-[15px]",
  lg: "h-12 px-6 text-[15px]",
};

const variants: Record<Variant, string> = {
  /* Ember = FlowForge doing work; dark ink on the flame. */
  primary:
    "bg-primary text-on-accent font-semibold hover:bg-primary-hover shadow-ember focus-visible:shadow-ember",
  secondary:
    "border border-border bg-surface text-text hover:bg-surface-2 hover:border-border-strong",
  ghost: "bg-transparent text-muted hover:bg-surface-2 hover:text-text",
  danger: "bg-error text-white hover:bg-error/85",
  dangerGhost: "bg-transparent text-error hover:bg-error/10",
  success: "bg-success text-bg font-semibold hover:bg-success/90",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className = "", type = "button", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});