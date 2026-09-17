import type { RacerId } from "./racers";
import type { TrackId } from "./track";

export type ItemKind = "nitro" | "peel" | "ricochet" | "seeker" | "shield" | "zap";

export type RacePhase = "title" | "countdown" | "racing" | "paused" | "results";

export type RaceMode = "vs" | "trial" | "cup";

export type Difficulty = "normal" | "hard";

export type Kart = {
  id: string;
  racerId: RacerId;
  isPlayer: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  vx: number;
  vz: number;
  hint: number;
  lap: number;
  nextCp: number;
  lastCp: number;
  raceTime: number;
  lapTime: number;
  finishTime: number;
  finished: boolean;
  item: ItemKind | null;
  itemSpin: number;
  pendingItem: ItemKind | null;
  itemCooldown: number;
  invuln: number;
  stun: number;
  boost: number;
  shrink: number;
  shield: boolean;
  drifting: boolean;
  driftDir: number;
  driftCharge: number;
  hop: number;
  steerAngle: number;
  wheelRot: number;
  visualRoll: number;
  offTimer: number;
  place: number;
  aiDelay: number;
  spin: number;
  skidAcc: number;
};

export type Projectile = {
  id: number;
  kind: "ricochet" | "seeker";
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  owner: string;
  life: number;
  bounces: number;
  target: string | null;
};

export type Hazard = {
  id: number;
  x: number;
  z: number;
  life: number;
};

export type ItemBox = {
  id: number;
  t: number;
  offset: number;
  respawn: number;
};

export type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  r: number;
  g: number;
  b: number;
};

export type Skid = {
  x: number;
  z: number;
  yaw: number;
  life: number;
};

export type ResultRow = {
  id: string;
  racerId: RacerId;
  name: string;
  time: number;
  place: number;
  finished: boolean;
  points: number;
};

export type CupRow = {
  racerId: RacerId;
  name: string;
  points: number;
};

export type { TrackId };
