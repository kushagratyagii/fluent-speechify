import type { Exercise, ExerciseCategory } from "@/types";
import {
  loudReadingPassages,
  slowReadingPassages,
  tongueTwisters,
} from "./passages";

export const exerciseCategories: ExerciseCategory[] = [
  {
    id: "breathing",
    name: "Breathing",
    description: "Build the steady airflow that speech sits on.",
    accent: "sky",
    icon: "Wind",
  },
  {
    id: "relaxation",
    name: "Relaxation",
    description: "Release tension in the jaw, tongue, lips and neck.",
    accent: "violet",
    icon: "Waves",
  },
  {
    id: "sound_practice",
    name: "Sound Practice",
    description: "Shape individual syllables and difficult sounds.",
    accent: "amber",
    icon: "AudioLines",
  },
  {
    id: "reading",
    name: "Reading Practice",
    description: "Read aloud at a controlled, deliberate pace.",
    accent: "emerald",
    icon: "BookOpen",
  },
  {
    id: "confidence",
    name: "Confidence",
    description: "Watch, hear and trust your own delivery.",
    accent: "rose",
    icon: "Sparkles",
  },
  {
    id: "oral_motor",
    name: "Oral Motor",
    description: "Strengthen the muscles that form each sound.",
    accent: "orange",
    icon: "Smile",
  },
  {
    id: "fluency_shaping",
    name: "Fluency Shaping",
    description: "Easy onsets, light contact and continuous phonation.",
    accent: "cyan",
    icon: "Activity",
  },
  {
    id: "speaking",
    name: "Speaking Practice",
    description: "Rehearse real conversations before you have them.",
    accent: "indigo",
    icon: "MessagesSquare",
  },
];

/**
 * Phase 1 ships eight fully playable exercises. Entries marked `phase: 2`
 * are listed in the library as previews so the catalogue shape is already
 * correct when the later phases land.
 */
