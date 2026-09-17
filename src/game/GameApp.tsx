import { useEffect } from "react";
import { RaceCanvas } from "./Scene";
import { Overlay } from "./overlay";
import { initInput } from "./input";
import { setupTitle } from "./sim";
import { setMuted, unlockAudio } from "./audio";
import { useGame } from "./store";

if (typeof window !== "undefined") {
  initInput();
  setupTitle();
}

export default function GameApp() {
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    const vis = () => {
      if (!document.hidden) unlockAudio();
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  useEffect(() => {
    return useGame.subscribe((s) => {
      setMuted(s.muted);
    });
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg touch-none">
      <RaceCanvas />
      <Overlay />
    </div>
  );
}
