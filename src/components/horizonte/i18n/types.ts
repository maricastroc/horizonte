import type { AxisReading, CompareAxis, Question, QuestionPart } from "../anatomy";

export interface Phrasing {
  ask: string;
  answer: string;
  what: string | null;
  label: string;
  result: string;
}

export interface AnatomyWriter {
  phrase(q: Question): Phrasing;
  measure: Record<CompareAxis, string>;
  shown(axis: CompareAxis, value: number): string;
  standing(r: AxisReading): string;
  drawn: Record<QuestionPart, string>;
  nameFact(weight: number): string;
  colourNote: string;
}