export const exercises: Exercise[] = [
  {
    id: "ex-deep-breathing",
    slug: "deep-breathing",
    title: "Deep Breathing",
    summary:
      "Follow an animated circle through inhale, hold and exhale to settle your breath.",
    categoryId: "breathing",
    player: "breathing",
    baseXp: 20,
    phase: 1,
    instructions: [
      "Sit upright with both feet flat on the floor.",
      "Breathe in through your nose as the circle grows.",
      "Hold gently — do not clamp your throat shut.",
      "Breathe out through your mouth as the circle shrinks.",
    ],
    difficulties: {
      beginner: {
        durationSeconds: 120,
        pattern: { inhale: 4, hold: 2, exhale: 4 },
      },
      intermediate: {
        durationSeconds: 180,
        pattern: { inhale: 4, hold: 4, exhale: 6 },
      },
      advanced: {
        durationSeconds: 300,
        pattern: { inhale: 5, hold: 5, exhale: 8, holdOut: 2 },
      },
    },
  },
  {
    id: "ex-diaphragmatic-breathing",
    slug: "diaphragmatic-breathing",
    title: "Diaphragmatic Breathing",
    summary:
      "Guided belly breathing with a countdown for each stage of the exercise.",
    categoryId: "breathing",
    player: "guided",
    baseXp: 20,
    phase: 1,
    instructions: [
      "Place one hand on your chest and one on your belly.",
      "The belly hand should move; the chest hand should stay still.",
      "Keep the exhale longer than the inhale.",
    ],
    difficulties: {
      beginner: { durationSeconds: 150 },
      intermediate: { durationSeconds: 240 },
      advanced: { durationSeconds: 330 },
    },
    content: {
      steps: [
        {
          label: "Settle",
          seconds: 30,
          detail:
            "Sit or lie down. Rest one hand on your chest, one on your belly. Breathe normally and just notice which hand moves.",
        },
        {
          label: "Find the belly breath",
          seconds: 45,
          detail:
            "Breathe in slowly through the nose and aim the air low, so the belly hand rises first. The chest hand stays quiet.",
        },
        {
          label: "Lengthen the exhale",
          seconds: 60,
          detail:
            "Breathe out through slightly pursed lips for about twice as long as you breathed in. Let the belly fall on its own.",
        },
        {
          label: "Add a held tone",
          seconds: 60,
          detail:
            "On each exhale, add a soft, easy 'aah'. Keep it quiet and continuous — no push from the throat.",
        },
        {
          label: "Rest and notice",
          seconds: 45,
          detail:
            "Return to normal breathing. Notice the difference in your shoulders, jaw and throat.",
        },
      ],
      tips: [
        "If you feel light-headed, slow down and breathe less deeply.",
        "Lying on your back makes the belly movement easier to feel.",
      ],
    },
  },
  {
    id: "ex-slow-reading",
    slug: "slow-reading",
    title: "Slow Reading",
    summary:
      "Read paragraphs aloud with sentence highlighting at a speed you control.",
    categoryId: "reading",
    player: "reading",
    baseXp: 25,
    phase: 1,
    instructions: [
      "Read the highlighted sentence aloud, no faster than the highlight moves.",
      "Pause fully at the end of each sentence before the next one starts.",
      "Slow the pace down if you feel yourself rushing.",
    ],
    difficulties: {
      beginner: { durationSeconds: 180, wpm: 80 },
      intermediate: { durationSeconds: 240, wpm: 110 },
      advanced: { durationSeconds: 300, wpm: 140 },
    },
    content: { passages: slowReadingPassages },
  },
  {
    id: "ex-syllable-practice",
    slug: "syllable-practice",
    title: "Syllable Practice",
    summary: "Repeat single syllables with an easy onset and a steady rhythm.",
    categoryId: "sound_practice",
    player: "repetition",
    baseXp: 15,
    phase: 1,
    instructions: [
      "Start each syllable gently — ease into the sound rather than punching it.",
      "Keep the vowel long and even.",
      "Match the on-screen rhythm; do not race ahead of it.",
    ],
    difficulties: {
      beginner: { durationSeconds: 120, itemSeconds: 6, reps: 3 },
      intermediate: { durationSeconds: 180, itemSeconds: 5, reps: 4 },
      advanced: { durationSeconds: 240, itemSeconds: 4, reps: 5 },
    },
    content: {
      items: ["Pa", "Ta", "Ka", "Ma", "Sa", "La", "Ba", "Da"],
      tips: ["Keep your jaw loose between repetitions."],
    },
  },
  {
    id: "ex-word-repetition",
    slug: "word-repetition",
    title: "Word Repetition",
    summary:
      "Say multi-syllable words slowly and completely, one at a time.",
    categoryId: "sound_practice",
    player: "repetition",
    baseXp: 15,
    phase: 1,
    instructions: [
      "Say the whole word before moving on — do not clip the ending.",
      "If a word blocks, pause, breathe out, and start it again softly.",
    ],
    difficulties: {
      beginner: { durationSeconds: 120, itemSeconds: 7, reps: 3 },
      intermediate: { durationSeconds: 180, itemSeconds: 6, reps: 3 },
      advanced: { durationSeconds: 240, itemSeconds: 5, reps: 4 },
    },
    content: {
      items: [
        "People",
        "Perfect",
        "Tomorrow",
        "Beautiful",
        "School",
        "Particular",
        "Statistics",
        "Comfortable",
      ],
    },
  },
  {
    id: "ex-mirror-practice",
    slug: "mirror-practice",
    title: "Mirror Practice",
    summary:
      "Use your front camera as a mirror and watch how your lips and jaw move.",
    categoryId: "confidence",
    player: "mirror",
    baseXp: 20,
    phase: 1,
    instructions: [
      "Nothing is recorded or uploaded — the camera feed stays in your browser.",
      "Watch your lips, jaw and shoulders while you speak.",
      "Speak the prompt aloud, then say it again with softer starts.",
    ],
    difficulties: {
      beginner: { durationSeconds: 120 },
      intermediate: { durationSeconds: 180 },
      advanced: { durationSeconds: 240 },
    },
    content: {
      items: [
        "Hello, my name is …",
        "Today I want to talk about something I enjoy.",
        "Could you tell me where the nearest station is?",
        "I would like to book a table for two, please.",
        "Thank you for your time — I appreciate it.",
      ],
      tips: [
        "Camera access is optional. You can run this in front of a real mirror instead.",
      ],
    },
  },
  {
    id: "ex-loud-reading",
    slug: "loud-reading",
    title: "Loud Reading",
    summary:
      "Read stories, quotes and articles aloud at a comfortable volume.",
    categoryId: "reading",
    player: "reading",
    baseXp: 25,
    phase: 1,
    instructions: [
      "Project from the breath, not the throat.",
      "Keep the volume steady from the first word to the last.",
      "Take a full breath at every full stop.",
    ],
    difficulties: {
      beginner: { durationSeconds: 180, wpm: 100 },
      intermediate: { durationSeconds: 240, wpm: 130 },
      advanced: { durationSeconds: 300, wpm: 160 },
    },
    content: { passages: [...loudReadingPassages, ...tongueTwisters] },
  },
  {
    id: "ex-relaxation",
    slug: "relaxation-exercises",
    title: "Relaxation Exercises",
    summary:
      "A guided sequence releasing the jaw, tongue, lips and neck before speaking.",
    categoryId: "relaxation",
    player: "guided",
    baseXp: 15,
    phase: 1,
    instructions: [
      "Move slowly and stop short of any pain.",
      "Let each area go completely slack between movements.",
    ],
    difficulties: {
      beginner: { durationSeconds: 120 },
      intermediate: { durationSeconds: 200 },
      advanced: { durationSeconds: 280 },
    },
    content: {
      steps: [
        {
          label: "Jaw relaxation",
          seconds: 50,
          detail:
            "Let your jaw hang open a couple of centimetres. Move it gently side to side, then let it drop again. Do not clench.",
        },
        {
          label: "Tongue relaxation",
          seconds: 50,
          detail:
            "Rest the tongue tip behind your lower teeth. Stretch it forward slowly, then let it fall flat and heavy in the mouth.",
        },
        {
          label: "Lip relaxation",
          seconds: 50,
          detail:
            "Blow a soft lip trill — a 'brrr' — and let the lips flap loosely. Then round them, spread them, and release.",
        },
        {
          label: "Neck relaxation",
          seconds: 50,
          detail:
            "Drop your chin towards your chest. Roll slowly to one shoulder, back to centre, then to the other. Keep the shoulders down.",
        },
        {
          label: "Easy onset check",
          seconds: 40,
          detail:
            "With everything loose, say a quiet 'haaa'. It should start with air, not a click.",
        },
      ],
    },
  },

  // ── Phase 2 preview entries ────────────────────────────────────────────
  {
    id: "ex-vowel-practice",
    slug: "vowel-practice",
    title: "Vowel Practice",
    summary: "Sustain A, E, I, O, U with continuous phonation.",
    categoryId: "sound_practice",
    player: "repetition",
    baseXp: 15,
    phase: 2,
    instructions: ["Hold each vowel for the full count without breaking tone."],
    difficulties: {
      beginner: { durationSeconds: 120, itemSeconds: 8, reps: 2 },
      intermediate: { durationSeconds: 180, itemSeconds: 8, reps: 3 },
      advanced: { durationSeconds: 240, itemSeconds: 10, reps: 3 },
    },
    content: { items: ["A", "E", "I", "O", "U"] },
  },
  {
    id: "ex-tongue-twisters",
    slug: "tongue-twisters",
    title: "Tongue Twisters",
    summary: "Accuracy first, speed later.",
    categoryId: "reading",
    player: "reading",
    baseXp: 20,
    phase: 2,
    instructions: ["Read it correctly three times before reading it quickly."],
    difficulties: {
      beginner: { durationSeconds: 120, wpm: 70 },
      intermediate: { durationSeconds: 180, wpm: 100 },
      advanced: { durationSeconds: 240, wpm: 130 },
    },
    content: { passages: tongueTwisters },
  },
  {
    id: "ex-conversation-practice",
    slug: "conversation-practice",
    title: "Conversation Practice",
    summary: "Rehearse introductions, phone calls and interviews.",
    categoryId: "speaking",
    player: "mirror",
    baseXp: 30,
    phase: 2,
    instructions: ["Speak as if the other person is really there."],
    difficulties: {
      beginner: { durationSeconds: 180 },
      intermediate: { durationSeconds: 300 },
      advanced: { durationSeconds: 420 },
    },
    content: {
      items: [
        "Self introduction",
        "Ordering food",
        "Phone calls",
        "Interview practice",
        "Shopping",
        "Doctor visit",
        "Travel",
      ],
    },
  },
];

export const activeExercises = exercises.filter((e) => e.phase === 1);

export function getExerciseBySlug(slug: string): Exercise | undefined {
  return exercises.find((e) => e.slug === slug);
}

export function getExerciseById(id: string): Exercise | undefined {
  return exercises.find((e) => e.id === id);
}

export function getCategory(id: string): ExerciseCategory | undefined {
  return exerciseCategories.find((c) => c.id === id);
}
