export function getProfileInitials(name: string | null) {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  return words.length ? `${words[0][0]}${words.length > 1 ? words.at(-1)?.[0] : ""}`.toUpperCase() : "?";
}
