import { create } from "zustand";
import type { CupRow, Difficulty, ItemKind, RaceMode, RacePhase, ResultRow } from "./types";
import { TOTAL_LAPS, TRACKS, type TrackId } from "./track";
import { RACERS, type RacerId } from "./racers";

export type HudState = {
  phase: RacePhase;
  racerId: RacerId;
  countdown: number;
  place: number;
  racers: number;
  lap: number;
  totalLaps: number;
  time: number;
  lapTime: number;
  bestLap: number | null;
  personalBest: number | null;
  speed: number;
  item: ItemKind | null;
  itemSpin: number;
  driftCharge: number;
  drifting: boolean;
  boosting: boolean;
  wrongWay: boolean;
  offTrack: boolean;
  shield: boolean;
  muted: boolean;
  results: ResultRow[];
  mode: RaceMode;
  difficulty: Difficulty;
  trackId: TrackId;
  trackRev: number;
  trackBests: Partial<Record<TrackId, number>>;
  cupRound: number;
  cupStandings: CupRow[];
  cupDone: boolean;
};

type GameStore = HudState & {
  setRacer: (id: RacerId) => void;
  setHud: (partial: Partial<HudState>) => void;
  toggleMute: () => void;
};

const SAVE_KEY = "boom-karts-v2";

type SaveShape = {
  version: number;
  bests?: Partial<Record<TrackId, number>>;
  muted?: boolean;
};

function loadSave(): { bests: Partial<Record<TrackId, number>>; muted: boolean } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SaveShape;
      return { bests: parsed.bests ?? {}, muted: !!parsed.muted };
    }
    const legacy = localStorage.getItem("boom-karts-v1");
    if (legacy) {
      const parsed = JSON.parse(legacy) as { best?: number };
      return { bests: typeof parsed.best === "number" ? { coral: parsed.best } : {}, muted: false };
    }
  } catch {
    /* ignore */
  }
  return { bests: {}, muted: false };
}

export function saveProgress(bests: Partial<Record<TrackId, number>>, muted: boolean) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 2, bests, muted }));
  } catch {
    /* ignore */
  }
}

export function saveBest(trackId: TrackId, time: number) {
  const s = useGame.getState();
  const prev = s.trackBests[trackId];
  if (prev != null && time >= prev) return;
  const trackBests = { ...s.trackBests, [trackId]: time };
  useGame.setState({ trackBests, personalBest: time });
  saveProgress(trackBests, s.muted);
}

const initial = typeof window !== "undefined" ? loadSave() : { bests: {}, muted: false };

export const useGame = create<GameStore>((set, get) => ({
  phase: "title",
  racerId: RACERS[0]!.id,
  countdown: 0,
  place: 4,
  racers: 6,
  lap: 1,
  totalLaps: TOTAL_LAPS,
  time: 0,
  lapTime: 0,
  bestLap: null,
  personalBest: initial.bests.coral ?? null,
  speed: 0,
  item: null,
  itemSpin: 0,
  driftCharge: 0,
  drifting: false,
  boosting: false,
  wrongWay: false,
  offTrack: false,
  shield: false,
  muted: initial.muted,
  results: [],
  mode: "vs",
  difficulty: "normal",
  trackId: "coral",
  trackRev: 0,
  trackBests: initial.bests,
  cupRound: 0,
  cupStandings: [],
  cupDone: false,
  setRacer: (id) => set({ racerId: id }),
  setHud: (partial) => set(partial),
  toggleMute: () => {
    const muted = !get().muted;
    set({ muted });
    saveProgress(get().trackBests, muted);
  },
}));

export function trackBest(id: TrackId) {
  return useGame.getState().trackBests[id] ?? null;
}

export const TRACK_LIST = TRACKS;
