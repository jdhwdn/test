export type TriviaQuestion = { id: string; prompt: string; options: string[]; correctIndex: number };
export type PendingTrivia = { guildId: string; actorId: string; question: TriviaQuestion; expiresAt: number };

export const triviaQuestions: TriviaQuestion[] = [
  { id: "water", prompt: "ما الاسم الشائع للمركب الكيميائي H₂O؟", options: ["الأكسجين", "الماء", "الملح", "الحديد"], correctIndex: 1 },
  { id: "planet", prompt: "ما أكبر كوكب في مجموعتنا الشمسية؟", options: ["الأرض", "المريخ", "المشتري", "زحل"], correctIndex: 2 },
  { id: "saudi-capital", prompt: "ما عاصمة المملكة العربية السعودية؟", options: ["الرياض", "جدة", "الدمام", "المدينة"], correctIndex: 0 },
  { id: "week", prompt: "كم يوماً في الأسبوع؟", options: ["خمسة", "ستة", "سبعة", "ثمانية"], correctIndex: 2 },
];

export function selectTriviaQuestion(seed: string) {
  const hash = Array.from(seed).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
  return triviaQuestions[hash % triviaQuestions.length];
}

export function assessTriviaAnswer(input: { pending?: PendingTrivia; guildId: string; actorId: string; optionIndex: number; now: number }) {
  if (!input.pending || input.pending.guildId !== input.guildId) return { allowed: false as const, reason: "not_found" as const };
  if (input.pending.actorId !== input.actorId) return { allowed: false as const, reason: "not_owner" as const };
  if (input.pending.expiresAt <= input.now) return { allowed: false as const, reason: "expired" as const };
  if (!Number.isInteger(input.optionIndex) || input.optionIndex < 0 || input.optionIndex >= input.pending.question.options.length) return { allowed: false as const, reason: "invalid_option" as const };
  return { allowed: true as const, correct: input.optionIndex === input.pending.question.correctIndex, answer: input.pending.question.options[input.pending.question.correctIndex] };
}
