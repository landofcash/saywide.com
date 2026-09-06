import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)] disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "border-[var(--ink)] bg-[var(--ink)] px-5 text-white hover:bg-[#26352f]",
        accent:
          "border-[var(--coral-dark)] bg-[var(--coral)] px-5 text-white hover:bg-[var(--coral-dark)]",
        secondary:
          "border-[var(--line)] bg-white px-5 text-[var(--ink)] hover:border-[#87938e] hover:bg-slate-50",
        ghost: "border-transparent px-3 text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]",
        danger: "border-red-300 bg-white px-5 text-red-700 hover:bg-red-50",
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
  const usesLightText = resolvedVariant === "primary" || resolvedVariant === "accent";
  const resolvedStyle = usesLightText ? { ...style, color: style?.color ?? "#ffffff" } : style;
  return <Component className={cn(buttonVariants({ variant, size }), className)} style={resolvedStyle} {...props} />;
}

export { buttonVariants };
