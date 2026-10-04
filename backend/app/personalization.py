from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

from faster_whisper import WhisperModel

from app.schemas import ClipPrediction


@dataclass
class WordTimestamp:
    word: str
    start: float
    end: float


class SpeechPersonalizer:
    """
    Handles optional speech personalization.

    Pipeline:

        audio
            -> Whisper transcription
            -> word timestamps
            -> overlap with Wav2Vec2 analysis windows
            -> candidate target words
            -> personalized exercise

    Word-level localization is heuristic because the Wav2Vec2 model
    predicts at clip level rather than exact word level.
    """

    def __init__(
        self,
        model_size: str,
        device: str,
        compute_type: str,
    ):
        self.model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
        )

    def transcribe(
        self,
        wav_path: Path,
    ) -> list[WordTimestamp]:
        """
        Transcribe audio and return word-level timestamps.
        """

        segments, _info = self.model.transcribe(
            str(wav_path),
            word_timestamps=True,
            vad_filter=True,
        )

        words: list[WordTimestamp] = []

        for segment in segments:
            if not segment.words:
                continue

            for word in segment.words:
                text = (word.word or "").strip()

                if not text:
                    continue

                # Remove surrounding punctuation.
                cleaned = re.sub(
                    r"^[^\w'-]+|[^\w'-]+$",
                    "",
                    text,
                )

                if not cleaned:
                    continue

                words.append(
                    WordTimestamp(
                        word=cleaned,
                        start=float(word.start),
                        end=float(word.end),
                    )
                )

        return words

    def find_target_words(
        self,
        words: list[WordTimestamp],
        clips: list[ClipPrediction],
    ) -> list[WordTimestamp]:
        """
        Find candidate difficult words by checking which transcript words
        overlap with non-fluent Wav2Vec2 analysis windows.

        This is a heuristic, not word-level ground truth.
        """

        candidates: dict[str, dict] = {}

        for word in words:
            overlapping = []

            for clip in clips:
                overlap = min(
                    word.end,
                    clip.end_seconds,
                ) - max(
                    word.start,
                    clip.start_seconds,
                )

                if overlap <= 0:
                    continue

                # Only use windows classified as non-fluent.
                if not clip.fluent:
                    overlapping.append(clip)

            if not overlapping:
                continue

            word_key = word.word.lower()

            # Ignore very short words/fragments.
            if len(word_key) < 4:
                continue

            scores = []

            for clip in overlapping:
                score = (
                    0.6 * (clip.severity_score / 100.0)
                    + 0.4 * (1.0 - clip.fluency_confidence)
                )

                scores.append(score)

            evidence_count = len(overlapping)
            average_score = sum(scores) / len(scores)

            existing = candidates.get(word_key)

            if existing is None:
                candidates[word_key] = {
                    "word": word.word,
                    "score": average_score,
                    "evidence_count": evidence_count,
                    "start": word.start,
                    "end": word.end,
                }
            else:
                existing["score"] = max(
                    existing["score"],
                    average_score,
                )

                existing["evidence_count"] += evidence_count

        ranked = sorted(
            candidates.values(),
            key=lambda item: (
                item["evidence_count"],
                item["score"],
            ),
            reverse=True,
        )

        result: list[WordTimestamp] = []

        for item in ranked[:5]:
            timestamp = WordTimestamp(
                word=item["word"],
                start=item["start"],
                end=item["end"],
            )

            # Attach metadata used by inference.py.
            timestamp.score = round(
                float(item["score"]),
                4,
            )

            timestamp.evidence_count = int(
                item["evidence_count"]
            )

            result.append(timestamp)

        return result
    
    def _generate_syllable_items_local(self,target_words: list[str]) -> list[str]:
        """
    Generate simple syllable practice items locally.

    This is a heuristic fallback. It is not intended to be
    phonological ground truth.
    """
    
        import re

        items: list[str] = []

        for word in target_words:
            clean = re.sub(r"[^a-zA-Z]", "", word.lower())

            if not clean:
                continue

            matches = re.findall(
                r"[^aeiouy]*[aeiouy]+(?:[^aeiouy]+(?=$|[^aeiouy]))?",
                clean,
            )

            syllables = [
                syllable.strip()
                for syllable in matches
                if syllable.strip()
            ]

            # Only use this for genuinely multi-syllable words.
            # Monosyllabic words will fall back to the static catalogue.
            if len(syllables) > 1:
                items.extend(syllables)

        # Remove duplicates while preserving order.
        return list(dict.fromkeys(items))

    def generate_exercise(
        self,
        targets: list[WordTimestamp],
        personalization_history: list[dict] | None = None,
    ) -> dict:
        """
        Generate an adaptive personalized exercise.

        Recent personalization history is used to:
        - avoid blindly repeating previous target words
        - avoid repeating previous passages
        - give the LLM context about previous practice
        - make the local fallback vary between sessions

        If OPENAI_API_KEY is unavailable, a deterministic local fallback
        is used so the application continues working.
        """

        history = personalization_history or []

        current_target_words = [
            word.word.strip()
            for word in targets[:5]
            if word.word.strip()
        ]

        if not current_target_words:
            return {
                "title": "Personalized Speech Practice",
                "text": (
                    "Read this short passage slowly and clearly. "
                    "Keep your speaking pace comfortable and focus "
                    "on smooth transitions between words."
                ),
                "target_words": [],
            }

        # ---------------------------------------------------------
        # Build useful information from previous sessions
        # ---------------------------------------------------------

        previous_target_words: list[str] = []
        previous_passages: list[str] = []

        for item in history[-5:]:
            if not isinstance(item, dict):
                continue

            words = item.get("targetWords", [])

            if isinstance(words, list):
                for word in words:
                    if isinstance(word, str) and word.strip():
                        previous_target_words.append(
                            word.strip()
                        )

            passage = item.get("personalizedText")

            if isinstance(passage, str) and passage.strip():
                previous_passages.append(
                    passage.strip()
                )

        previous_word_set = {
            word.lower()
            for word in previous_target_words
        }

        # Prefer newly detected words, while keeping current targets
        # available when they are the only useful candidates.
        fresh_target_words = [
            word
            for word in current_target_words
            if word.lower() not in previous_word_set
        ]

        if fresh_target_words:
            target_words = fresh_target_words[:5]
        else:
            target_words = current_target_words[:5]

        # ---------------------------------------------------------
        # OpenAI / LangChain generation
        # ---------------------------------------------------------

        api_key = os.getenv("OPENAI_API_KEY")

        if api_key:
            try:
                return self._generate_with_llm(
                    target_words=target_words,
                    previous_target_words=previous_target_words,
                    previous_passages=previous_passages,
                    history=history,
                )
            except Exception:
                # Never break speech analysis because LLM failed.
                pass

        # ---------------------------------------------------------
        # Local fallback
        # ---------------------------------------------------------

        return self._generate_local_fallback(
            target_words=target_words,
            previous_target_words=previous_target_words,
            previous_passages=previous_passages,
        )
    def generate_syllable_exercise(
    self,
    target_words: list[str],
) -> list[str]:
        """
        Generate personalized syllable practice items.

        Currently uses the local heuristic fallback.
        OpenAI generation will be added here later.

        Monosyllabic words are ignored so that Syllable Practice
        remains different from Word Repetition.
        """

        target_words = [
            word.strip()
            for word in target_words
            if isinstance(word, str) and word.strip()
        ]

        if not target_words:
            return []

        return self._generate_syllable_items_local(target_words)
    def _generate_local_fallback(
        self,
        *,
        target_words: list[str],
        previous_target_words: list[str],
        previous_passages: list[str],
    ) -> dict:
        """
        Local deterministic fallback.

        It changes the exercise wording when previous sessions exist
        instead of returning exactly the same template every time.
        """

        count = len(target_words)
        has_history = bool(
            previous_target_words or previous_passages
        )

        if count == 1:
            word = target_words[0]

            if has_history:
                text = (
                    f"I would like to practice the word {word} today. "
                    f"I will use {word} in a simple sentence and keep "
                    "my voice calm and steady. "
                    "I will pause naturally and continue at a comfortable pace."
                )
            else:
                text = (
                    f"Today I want to talk about {word}. "
                    f"I will say {word} slowly and clearly. "
                    "I will keep my pace comfortable and focus on smooth speech."
                )

        elif count == 2:
            first = target_words[0]
            second = target_words[1]

            if has_history:
                text = (
                    f"Today I am practicing {first} and {second}. "
                    f"I will begin with {first} in a short sentence, "
                    f"then move naturally to {second}. "
                    "I will keep my breathing relaxed and my speaking pace steady."
                )
            else:
                text = (
                    f"Today I want to talk about {first} "
                    f"and {second}. "
                    f"I will say {first} clearly and then "
                    f"continue naturally to {second}. "
                    "I will keep my sentences short and my speaking pace steady."
                )

        else:
            selected = target_words[:5]

            if len(selected) == 3:
                if has_history:
                    text = (
                        f"I am practicing {selected[0]}, {selected[1]}, "
                        f"and {selected[2]} today. "
                        f"I will use {selected[0]} first, then {selected[1]}, "
                        f"and finally {selected[2]}. "
                        "I will speak calmly and connect each sentence naturally."
                    )
                else:
                    text = (
                        f"Today I practiced {selected[0]}, {selected[1]}, "
                        f"and {selected[2]}. "
                        f"I said {selected[0]} clearly and then moved naturally "
                        f"to {selected[1]}. "
                        f"I finished by using {selected[2]} in a complete sentence. "
                        "I kept my sentences short and my speaking pace steady."
                    )

            elif len(selected) == 4:
                if has_history:
                    text = (
                        f"Today I am working with {selected[0]}, {selected[1]}, "
                        f"{selected[2]}, and {selected[3]}. "
                        f"I will start with {selected[0]} and {selected[1]}, "
                        f"then use {selected[2]} and {selected[3]} naturally. "
                        "I will keep a relaxed and steady rhythm."
                    )
                else:
                    text = (
                        f"Today I practiced {selected[0]}, {selected[1]}, "
                        f"{selected[2]}, and {selected[3]}. "
                        f"I focused first on {selected[0]} and {selected[1]}, "
                        f"then continued naturally with {selected[2]}. "
                        f"I finished by using {selected[3]} in a complete sentence. "
                        "I kept my speaking pace steady."
                    )

            else:
                if has_history:
                    text = (
                        f"Today I am practicing {selected[0]}, {selected[1]}, "
                        f"{selected[2]}, {selected[3]}, and {selected[4]}. "
                        f"I will begin with {selected[0]} and {selected[1]}, "
                        f"then continue with {selected[2]} and {selected[3]}. "
                        f"I will finish with {selected[4]} and keep my rhythm natural."
                    )
                else:
                    text = (
                        f"Today I practiced {selected[0]}, {selected[1]}, "
                        f"{selected[2]}, {selected[3]}, and {selected[4]}. "
                        f"I focused on {selected[0]} and {selected[1]} first. "
                        f"Then I practiced {selected[2]} and {selected[3]} "
                        f"before using {selected[4]} in a complete sentence. "
                        "I kept my sentences short and my speaking pace steady."
                    )

        return {
            "title": "Personalized Speech Practice",
            "text": text,
            "target_words": target_words[:5],
        }

    def _generate_with_llm(
        self,
        *,
        target_words: list[str],
        previous_target_words: list[str],
        previous_passages: list[str],
        history: list[dict],
    ) -> dict:
        """
        Generate a natural adaptive personalized passage using
        LangChain + OpenAI.

        This function is only called when OPENAI_API_KEY exists.
        """

        from langchain_core.prompts import ChatPromptTemplate
        from langchain_openai import ChatOpenAI
        from pydantic import BaseModel, Field

        class PersonalizedExerciseOutput(BaseModel):
            title: str = Field(
                description="Short title for the speech practice exercise."
            )

            text: str = Field(
                description="A natural 40-80 word passage for reading aloud."
            )

            target_words: list[str] = Field(
                description="Target words naturally used in the passage."
            )

        model_name = os.getenv(
            "OPENAI_MODEL",
            "gpt-6-luna",
        )

        llm = ChatOpenAI(
            model=model_name,
            temperature=0.4,
            api_key=os.environ["OPENAI_API_KEY"],
        )

        recent_history = history[-5:]

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    """
You create supportive and adaptive speech-practice reading passages.

Rules:

- This is a practice aid, not a clinical diagnosis or treatment.
- Write natural, grammatically correct English.
- Use the supplied current target words naturally.
- Never force a target word into an unnatural sentence.
- Prefer simple vocabulary and short sentences.
- Write 3 to 5 sentences.
- Aim for roughly 40 to 80 words.
- Do not mention AI, stuttering, disfluency, model predictions,
  mistakes, or speech analysis inside the passage.
- Do not criticize or judge the user.
- Make the passage comfortable to read aloud.
- Avoid copying any previous passage.
- If previous target words are supplied, prefer the newly detected
  current target words when possible.
- Make the new passage meaningfully different from previous exercises.
- Keep the exercise appropriate for repeated reading practice.
""",
                ),
                (
                    "human",
                    """
Create the next personalized reading exercise.

Current target words:
{target_words}

Previously used target words:
{previous_target_words}

Previous passages:
{previous_passages}

Recent session context:
{history}

Use the current target words as the main focus.

Do not simply rewrite a previous passage.
Create a fresh, natural passage that feels like the next exercise
in an ongoing personalized practice program.
""",
                ),
            ]
        )

        chain = prompt | llm.with_structured_output(
            PersonalizedExerciseOutput
        )

        result = chain.invoke(
            {
                "target_words": ", ".join(target_words),
                "previous_target_words": ", ".join(
                    previous_target_words[-15:]
                ),
                "previous_passages": "\n---\n".join(
                    previous_passages[-5:]
                ),
                "history": str(recent_history),
            }
        )

        return {
            "title": result.title,
            "text": result.text,
            "target_words": result.target_words,
        }