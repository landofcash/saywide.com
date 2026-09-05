import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)] disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "border-[var(--ink)] bg-[var(--ink)] px-5 text-white shadow-[0_5px_0_var(--shadow)] hover:-translate-y-0.5 hover:shadow-[0_7px_0_var(--shadow)] active:translate-y-0 active:shadow-[0_3px_0_var(--shadow)]",
        accent:
          "border-[var(--coral-dark)] bg-[var(--coral)] px-5 text-[var(--ink)] shadow-[0_5px_0_var(--coral-dark)] hover:-translate-y-0.5",
        secondary:
          "border-[var(--line)] bg-white/75 px-5 text-[var(--ink)] hover:border-[var(--ink)] hover:bg-white",
        ghost: "border-transparent px-3 text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]",
        danger: "border-red-200 bg-red-50 px-5 text-red-800 hover:bg-red-100",
      },
      size: {
        default: "h-11",
        sm: "h-9 min-h-9 px-4 text-xs",
        lg: "h-13 min-h-13 px-7 text-base",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, style, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  const resolvedVariant = variant ?? "primary";
  const resolvedStyle = resolvedVariant === "primary" ? { ...style, color: style?.color ?? "#fffdf8" } : style;
  return <Component className={cn(buttonVariants({ variant, size }), className)} style={resolvedStyle} {...props} />;
}

export { buttonVariants };
