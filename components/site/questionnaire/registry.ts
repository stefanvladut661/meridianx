import type { QuestionnaireConfig } from "./types";
import { DIANA_FILIP } from "./diana-filip";

/** Chestionarele active, după slug: /chestionar/<slug>. */
export const QUESTIONNAIRES: Record<string, QuestionnaireConfig> = {
  [DIANA_FILIP.slug]: DIANA_FILIP,
};

export const QUESTIONNAIRE_SLUGS = Object.keys(QUESTIONNAIRES);

export function getQuestionnaire(slug: string): QuestionnaireConfig | null {
  return Object.prototype.hasOwnProperty.call(QUESTIONNAIRES, slug)
    ? QUESTIONNAIRES[slug]
    : null;
}

/** Liniuța pe care o pune câmpul la fiecare rând nou. */
export const DASH = "– ";

/**
 * Răspunsul curățat: fără rândurile rămase doar cu liniuță și fără spații
 * la capete. Aceeași funcție pe client (verificare, copiere) și pe server
 * (email, lead), ca să nu difere ce vede omul de ce primim noi.
 */
export function cleanAnswer(value: string): string {
  return value
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => line.replace(/^[\s–-]+/, "") !== "")
    .join("\n")
    .trim();
}

/** Textul complet al răspunsurilor, pentru email, lead și copiere. */
export function answersAsText(
  config: QuestionnaireConfig,
  answers: Record<string, string>
): string {
  const blocks: string[] = [];
  config.questions.forEach((question, index) => {
    const answer = cleanAnswer(answers[question.id] ?? "");
    if (!answer) return;
    blocks.push(`${index + 1}. ${question.title}\n${answer}`);
  });
  return blocks.join("\n\n");
}
