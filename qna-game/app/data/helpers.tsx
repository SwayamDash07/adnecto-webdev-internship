import { Question } from "./questions";

export function pickRandomQuestions(pool: Question[], count: number): Question[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}