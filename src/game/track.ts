export const ROAD_HALF = 7.4;
export const WALL_HALF = 8.8;
export const SAMPLE_COUNT = 480;
export const TOTAL_LAPS = 3;
export const CHECKPOINT_COUNT = 8;

export type TrackId = "coral" | "dune" | "ridge";

export type TrackDef = {
  id: TrackId;
  name: string;
  nameKo: string;
  tag: string;
  points: [number, number, number][];
  tunnel: [number, number] | null;
  sky: string;
  fog: string;
  grass: string;
  dirt: string;
  water: string;
  road: string;
  hemiSky: string;
  hemiGround: string;
  sun: number;
  props: "palm" | "cactus" | "pine";
};

export const TRACKS: TrackDef[] = [
  {
    id: "coral",
    name: "Coral Coast",
    nameKo: "코럴 코스트",
    tag: "해변 서킷",
    sky: "#79c3e4",
    fog: "#79c3e4",
    grass: "#3a8f44",
    dirt: "#8b6d3c",
    water: "#1d7fa3",
    road: "#4f5662",
    hemiSky: "#c9e8ff",
    hemiGround: "#6aa35c",
    sun: 1.45,
    props: "palm",
    tunnel: [0.3, 0.42],
    points: [
      [0, 0, 16],
      [0, 0, -50],
      [6, 0, -110],
      [36, 0, -162],
      [90, 0, -198],
      [148, 0.15, -190],
      [188, 0.4, -148],
      [210, 0.8, -92],
      [214, 1.3, -30],
      [200, 1.7, 28],
      [172, 1.9, 74],
      [122, 2.05, 108],
      [64, 1.7, 122],
      [8, 1.15, 124],
      [-46, 0.6, 108],
      [-88, 0.25, 78],
      [-108, 0.12, 36],
      [-86, 0.06, 20],
      [-40, 0.04, 44],
      [-10, 0.02, 54],
    ],
  },
  {
    id: "dune",
    name: "Dune Loop",
    nameKo: "듄 루프",
    tag: "사막 고속",
    sky: "#efc07a",
    fog: "#efc07a",
    grass: "#e0b25a",
    dirt: "#8a5624",
    water: "#c9893a",
    road: "#3a3530",
    hemiSky: "#ffe3b0",
    hemiGround: "#b8894a",
    sun: 1.6,
    props: "cactus",
    tunnel: null,
    points: [
      [0, 0, 20],
      [0, 0, -70],
      [18, 0, -140],
      [80, 0, -190],
      [150, 0.05, -175],
      [205, 0.1, -110],
      [220, 0.15, -20],
      [200, 0.15, 70],
      [140, 0.1, 125],
      [60, 0.05, 145],
      [-20, 0, 130],
      [-80, 0, 80],
      [-100, 0, 20],
      [-70, 0, 8],
      [-28, 0, 42],
      [-8, 0, 56],
    ],
  },
  {
    id: "ridge",
    name: "Ridge Run",
    nameKo: "릿지 런",
    tag: "산악 테크니컬",
    sky: "#6a7db8",
    fog: "#6a7db8",
    grass: "#2f6b48",
    dirt: "#6b5340",
    water: "#2a4a6e",
    road: "#454a55",
    hemiSky: "#b8c8ee",
    hemiGround: "#4a6b52",
    sun: 1.2,
    props: "pine",
    tunnel: [0.46, 0.58],
    points: [
      [0, 0.15, 16],
      [10, 0.45, -48],
      [42, 1.05, -100],
      [95, 1.85, -138],
      [150, 2.55, -108],
      [175, 2.85, -40],
      [165, 2.7, 28],
      [125, 2.2, 78],
      [70, 1.55, 108],
      [10, 0.95, 118],
      [-50, 0.45, 95],
      [-88, 0.2, 48],
      [-78, 0.12, 10],
      [-32, 0.12, 36],
      [-8, 0.12, 52],
    ],
  },
];

export const CUP_TRACKS: TrackId[] = ["coral", "dune", "ridge"];

export type Sample = {
  t: number;
  x: number;
  y: number;
  z: number;
  fx: number;
  fy: number;
  fz: number;
  rx: number;
  ry: number;
  rz: number;
  ux: number;
  uy: number;
  uz: number;
};

export let activeTrack: TrackDef = TRACKS[0]!;
export let trackRev = 0;

function catmullRom(
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  t: number,
): [number, number, number] {
  const t2 = t * t;
  const t3 = t2 * t;
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const a = p1[i]!;
    const b = 0.5 * (p2[i]! - p0[i]!);
    const c = p0[i]! - 2.5 * p1[i]! + 2 * p2[i]! - 0.5 * p3[i]!;
    const d = 0.5 * (p3[i]! - p0[i]!) + 1.5 * (p1[i]! - p2[i]!);
    out[i] = a + b * t + c * t2 + d * t3;
  }
  return out;
}

function catmullTangent(
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  t: number,
): [number, number, number] {
  const t2 = t * t;
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const b = 0.5 * (p2[i]! - p0[i]!);
    const c = p0[i]! - 2.5 * p1[i]! + 2 * p2[i]! - 0.5 * p3[i]!;
    const d = 0.5 * (p3[i]! - p0[i]!) + 1.5 * (p1[i]! - p2[i]!);
    out[i] = b + 2 * c * t + 3 * d * t2;
  }
  return out;
}

export const samples: Sample[] = [];
export const checkpointT: number[] = [];
export let trackLength = 0;

