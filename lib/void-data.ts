export type ThoughtTag = "paranoia" | "desire" | "shame" | "genius" | "rage" | "grief";

export interface Thought {
  id: string;
  text: string;
  tag: ThoughtTag;
  intensity: number; // 1-100
  createdAt: number;
  expiresAt: number;
  matches: number;
  isPreserved: boolean;
}

export const TAG_CONFIG: Record<ThoughtTag, { label: string; color: string; bg: string; border: string; icon: string }> = {
  paranoia: { label: "Paranoia", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: "◉" },
  desire: { label: "Desire", color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20", icon: "♥" },
  shame: { label: "Shame", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", icon: "⬢" },
  genius: { label: "Genius", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: "✦" },
  rage: { label: "Rage", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: "⚡" },
  grief: { label: "Grief", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", icon: "◐" },
};

export const INTRUSIVE_PROMPTS = [
  "What are you pretending not to know?",
  "What thought keeps returning at 3am?",
  "What would you say if no one could trace it?",
  "What are you ashamed of wanting?",
  "What truth would ruin your image?",
  "What are you grieving that no one knows about?",
];

export const FAKE_FEED: Thought[] = [
  { id: "f1", text: "I check my ex's Spotify even though I'm happily married. I just need to know they're still sad.", tag: "shame", intensity: 78, createdAt: Date.now()-1000*60*12, expiresAt: Date.now()+1000*60*60*60, matches: 234, isPreserved: false },
  { id: "f2", text: "Sometimes I fantasize about deleting everything and moving to a village with no internet.", tag: "genius", intensity: 62, createdAt: Date.now()-1000*60*34, expiresAt: Date.now()+1000*60*60*60, matches: 891, isPreserved: true },
  { id: "f3", text: "I'm terrified my friends only invite me out of pity.", tag: "paranoia", intensity: 91, createdAt: Date.now()-1000*60*2, expiresAt: Date.now()+1000*60*60*60, matches: 445, isPreserved: false },
  { id: "f4", text: "I want to be famous just so people who ignored me feel stupid.", tag: "desire", intensity: 84, createdAt: Date.now()-1000*60*55, expiresAt: Date.now()+1000*60*60*60, matches: 1023, isPreserved: false },
  { id: "f5", text: "I scream in my car every morning before work and then act normal.", tag: "rage", intensity: 71, createdAt: Date.now()-1000*60*8, expiresAt: Date.now()+1000*60*60*60, matches: 567, isPreserved: false },
  { id: "f6", text: "I still hear my dad's voice telling me I'll never be enough. He's been dead 4 years.", tag: "grief", intensity: 88, createdAt: Date.now()-1000*60*19, expiresAt: Date.now()+1000*60*60*60, matches: 342, isPreserved: true },
];

export function analyzeThought(text: string): { tag: ThoughtTag; intensity: number } {
  const lower = text.toLowerCase();
  if (lower.match(/afraid|scared|paranoid|watching|judge|think about me/)) return { tag: "paranoia", intensity: 70 + Math.floor(Math.random()*25) };
  if (lower.match(/want|crave|wish|fantas|desire|need/)) return { tag: "desire", intensity: 65 + Math.floor(Math.random()*30) };
  if (lower.match(/ashamed|embarrass|guilty|hide|secret/)) return { tag: "shame", intensity: 75 + Math.floor(Math.random()*20) };
  if (lower.match(/angry|hate|rage|fuck|kill/)) return { tag: "rage", intensity: 80 + Math.floor(Math.random()*15) };
  if (lower.match(/sad|grief|miss|dead|loss|lonely/)) return { tag: "grief", intensity: 68 + Math.floor(Math.random()*25) };
  return { tag: "genius", intensity: 60 + Math.floor(Math.random()*30) };
}
