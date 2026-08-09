import type { ReadingPassage } from "@/types";

export const slowReadingPassages: ReadingPassage[] = [
  {
    id: "sr-morning",
    title: "A Slow Morning",
    kind: "paragraph",
    difficulty: "beginner",
    sentences: [
      "The morning light came in through the window.",
      "I sat down and took a long, slow breath.",
      "There was no reason to hurry today.",
      "Each word could take as much time as it needed.",
      "I read one line, then paused, then read the next.",
    ],
  },
  {
    id: "sr-river",
    title: "The River Path",
    kind: "paragraph",
    difficulty: "intermediate",
    sentences: [
      "The path beside the river was narrow and quiet.",
      "Water moved over the stones without effort or noise.",
      "A slow current still reaches the sea before a rushed one loses its way.",
      "I matched my breathing to the sound of the water.",
      "By the time I reached the bridge, my shoulders had dropped.",
      "Speaking, I thought, could feel like this too.",
    ],
  },
  {
    id: "sr-workshop",
    title: "The Workshop",
    kind: "paragraph",
    difficulty: "advanced",
    sentences: [
      "In the workshop, every tool had a place on the wall.",
      "The carpenter measured twice, marked the line, and only then reached for the saw.",
      "Precision, he explained, is not the enemy of speed; impatience is.",
      "He handed me a plane and told me to take one long, even stroke.",
      "The shaving curled away in a single unbroken ribbon.",
      "That ribbon, he said, is what a good sentence sounds like.",
    ],
  },
];

export const loudReadingPassages: ReadingPassage[] = [
  {
    id: "lr-lighthouse",
    title: "The Lighthouse Keeper",
    kind: "story",
    difficulty: "beginner",
    sentences: [
      "The keeper climbed the stairs every evening at six.",
      "He lit the lamp and watched it turn.",
      "Ships far out at sea could see the light.",
      "He never met the sailors he helped.",
      "Still, he climbed the stairs every evening at six.",
    ],
  },
  {
    id: "lr-quotes",
    title: "Quotes to Speak Aloud",
    kind: "quote",
    difficulty: "beginner",
    sentences: [
      "Speak clearly, if you speak at all.",
      "Courage is not the absence of fear, but the decision to speak anyway.",
      "The voice you practise with today is the voice you will trust tomorrow.",
      "Slow is smooth, and smooth is fast.",
    ],
  },
  {
    id: "lr-article",
    title: "How Breathing Shapes Speech",
    kind: "article",
    difficulty: "intermediate",
    sentences: [
      "Speech is built on a moving column of air.",
      "When the breath is shallow, the voice runs out before the sentence does.",
      "Speakers then push harder from the throat, which tightens everything above it.",
      "A low, steady breath from the diaphragm gives the voice a longer runway.",
      "This is why almost every speech programme begins with breathing, not with words.",
      "Practise the breath first, and the words follow it more easily.",
    ],
  },
  {
    id: "lr-market",
    title: "The Night Market",
    kind: "story",
    difficulty: "advanced",
    sentences: [
      "By nine o'clock the market was at its loudest, and every stall was competing for the same ears.",
      "A woman selling roasted corn had learned something the others had not.",
      "Instead of shouting over the noise, she spoke underneath it, low and unhurried.",
      "People leaned in to hear her, and leaning in, they stayed.",
      "Volume, she knew, buys attention for a second; rhythm keeps it for a minute.",
      "She sold out every night while the shouting stalls packed up half full.",
    ],
  },
];

export const tongueTwisters: ReadingPassage[] = [
  {
    id: "tt-easy",
    title: "Easy Twisters",
    kind: "tongue_twister",
    difficulty: "beginner",
    sentences: [
      "Big black bug.",
      "Red lorry, yellow lorry.",
      "Six slim snakes.",
      "Toy boat, toy boat.",
    ],
  },
  {
    id: "tt-medium",
    title: "Medium Twisters",
    kind: "tongue_twister",
    difficulty: "intermediate",
    sentences: [
      "Peter Piper picked a peck of pickled peppers.",
      "She sells sea shells by the sea shore.",
      "A proper copper coffee pot.",
      "Unique New York, unique New York.",
    ],
  },
];
