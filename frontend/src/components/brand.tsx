"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type LogoVariant = "1" | "2";

const logoOptions = {
  "1": {
    src: "/images/saywide-logo-1.png",
    width: 40,
    height: 40,
    className: "size-10 object-contain",
  },
  "2": {
    src: "/images/saywide-logo.png",
    width: 56,
    height: 40,
    className: "h-10 w-14 object-contain",
  },
} as const;

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [logoVariant, setLogoVariant] = useState<LogoVariant>("2");

  useEffect(() => {
    const updateLogoVariant = () => {
      setLogoVariant(new URLSearchParams(window.location.search).get("logo") === "1" ? "1" : "2");
    };

    updateLogoVariant();
    window.addEventListener("popstate", updateLogoVariant);
    return () => window.removeEventListener("popstate", updateLogoVariant);
  }, []);

  const logo = logoOptions[logoVariant];

  return (
    <Link href="/" className={cn("group inline-flex items-center gap-3", className)} aria-label="Saywide home">
      <Image src={logo.src} alt="" width={logo.width} height={logo.height} className={logo.className} />
      {!compact && <span className="font-display text-xl font-bold tracking-[-0.025em]">saywide</span>}
    </Link>
  );
}
