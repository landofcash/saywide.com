import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type Tone = "neutral" | "open" | "draft" | "closed" | "accent";

const tones: Record<Tone, string> = {
  neutral: "border-[var(--line)] bg-white text-[var(--muted)]",
  open: "border-emerald-200 bg-emerald-50 text-emerald-800",
  draft: "border-amber-200 bg-amber-50 text-amber-800",
  closed: "border-slate-200 bg-slate-100 text-slate-700",
  accent: "border-orange-200 bg-orange-50 text-orange-800",
};

export function Badge({ className, children, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const tone = props.tone ?? "neutral";
  const { tone: _tone, ...rest } = props;
  void _tone;
  return (
    <span
      className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold capitalize", tones[tone], className)}
      {...rest}
    >
      {children}
    </span>
  );
}
