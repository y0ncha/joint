export function buildOAuthCallbackUrl(origin: string, next: string | null) {
  const callback = new URL("/auth/callback", origin);

  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
    const destination = new URL(next, origin);
    if (destination.origin === origin) callback.searchParams.set("next", next);
  }

  return callback.toString();
}
