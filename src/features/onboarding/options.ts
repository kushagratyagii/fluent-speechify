import type {
  Gender,
  Goal,
  Severity,
  SpeakingSituation,
  SpeechDifficulty,
} from "@/types";

export const DIFFICULTY_OPTIONS: {
  value: SpeechDifficulty;
  label: string;
  hint: string;
}[] = [
  {
    value: "stammering",
    label: "Stammering",
    hint: "Repeats, blocks or stuck sounds",
  },
  {
    value: "cluttering",
    label: "Cluttering",
    hint: "Speech runs too fast or merges together",
  },
  {
    value: "pronunciation",
    label: "Pronunciation issues",
    hint: "Certain sounds come out unclear",
  },
  { value: "lisp", label: "Lisp", hint: "S and Z sounds are distorted" },
  {
    value: "slow_speech",
    label: "Slow speech",
    hint: "Words take effort to get out",
  },
  {
    value: "confidence",
    label: "Speech confidence",
    hint: "Speech is fine alone but hard with others",
  },
];

export const SEVERITY_OPTIONS: {
  value: Severity;
  label: string;
  hint: string;
}[] = [
  { value: "mild", label: "Mild", hint: "Noticeable to me, rarely to others" },
  {
    value: "moderate",
    label: "Moderate",
    hint: "Affects some conversations most days",
  },
  {
    value: "severe",
    label: "Severe",
    hint: "Affects most conversations every day",
  },
];

export const SITUATION_OPTIONS: {
  value: SpeakingSituation;
  label: string;
  emoji: string;
}[] = [
  { value: "family", label: "Family", emoji: "🏠" },
  { value: "friends", label: "Friends", emoji: "🙌" },
  { value: "phone_calls", label: "Phone calls", emoji: "📞" },
  { value: "office", label: "Office", emoji: "💼" },
  { value: "interviews", label: "Interviews", emoji: "🎯" },
  { value: "public_speaking", label: "Public speaking", emoji: "🎤" },
];

export const GOAL_OPTIONS: { value: Goal; label: string; emoji: string }[] = [
  { value: "speak_fluently", label: "Speak more fluently", emoji: "🌊" },
  { value: "reduce_stammering", label: "Reduce stammering", emoji: "🎚️" },
  { value: "improve_confidence", label: "Improve confidence", emoji: "✨" },
  { value: "better_pronunciation", label: "Better pronunciation", emoji: "🗣️" },
  { value: "prepare_interviews", label: "Prepare for interviews", emoji: "📋" },
];

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export const LANGUAGE_OPTIONS = [
  "English",
  "Hindi",
  "Bengali",
  "Marathi",
  "Tamil",
  "Telugu",
  "Gujarati",
  "Kannada",
  "Malayalam",
  "Punjabi",
  "Urdu",
  "Spanish",
  "French",
  "German",
  "Arabic",
  "Portuguese",
  "Mandarin",
  "Other",
];

export const COUNTRY_OPTIONS = [
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Spain",
  "Brazil",
  "Nigeria",
  "South Africa",
  "Singapore",
  "United Arab Emirates",
  "Other",
];
