import { redirect } from "next/navigation";
import { entryUrl } from "@/lib/organizer-navigation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams;
  redirect(`${entryUrl(query.next)}#sign-in`);
}
