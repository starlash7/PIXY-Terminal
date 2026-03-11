import type { SessionCard, SkillCard } from "@/lib/types";

const STOPWORDS = new Set([
  "about",
  "after",
  "agent",
  "and",
  "brief",
  "browser",
  "chat",
  "from",
  "have",
  "hermes",
  "into",
  "just",
  "make",
  "memory",
  "more",
  "notes",
  "page",
  "prompt",
  "recent",
  "reply",
  "session",
  "show",
  "skills",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "through",
  "using",
  "with",
  "workflow",
]);

export type SkillInsight = {
  skill: SkillCard;
  memoryHits: number;
  sessionHits: number;
  matchedTerms: string[];
  score: number;
  freshnessLabel: string;
  signal: string;
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function collectTerms(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter((term) => term.length >= 4 && !STOPWORDS.has(term));
}

function uniqueTerms(text: string): string[] {
  return Array.from(new Set(collectTerms(text)));
}

function countHits(sourceTerms: string[], targetTerms: Set<string>): number {
  return sourceTerms.reduce(
    (total, term) => total + (targetTerms.has(term) ? 1 : 0),
    0,
  );
}

function freshnessLabel(lastUpdated: string): string {
  const ageMs = Date.now() - new Date(lastUpdated).getTime();
  const ageDays = Math.max(0, Math.floor(ageMs / 86_400_000));

  if (ageDays === 0) {
    return "Updated today";
  }
  if (ageDays === 1) {
    return "Updated yesterday";
  }
  if (ageDays < 7) {
    return `Updated ${ageDays}d ago`;
  }
  if (ageDays < 30) {
    return `Updated ${Math.floor(ageDays / 7)}w ago`;
  }
  return `Updated ${Math.floor(ageDays / 30)}mo ago`;
}

export function annotateSkills(
  skills: SkillCard[],
  memoryContent: string,
  sessions: SessionCard[],
): SkillInsight[] {
  const memoryTerms = new Set(uniqueTerms(memoryContent));
  const sessionTerms = new Set(
    sessions.flatMap((session) =>
      uniqueTerms(`${session.title} ${session.preview}`),
    ),
  );

  return skills.map((skill) => {
    const skillTerms = uniqueTerms(`${skill.title} ${skill.summary}`);
    const matchedTerms = skillTerms
      .filter((term) => memoryTerms.has(term) || sessionTerms.has(term))
      .slice(0, 4);
    const memoryHits = countHits(skillTerms, memoryTerms);
    const sessionHits = countHits(skillTerms, sessionTerms);
    const score = memoryHits * 2 + sessionHits;

    let signal = "Visible in the library, but not yet linked to recent context.";
    if (memoryHits > 0 && sessionHits > 0) {
      signal = "Connected to both memory and recent sessions.";
    } else if (memoryHits > 0) {
      signal = "Linked to persisted memory.";
    } else if (sessionHits > 0) {
      signal = "Echoed in recent session history.";
    }

    return {
      skill,
      memoryHits,
      sessionHits,
      matchedTerms,
      score,
      freshnessLabel: freshnessLabel(skill.last_updated),
      signal,
    };
  });
}
