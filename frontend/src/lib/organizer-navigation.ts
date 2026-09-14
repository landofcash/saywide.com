const organizerPath = /^\/(?:dashboard|create|surveys\/new|surveys\/[a-zA-Z0-9-]+(?:\/(?:edit|share|reports\/new))?|reports\/[a-zA-Z0-9-]+)$/;

export function organizerDestination(value: string | null | undefined): string {
  return value && organizerPath.test(value) ? value : "/dashboard";
}

export function entryUrl(destination = "/dashboard"): string {
  return `/start?next=${encodeURIComponent(organizerDestination(destination))}`;
}

// Navigation after an identity change also discards any in-flight organizer UI state.
export function finishAccountAction(destination: string): void {
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("saywide:account");
    channel.postMessage("changed");
    channel.close();
  }
  window.location.assign(destination);
}