function buildSamples() {
  samples.length = 0;
  const pts = activeTrack.points;
  const n = pts.length;
  let length = 0;
  let prev: [number, number, number] | null = null;

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const u = i / SAMPLE_COUNT;
    const scaled = u * n;
    const i1 = Math.floor(scaled) % n;
    const t = scaled - Math.floor(scaled);
    const i0 = (i1 - 1 + n) % n;
    const i2 = (i1 + 1) % n;
    const i3 = (i1 + 2) % n;
    const p = catmullRom(pts[i0]!, pts[i1]!, pts[i2]!, pts[i3]!, t);
    const tan = catmullTangent(pts[i0]!, pts[i1]!, pts[i2]!, pts[i3]!, t);
    const flen = Math.hypot(tan[0], tan[2]) || 1;
    const fx = tan[0] / flen;
    const fy = 0;
    const fz = tan[2] / flen;
    const rx = -fz;
    const ry = 0;
    const rz = fx;
    const ux = 0;
    const uy = 1;
    const uz = 0;

    if (prev) length += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
    prev = p;

    samples.push({
      t: u,
      x: p[0],
      y: p[1],
      z: p[2],
      fx,
      fy,
      fz,
      rx,
      ry,
      rz,
      ux,
      uy,
      uz,
    });
  }
  trackLength = length;
}

buildSamples();
checkpointT.length = 0;
for (let i = 0; i < CHECKPOINT_COUNT; i++) checkpointT.push(i / CHECKPOINT_COUNT);

export function setActiveTrack(id: TrackId) {
  activeTrack = TRACKS.find((t) => t.id === id) ?? TRACKS[0]!;
  buildSamples();
  checkpointT.length = 0;
  for (let i = 0; i < CHECKPOINT_COUNT; i++) checkpointT.push(i / CHECKPOINT_COUNT);
  trackRev += 1;
}

export function yawFromForward(fx: number, fz: number): number {
  return Math.atan2(-fx, -fz);
}

export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function sampleAt(t: number): Sample {
  const u = ((t % 1) + 1) % 1;
  const f = u * SAMPLE_COUNT;
  return samples[Math.floor(f) % SAMPLE_COUNT]!;
}

export type TrackQuery = {
  index: number;
  sample: Sample;
  lat: number;
  dist: number;
  t: number;
};

export function queryTrack(x: number, z: number, hint = 0): TrackQuery {
  const n = samples.length;
  const start = ((Math.round(hint) % n) + n) % n;
  let best = start;
  let bestD = Infinity;
  const window = 56;
  for (let k = -window; k <= window; k++) {
    const i = (start + k + n * 8) % n;
    const s = samples[i]!;
    const d = (s.x - x) ** 2 + (s.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const hinted = samples[start]!;
  const hintedD = (hinted.x - x) ** 2 + (hinted.z - z) ** 2;
  if (bestD > 48 * 48 && hintedD > 36 * 36) {
    for (let i = 0; i < n; i += 2) {
      const s = samples[i]!;
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  } else if (hintedD < 22 * 22) {
    const jump = Math.min((best - start + n) % n, (start - best + n) % n);
    if (jump > 70) {
      best = start;
      bestD = hintedD;
    }
  }
  const s = samples[best]!;
  const lat = (x - s.x) * s.rx + (z - s.z) * s.rz;
  return { index: best, sample: s, lat, dist: Math.sqrt(bestD), t: s.t };
}

export function crossedGate(prevT: number, t: number, gate: number, forward: boolean): boolean {
  if (!forward) return false;
  const eps = 0.0008;
  if (prevT <= t) return prevT < gate - eps && t >= gate - eps;
  return prevT < gate - eps || t >= gate - eps;
}

export type PalmSpot = { x: number; y: number; z: number; rot: number; scale: number };

export function palmSpots(): PalmSpot[] {
  const out: PalmSpot[] = [];
  for (let i = 8; i < samples.length; i += 10) {
    const s = samples[i]!;
    const side = i % 20 < 10 ? 1 : -1;
    const extra = 4.5 + (i % 7) * 0.55;
    const x = s.x + s.rx * side * (WALL_HALF + extra);
    const z = s.z + s.rz * side * (WALL_HALF + extra);
    const q = queryTrack(x, z, i);
    if (Math.abs(q.lat) < WALL_HALF + 2.4) continue;
    if (s.y > 1.6) continue;
    out.push({
      x,
      y: 0,
      z,
      rot: (i * 1.73) % (Math.PI * 2),
      scale: 0.85 + (i % 5) * 0.09,
    });
  }
  return out;
}

export type RockSpot = { x: number; y: number; z: number; rot: number; scale: number };

export function rockSpots(): RockSpot[] {
  const out: RockSpot[] = [];
  for (let i = 4; i < samples.length; i += 17) {
    const s = samples[i]!;
    const side = i % 34 < 17 ? -1 : 1;
    const x = s.x + s.rx * side * (WALL_HALF + 3.2 + (i % 4));
    const z = s.z + s.rz * side * (WALL_HALF + 3.2);
    if (s.y > 1.4) continue;
    out.push({
      x,
      y: 0.15,
      z,
      rot: i * 0.41,
      scale: 0.6 + (i % 4) * 0.18,
    });
  }
  return out;
}

export function isTunnelT(t: number): boolean {
  const range = activeTrack.tunnel;
  if (!range) return false;
  const u = ((t % 1) + 1) % 1;
  return u > range[0] && u < range[1];
}
