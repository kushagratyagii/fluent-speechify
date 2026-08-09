"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, CameraOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlayerProps } from "./types";

type CameraState = "off" | "starting" | "on" | "denied" | "unsupported";

/**
 * Front-camera mirror. The stream is attached to a local <video> element and
 * never recorded, uploaded or passed to any other API — stopping the exercise
 * releases every track.
 */
export function MirrorPlayer({ exercise, config, timer }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("off");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState("off");
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setState("on");
    } catch {
      setState("denied");
    }
  }, []);

  // Release the camera when the player unmounts, whatever the exit route.
  useEffect(() => () => stopCamera(), [stopCamera]);

  const prompts = exercise.content?.items ?? [];
  const promptSeconds =
    prompts.length > 0 ? config.durationSeconds / prompts.length : 0;
  const promptIndex =
    promptSeconds > 0
      ? Math.min(prompts.length - 1, Math.floor(timer.elapsed / promptSeconds))
      : 0;
  const idle = !timer.running && timer.elapsed === 0;

  return (
    <div className="space-y-5">
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl border bg-muted">
        <video
          ref={videoRef}
          playsInline
          muted
          className="size-full scale-x-[-1] object-cover"
        />

        {state !== "on" ? (
          <div className="absolute inset-0 grid place-items-center gap-3 bg-muted p-6 text-center">
            <div className="space-y-3">
              <Camera className="mx-auto size-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                {state === "denied"
                  ? "Camera access was blocked"
                  : state === "unsupported"
                    ? "This browser cannot open the camera"
                    : "Turn on your camera to use it as a mirror"}
              </p>
              <p className="mx-auto max-w-xs text-xs text-muted-foreground">
                {state === "denied"
                  ? "Allow camera access in your browser settings, or use a real mirror instead."
                  : "Nothing is recorded or uploaded. You can also do this exercise in front of a real mirror."}
              </p>
              {state !== "unsupported" ? (
                <Button
                  size="lg"
                  onClick={startCamera}
                  disabled={state === "starting"}
                >
                  <Camera className="size-4" />
                  {state === "starting" ? "Starting…" : "Enable camera"}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {state === "on" ? (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
            <ShieldCheck className="size-3.5 text-primary" />
            Live only — not recorded
          </div>
        ) : null}
      </div>

      {state === "on" ? (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={stopCamera}>
            <CameraOff className="size-3.5" />
            Turn off camera
          </Button>
        </div>
      ) : null}

      {prompts.length > 0 ? (
        <div className="rounded-2xl border bg-linear-to-br from-primary/10 to-transparent p-6 text-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-primary">
            Say this aloud
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={promptIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="text-xl font-medium tracking-tight sm:text-2xl"
            >
              {idle ? prompts[0] : prompts[promptIndex]}
            </motion.p>
          </AnimatePresence>
          <p className="mt-3 text-xs text-muted-foreground">
            Prompt {idle ? 1 : promptIndex + 1} of {prompts.length}
          </p>
        </div>
      ) : null}
    </div>
  );
}
