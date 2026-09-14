"use client";

import { loginInputSchema, registerInputSchema } from "@saywide/contracts";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LogIn, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { useOrganizerSession } from "@/components/organizer/organizer-session";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";
import { api } from "@/lib/api";
import { entryUrl, finishAccountAction, organizerDestination } from "@/lib/organizer-navigation";
import styles from "./account-screens.module.css";

function AccountFrame({ children }: { children: React.ReactNode }) {
  return <div className={styles.page}><AppHeader variant="access" />
    <main className={styles.main}><div className={styles.panel}>{children}</div>
      <p className={styles.footer}>A little feedback can make a big difference.</p>
    </main>
  </div>;
}

function PasswordField({ id, label = "Password", value, onChange, newPassword = false }: {
  id: string; label?: string; value: string; onChange: (value: string) => void; newPassword?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <div><Label htmlFor={id}>{label}</Label><div className={styles.password}>
    <Input id={id} name={id} type={visible ? "text" : "password"} autoComplete={newPassword ? "new-password" : "current-password"}
      value={value} onChange={(event) => onChange(event.target.value)} className="pr-12" required maxLength={128} minLength={newPassword ? 8 : 1} />
    <button type="button" onClick={() => setVisible(!visible)} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible}>
      {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
    </button>
  </div></div>;
}
function ErrorMessage({ message }: { message: string }) {
  return message ? <p className={styles.error} role="alert">{message}</p> : null;
}
function errorText(error: unknown) { return error instanceof Error ? error.message : "Something went wrong. Please try again."; }

function useAccountPage(claim = false) {
  const context = useOrganizerSession()!;
  const router = useRouter();
  const query = useSearchParams();
  const destination = organizerDestination(query.get("next"));
  const registered = context.session?.workspace?.kind === "registered";
  useEffect(() => {
    if (context.error || !context.session) return;
    if (!claim && registered) router.replace(destination);
    if (claim && !registered) router.replace(entryUrl(destination));
    if (claim && registered && context.session.guestSurveyCount === 0) router.replace(destination);
  }, [claim, context.error, context.session, destination, registered, router]);
  return { ...context, destination, ready: !!context.session && !context.error && (claim ? registered && context.session.guestSurveyCount > 0 : !registered) };
}
function SessionPending({ error, refresh }: { error: string; refresh: () => Promise<void> }) {
  return <AccountFrame><p className={styles.pending} role="status">{error || "Checking your workspace..."}</p>
    {error && <Button variant="secondary" className="mt-4 w-full" onClick={() => void refresh()}>Try again</Button>}
  </AccountFrame>;
}

export function LoginScreen() {
  const access = useAccountPage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<"guest" | "login" | null>(null);
  const [guestError, setGuestError] = useState("");
  const [loginError, setLoginError] = useState("");
  async function guest() {
    if (pending) return;
    setPending("guest"); setGuestError("");
    try { await api.continueAsGuest(); finishAccountAction(access.destination); }
    catch (error) { setGuestError(errorText(error)); setPending(null); }
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = loginInputSchema.safeParse({ email, password });
    if (!parsed.success) { setLoginError("Enter a valid email address and your password."); return; }
    setPending("login"); setLoginError("");
    try {
      const result = await api.login(parsed.data.email, parsed.data.password);
      finishAccountAction(result.guestWorkspacePending ? `/account/claim?next=${encodeURIComponent(access.destination)}` : access.destination);
    } catch (error) { setLoginError(errorText(error)); setPending(null); }
  }
  if (!access.ready) return <SessionPending {...access} />;
  return <AccountFrame>
    <span className={styles.eyebrow}>Good questions. Better decisions.</span>
    <h1 className={styles.title}>Hear what matters.</h1>
    
    <button className={styles.guestButton} onClick={() => void guest()} disabled={!!pending}>
      <span className={styles.shimmer} aria-hidden="true" />
      <span>{pending === "guest" ? "Opening your workspace..." : "Continue as guest"}</span>
      {pending === "guest" ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
    </button>
    <p className={styles.guestHint}>Guest access is linked to this browser. Create an account later to access your surveys across devices.</p>
    <ErrorMessage message={guestError} />
    <div className={styles.divider}><span>Or sign in to your account</span></div>
    <form id="sign-in" onSubmit={login}><fieldset className={styles.fields} disabled={!!pending}>
      <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></div>
      <PasswordField id="password" value={password} onChange={setPassword} />
      <ErrorMessage message={loginError} />
      <Button type="submit" variant="accent" className={`${styles.signIn} cursor-pointer`}><LogIn className="size-4" aria-hidden="true" />{pending === "login" ? "Signing in..." : "Sign in"}</Button>
    </fieldset></form>
    <p className={styles.alternative}>Don't have an account? <Link href={`/account/create?next=${encodeURIComponent(access.destination)}`}>Create account</Link></p>
  </AccountFrame>;
}

export function CreateAccountScreen() {
  const access = useAccountPage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = registerInputSchema.safeParse({ email, password });
    if (!parsed.success) { setError("Enter a valid email and a password of 8-128 characters."); return; }
    if (password !== confirmation) { setError("Your passwords don't match."); return; }
    setPending(true); setError("");
    try { await api.register(parsed.data.email, parsed.data.password); finishAccountAction(access.destination); }
    catch (error) { setError(errorText(error)); setPending(false); }
  }
  if (!access.ready) return <SessionPending {...access} />;
  const count = access.session!.guestSurveyCount;
  return <AccountFrame>
    <div className={styles.topBadge}><span className={styles.icon}><ShieldCheck aria-hidden="true" /></span><span>Keep your surveys.</span></div>
    <p className={styles.description}>Create an account to sign in and access your surveys from any device.</p>
    <form onSubmit={submit}><fieldset disabled={pending} className={styles.fields}>
      <div><Label htmlFor="create-email">Email</Label><Input id="create-email" name="email" type="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></div>
      <PasswordField id="create-password" value={password} onChange={setPassword} newPassword />
      <p className={styles.passwordHint}>Use at least 8 characters.</p>
      <PasswordField id="confirm-password" label="Confirm password" value={confirmation} onChange={setConfirmation} newPassword />
      <ErrorMessage message={error} />
      <Button type="submit" variant="accent" className={styles.signIn}>{pending ? "Creating your account..." : "Create account"}</Button>
    </fieldset></form>
    <p className={styles.alternative}>Already have an account? <Link href={`${entryUrl(access.destination)}#sign-in`}>Sign in</Link></p>
    <Link className={styles.back} href={entryUrl(access.destination)}>Or continue as guest</Link>
  </AccountFrame>;
}

export function ClaimAccountScreen() {
  const access = useAccountPage(true);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function claim() {
    if (!confirmed || pending) return;
    setPending(true); setError("");
    try { await api.claimGuestSurveys(); finishAccountAction(access.destination); }
    catch (error) { setError(errorText(error)); setPending(false); }
  }
  if (!access.ready) return <SessionPending {...access} />;
  const session = access.session!;
  return <AccountFrame>
    <span className={styles.icon}><ShieldCheck aria-hidden="true" /></span>
    <h1 className={styles.title}>Bring your guest<br />surveys with you?</h1>
    <p className={styles.description}>This browser has surveys that aren't connected to your account. You choose what happens next.</p>
    <div className={styles.transfer}><span>From this browser</span><strong>{session.guestSurveyCount} guest {session.guestSurveyCount === 1 ? "survey" : "surveys"}</strong><ArrowRight aria-hidden="true" /><span>To your account</span><strong>{session.workspace?.kind === "registered" ? session.workspace.email : ""}</strong></div>
    <p className={styles.guestHint}>Survey links, responses, and reports stay intact. Guest access will be retired after the move.</p>
    <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={pending} /><span>Move these surveys into my account. I understand this cannot be undone from this screen.</span></label>
    <ErrorMessage message={error} />
    <Button variant="accent" className={styles.signIn} disabled={!confirmed || pending} onClick={() => void claim()}>{pending ? "Moving your surveys..." : "Move surveys to my account"}</Button>
    <Button variant="ghost" className="mt-2 w-full" disabled={pending} onClick={() => finishAccountAction(access.destination)}>Not now</Button>
  </AccountFrame>;
}
