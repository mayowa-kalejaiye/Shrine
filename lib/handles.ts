export const RESERVED = [
  "you","me","yours","mine","my","admin","administrator","shrine",
  "support","help","null","undefined","anonymous","anon","anons",
  "deleted","unknown","everyone","here","channel","official","team",
  "moderator","mod","system","bot","owner",
];

export function cleanHandle(h: string): string {
  return (h || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}
