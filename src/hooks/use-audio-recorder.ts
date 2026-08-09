"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "stopped"
  | "denied"
  | "unsupported"
  | "error";

/** Prefers opus in a webm container (what the backend's ffmpeg decode step
 * is tested against); falls back to whatever the browser supports so this
 * still works on Safari, which doesn't ship webm/opus recording. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Records microphone audio for the duration of an exercise session.
 *
 * Mirrors the permission-handling shape of MirrorPlayer's camera hook:
 * request on start, release every track on stop/unmount, and treat denial
 * as a normal state to render around rather than an error to throw.
 *
 * Unlike the camera, this audio IS uploaded (to the analysis backend) --
 * that's the whole point -- so recording only ever starts when the caller
 * explicitly opts in, never automatically.
 */
export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string | undefined>(undefined);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("unsupported");
      return;
    }

    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
      mimeTypeRef.current = mimeType;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = () => setState("error");

      mediaRecorderRef.current = recorder;
      recorder.start();
      setState("recording");
    } catch {
      setState("denied");
    }
  }, []);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setState("paused");
    }
  }, []);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setState("recording");
    }
  }, []);

  /** Stops recording and releases the mic, resolving with the full clip. */
  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        releaseStream();
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        releaseStream();
        setState("stopped");
        if (chunksRef.current.length === 0) {
          resolve(null);
          return;
        }
        resolve(new Blob(chunksRef.current, { type: mimeTypeRef.current ?? "audio/webm" }));
      };
      recorder.stop();
    });
  }, [releaseStream]);

  const reset = useCallback(() => {
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    setState("idle");
  }, []);

  // Belt-and-suspenders: release the mic on unmount however the component
  // exits, same rationale as the camera cleanup in MirrorPlayer.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
      releaseStream();
    };
  }, [releaseStream]);

  return { state, start, pause, resume, stop, reset };
}
