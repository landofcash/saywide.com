"use client";

import { ArrowLeft, Check, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form-controls";
import { api } from "@/lib/api";

function AccountFrame({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-5 py-7 sm:py-12">
      <div className="mx-auto max-w-5xl"><Brand /><div className="mt-8 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center"><section><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">{eyebrow}</p><h1 className="font-display mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">{title}</h1><p className="mt-5 max-w-md text-lg leading-8 text-[var(--muted)]">{description}</p><Link href="/create" className="mt-7 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--muted)]"><ArrowLeft className="size-4" /> Back to survey creation</Link></section>{children}</div></div>
    </div>
  );
}

function PasswordField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  return <div><Label htmlFor={id}>{label}</Label><div className="relative"><Input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} className="pr-12" required /><button type="button" onClick={() => setVisible((current) => !current)} className="absolute right-1 top-0 grid size-11 place-items-center text-[var(--muted)]" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}>{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div>;
}

export function CreateAccountScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= 10 && password === confirmation;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setLoading(true);
    await api.register(email, password);
    router.push("/dashboard");
  }

  return <AccountFrame eyebrow="Optional account" title="Protect what you have created." description="Your three guest surveys stay exactly where they are. An account makes them recoverable and available on another device."><Card className="p-6 sm:p-8"><div className="flex gap-3 rounded-lg border-l-4 border-l-emerald-700 bg-[var(--canvas)] p-4"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-800" /><div><p className="font-bold">3 surveys will be protected</p><p className="mt-1 text-sm text-emerald-950/70">Nothing is published or shared by creating an account.</p></div></div><form onSubmit={submit} className="mt-6 space-y-5"><div><Label htmlFor="create-email">Email</Label><Input id="create-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div><PasswordField id="create-password" label="Password" value={password} onChange={setPassword} /><PasswordField id="confirm-password" label="Confirm password" value={confirmation} onChange={setConfirmation} /><ul className="space-y-2 text-xs text-[var(--muted)]"><li className="flex items-center gap-2"><Check className={`size-3.5 ${password.length >= 10 ? "text-emerald-700" : ""}`} /> At least 10 characters</li><li className="flex items-center gap-2"><Check className={`size-3.5 ${password === confirmation && confirmation ? "text-emerald-700" : ""}`} /> Passwords match</li></ul><Button type="submit" variant="accent" size="lg" className="w-full" disabled={!valid || loading}>{loading ? "Protecting surveys…" : "Create account"}</Button></form><p className="mt-5 text-center text-sm text-[var(--muted)]">Already have an account? <Link href="/login" className="font-bold text-[var(--ink)] underline">Sign in</Link></p></Card></AccountFrame>;
}

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    const result = await api.login(email, password);
    router.push(result.hasGuestSurveys ? "/account/claim" : "/dashboard");
  }

  return <AccountFrame eyebrow="Welcome back" title="Return to your surveys." description="Sign in to see surveys connected to your account. You can always create a new survey without signing in."><Card className="p-6 sm:p-8"><div className="flex gap-3 rounded-lg border-l-4 border-l-amber-700 bg-amber-50 p-4"><LockKeyhole className="mt-0.5 size-5 shrink-0 text-amber-800" /><div><p className="font-bold">This browser also has guest surveys</p><p className="mt-1 text-sm text-amber-950/70">After sign-in, you can choose whether to move them into your account.</p></div></div><form onSubmit={submit} className="mt-6 space-y-5"><div><Label htmlFor="login-email">Email</Label><Input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div><PasswordField id="login-password" label="Password" value={password} onChange={setPassword} /><Button type="submit" variant="accent" size="lg" className="w-full" disabled={!email || !password || loading}>{loading ? "Signing in…" : "Sign in"}</Button></form><p className="mt-5 text-center text-sm text-[var(--muted)]">Want to protect this browser&apos;s surveys? <Link href="/account/create" className="font-bold text-[var(--ink)] underline">Create an account</Link></p></Card></AccountFrame>;
}

export function ClaimAccountScreen() {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  async function claim() {
    setLoading(true);
    const result = await api.claimGuestSurveys();
    setSuccess(`${result.transferredSurveyCount} surveys moved successfully.`);
    window.setTimeout(() => router.push("/dashboard"), 700);
  }

  return <AccountFrame eyebrow="One clear choice" title="Bring your guest surveys with you?" description="This browser has work that is not yet connected to your signed-in account. Nothing moves unless you confirm it."><Card className="p-6 sm:p-8"><div className="rounded-lg border-l-4 border-l-emerald-700 bg-[var(--canvas)] p-5"><p className="font-display text-2xl font-bold">3 guest surveys</p><p className="mt-2 text-sm leading-6 text-emerald-950/70">They will appear beside your account surveys. The guest access on this browser will then be retired.</p></div><label className="mt-6 flex cursor-pointer gap-3 rounded-lg border border-[var(--line)] p-4 text-sm leading-6"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 size-4 shrink-0 accent-[var(--ink)]" /><span><strong className="block">Move these surveys into my account</strong>I understand this changes their owner and cannot be undone from this screen.</span></label>{success && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" role="status">{success}</p>}<Button variant="accent" size="lg" className="mt-6 w-full" disabled={!confirmed || loading} onClick={claim}>{loading ? "Moving surveys…" : "Move surveys to my account"}</Button><Button variant="ghost" className="mt-2 w-full" asChild><Link href="/dashboard">Not now</Link></Button></Card></AccountFrame>;
}
