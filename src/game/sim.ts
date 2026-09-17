import { RACERS, racerById, type RacerId } from "./racers";
import {
  CHECKPOINT_COUNT,
  checkpointT,
  crossedGate,
  CUP_TRACKS,
  queryTrack,
  ROAD_HALF,
  sampleAt,
  samples,
  setActiveTrack,
  TOTAL_LAPS,
  WALL_HALF,
  wrapAngle,
  yawFromForward,
  type TrackId,
  type TrackQuery,
} from "./track";
import type {
  CupRow,
  Hazard,
  ItemKind,
  ItemBox,
  Kart,
  Particle,
  Projectile,
  RacePhase,
  ResultRow,
  Skid,
} from "./types";
import { sampleActions, setQaKeys, setQaSteer, type Actions } from "./input";
import { sfxLib } from "./audio";
import { saveBest, useGame } from "./store";

const MAX_SPEED = 27.5;
const BOOST_SPEED = 38;
const REVERSE_MAX = 9;
const ACCEL = 23;
const BRAKE = 34;
const TURN_RATE = 1.72;
const KART_RADIUS = 1.05;
const CUP_PTS = [15, 12, 10, 8, 6, 4];

let nextId = 1;

export type Sim = {
  phase: RacePhase;
  countdown: number;
  time: number;
  karts: Kart[];
  projectiles: Projectile[];
  hazards: Hazard[];
  boxes: ItemBox[];
  particles: Particle[];
  trauma: number;
  lastBeep: number;
  results: ResultRow[];
  bestLap: number | null;
  wrongTimer: number;
  skids: Skid[];
  cupRound: number;
  cupPoints: Partial<Record<string, number>>;
};

function makeKart(id: string, racerId: RacerId, isPlayer: boolean): Kart {
  return {
    id,
    racerId,
    isPlayer,
    x: 0,
    y: 0.42,
    z: 0,
    yaw: 0,
    speed: 0,
    vx: 0,
    vz: 0,
    hint: 0,
    lap: 0,
    nextCp: 1,
    lastCp: 0,
    raceTime: 0,
    lapTime: 0,
    finishTime: 0,
    finished: false,
    item: null,
    itemSpin: 0,
    pendingItem: null,
    itemCooldown: 0,
    invuln: 0,
    stun: 0,
    boost: 0,
    shrink: 0,
    shield: false,
    drifting: false,
    driftDir: 1,
    driftCharge: 0,
    hop: 0,
    steerAngle: 0,
    wheelRot: 0,
    visualRoll: 0,
    offTimer: 0,
    place: 1,
    aiDelay: 0,
    spin: 0,
    skidAcc: 0,
  };
}

function placeOnGrid(kart: Kart, slot: number) {
  const row = Math.floor(slot / 2);
  const col = slot % 2 === 0 ? -2.05 : 2.05;
  const s = sampleAt(0.018 + row * 0.011);
  kart.x = s.x + s.rx * col;
  kart.y = s.y + 0.5;
  kart.z = s.z + s.rz * col;
  kart.yaw = yawFromForward(s.fx, s.fz);
  kart.hint = Math.floor(s.t * samples.length);
  kart.vx = 0;
  kart.vz = 0;
  kart.speed = 0;
}

function resetKartState(kart: Kart) {
  kart.lap = 0;
  kart.nextCp = 1;
  kart.lastCp = 0;
  kart.raceTime = 0;
  kart.lapTime = 0;
  kart.finishTime = 0;
  kart.finished = false;
  kart.item = null;
  kart.itemSpin = 0;
  kart.pendingItem = null;
  kart.itemCooldown = 0;
  kart.invuln = 0;
  kart.stun = 0;
  kart.boost = 0;
  kart.shrink = 0;
  kart.shield = false;
  kart.drifting = false;
  kart.driftCharge = 0;
  kart.hop = 0;
  kart.offTimer = 0;
  kart.spin = 0;
  kart.skidAcc = 0;
}

function spawnBoxes(): ItemBox[] {
  const ts = [0.11, 0.27, 0.48, 0.66, 0.84];
  const boxes: ItemBox[] = [];
  for (const t of ts) {
    boxes.push({ id: nextId++, t, offset: -2.15, respawn: 0 });
    boxes.push({ id: nextId++, t, offset: 2.15, respawn: 0 });
  }
  return boxes;
}

export const sim: Sim = {
  phase: "title",
  countdown: 0,
  time: 0,
  karts: [],
  projectiles: [],
  hazards: [],
  boxes: spawnBoxes(),
  particles: [],
  trauma: 0,
  lastBeep: 4,
  results: [],
  bestLap: null,
  wrongTimer: 0,
  skids: [],
  cupRound: 0,
  cupPoints: {},
};

function emit(
  x: number,
  y: number,
  z: number,
  color: [number, number, number],
  n: number,
  speed = 4,
) {
  for (let i = 0; i < n; i++) {
    if (sim.particles.length > 220) sim.particles.shift();
    const a = Math.random() * Math.PI * 2;
    const v = Math.random() * speed;
    sim.particles.push({
      x,
      y,
      z,
      vx: Math.cos(a) * v,
      vy: 1.5 + Math.random() * 3,
      vz: Math.sin(a) * v,
      life: 0.35 + Math.random() * 0.35,
      max: 0.7,
      size: 0.08 + Math.random() * 0.1,
      r: color[0],
      g: color[1],
      b: color[2],
    });
  }
}

export function resetRace(playerId: RacerId) {
  const mode = useGame.getState().mode;
  const others = RACERS.filter((r) => r.id !== playerId);
  const karts: Kart[] = [makeKart("player", playerId, true)];
  if (mode !== "trial") {
    others.forEach((r) => karts.push(makeKart(`ai-${r.id}`, r.id, false)));
  }
  const slots = [2, 0, 1, 3, 4, 5];
  karts.forEach((k, i) => {
    resetKartState(k);
    placeOnGrid(k, slots[i] ?? i);
  });
  sim.karts = karts;
  sim.projectiles = [];
  sim.hazards = [];
  sim.boxes = mode === "trial" ? [] : spawnBoxes();
  sim.particles = [];
  sim.skids = [];
  sim.time = 0;
  sim.trauma = 0;
  sim.results = [];
  sim.bestLap = null;
  sim.lastBeep = 4;
  sim.wrongTimer = 0;
}

export function setupTitle() {
  if (sim.karts.length === 0) resetRace(useGame.getState().racerId);
  sim.phase = "title";
  sim.countdown = 0;
  syncHud();
}

export function previewTrack(id: TrackId) {
  setActiveTrack(id);
  const best = useGame.getState().trackBests[id] ?? null;
  useGame.getState().setHud({ trackId: id, trackRev: Date.now(), personalBest: best });
  if (sim.phase === "title") {
    resetRace(useGame.getState().racerId);
    sim.phase = "title";
    syncHud();
  }
}

export function beginCountdown(playerId: RacerId) {
  const hud = useGame.getState();
  if (hud.mode === "cup" && sim.phase === "title") {
    sim.cupRound = 0;
    sim.cupPoints = {};
    setActiveTrack(CUP_TRACKS[0]!);
    useGame.getState().setHud({ trackId: CUP_TRACKS[0]!, trackRev: Date.now(), cupDone: false, cupStandings: [] });
  }
  resetRace(playerId);
  sim.phase = "countdown";
  sim.countdown = 3.2;
  sim.lastBeep = 4;
  syncHud();
}

export function continueCup() {
  sim.cupRound += 1;
  const id = CUP_TRACKS[sim.cupRound];
  if (!id) {
    exitToTitle();
    return;
  }
  setActiveTrack(id);
  useGame.getState().setHud({ trackId: id, trackRev: Date.now(), cupDone: false });
  beginCountdown(useGame.getState().racerId);
}

export function forceRacing() {
  if (sim.karts.length === 0) resetRace(useGame.getState().racerId);
  sim.phase = "racing";
  sim.countdown = 0;
  syncHud();
}

export function playerKart(): Kart {
  return sim.karts[0] ?? makeKart("player", "chili", true);
}

function rollItem(place: number, total: number): ItemKind {
  const last = place >= total;
  const first = place === 1;
  const bag: ItemKind[] = first
    ? ["peel", "peel", "shield", "ricochet"]
    : last
      ? ["nitro", "nitro", "seeker", "zap", "seeker"]
      : place <= 2
        ? ["peel", "ricochet", "shield", "nitro"]
        : ["nitro", "ricochet", "seeker", "peel", "shield", "nitro"];
  return bag[Math.floor(Math.random() * bag.length)]!;
}

function applyHit(k: Kart, kind: "peel" | "orb" | "zap") {
  if (k.invuln > 0) return;
  if (k.shield) {
    k.shield = false;
    emit(k.x, k.y + 0.6, k.z, [0.7, 0.85, 1], 10, 5);
    return;
  }
  if (kind === "zap") {
    k.shrink = 2.8;
    k.speed *= 0.45;
    if (k.isPlayer) {
      sim.trauma = Math.min(1, sim.trauma + 0.4);
      sfxLib.zap();
    }
    return;
  }
  k.stun = kind === "peel" ? 0.95 : 0.72;
  k.spin = kind === "peel" ? 9 : 6;
  k.speed *= 0.28;
  k.drifting = false;
  k.driftCharge = 0;
  k.boost = 0;
  emit(k.x, k.y + 0.4, k.z, [1, 0.7, 0.25], 14, 6);
  if (k.isPlayer) {
    sim.trauma = Math.min(1, sim.trauma + 0.55);
    sfxLib.hit();
  }
}

function useItem(k: Kart) {
  if (!k.item || k.stun > 0) return;
  const item = k.item;
  k.item = null;
  k.itemCooldown = 0.4;
  const fx = -Math.sin(k.yaw);
  const fz = -Math.cos(k.yaw);
  if (item === "nitro") {
    k.boost = Math.max(k.boost, 1.35);
    k.invuln = Math.max(k.invuln, 0.2);
    if (k.isPlayer) sfxLib.boost();
    emit(k.x - fx, k.y + 0.3, k.z - fz, [1, 0.55, 0.2], 12, 7);
  } else if (item === "peel") {
    sim.hazards.push({
      id: nextId++,
      x: k.x - fx * 2.4,
      z: k.z - fz * 2.4,
      life: 18,
    });
    if (k.isPlayer) sfxLib.peel();
  } else if (item === "ricochet" || item === "seeker") {
    let target: string | null = null;
    if (item === "seeker") {
      const ahead = [...sim.karts]
        .filter((o) => o.id !== k.id && !o.finished)
        .sort((a, b) => raceScore(b) - raceScore(a))
        .find((o) => raceScore(o) > raceScore(k) - 0.02);
      target = ahead?.id ?? null;
    }
    sim.projectiles.push({
      id: nextId++,
      kind: item,
      x: k.x + fx * 1.8,
      y: k.y + 0.45,
      z: k.z + fz * 1.8,
      yaw: k.yaw,
      speed: item === "seeker" ? 36 : 34,
      owner: k.id,
      life: item === "seeker" ? 4.5 : 3.2,
      bounces: 6,
      target,
    });
  } else if (item === "shield") {
    k.shield = true;
    k.invuln = Math.max(k.invuln, 0.15);
  } else if (item === "zap") {
    for (const o of sim.karts) {
      if (o.id === k.id || o.finished) continue;
      applyHit(o, "zap");
    }
    if (k.isPlayer) sfxLib.zap();
    sim.trauma = Math.min(1, sim.trauma + 0.3);
  }
}

function raceScore(k: Kart): number {
  if (k.finished) return 100 + (1000 - k.finishTime) * 0.001;
  return k.lap + k.hint / samples.length;
}

function boostFromDrift(k: Kart) {
  if (k.driftCharge > 1.5) {
    k.boost = Math.max(k.boost, 1.4);
    if (k.isPlayer) {
      sfxLib.boost();
      sim.trauma = Math.min(1, sim.trauma + 0.22);
    }
    emit(k.x, k.y, k.z, [1, 0.45, 0.15], 16, 8);
  } else if (k.driftCharge > 0.72) {
    k.boost = Math.max(k.boost, 0.72);
    if (k.isPlayer) sfxLib.boost();
    emit(k.x, k.y, k.z, [0.45, 0.7, 1], 10, 6);
  }
}

function aiActions(k: Kart): Actions {
  const look = sampleAt((k.hint / samples.length + 0.05 + Math.abs(k.speed) * 0.0009) % 1);
  const look2 = sampleAt((k.hint / samples.length + 0.1) % 1);
  const dx = look.x - k.x;
  const dz = look.z - k.z;
  const want = Math.atan2(-dx, -dz);
  const err = wrapAngle(want - k.yaw);
  const steer = Math.max(-1, Math.min(1, err * 1.65));
  const curve = 1 - (look.fx * look2.fx + look.fz * look2.fz);
  let throttle = 1;
  if (curve > 0.035 && k.speed > (useGame.getState().difficulty === "hard" ? 20 : 16)) throttle = 0.45;
  if (k.stun > 0) throttle = 0;
  const drift = curve > 0.05 && k.speed > 14 && Math.abs(err) > 0.18;
  k.aiDelay -= 1 / 60;
  let item = false;
  if (k.item && k.aiDelay <= 0) {
    item = true;
    k.aiDelay = 1.4 + Math.random() * 1.6;
  }
  return { throttle, steer, drift, item, pausePressed: false };
}

function stepKart(k: Kart, dt: number, actions: Actions) {
  if (k.finished) {
    k.speed *= Math.exp(-3 * dt);
    k.x += k.vx * dt * 0.2;
    k.z += k.vz * dt * 0.2;
    return;
  }

  let q: TrackQuery = queryTrack(k.x, k.z, k.hint);
  k.hint = q.index;

  const player = playerKart();
  const myScore = raceScore(k);
  const pScore = raceScore(player);
  let rubber = 1;
  if (!k.isPlayer) {
    const hard = useGame.getState().difficulty === "hard";
    const delta = pScore - myScore;
    if (delta > 0.08) rubber = hard ? 1.22 : 1.14;
    if (delta > 0.18) rubber = hard ? 1.32 : 1.24;
    if (delta < -0.1) rubber = hard ? 0.94 : 0.88;
    if (delta < -0.2) rubber = hard ? 0.86 : 0.78;
  }

  k.stun = Math.max(0, k.stun - dt);
  k.invuln = Math.max(0, k.invuln - dt);
  k.boost = Math.max(0, k.boost - dt);
  k.shrink = Math.max(0, k.shrink - dt);
  k.itemCooldown = Math.max(0, k.itemCooldown - dt);
  k.hop = Math.max(0, k.hop - dt);
  k.spin = Math.max(0, k.spin - dt * 6);

  let throttle = k.stun > 0 ? 0 : actions.throttle;
  let steer = k.stun > 0 ? 0 : actions.steer;
  const reverse = k.speed >= 0 ? 1 : -1;
  const shrinkMul = k.shrink > 0 ? 0.62 : 1;
  const cap = (k.boost > 0 ? BOOST_SPEED : MAX_SPEED) * rubber * shrinkMul;
  const off = Math.abs(q.lat) > ROAD_HALF - 0.35;

  if (throttle > 0) k.speed += ACCEL * throttle * dt * (k.boost > 0 ? 1.35 : 1);
  else if (throttle < 0) k.speed += BRAKE * throttle * dt;
  else k.speed *= Math.exp(-(k.boost > 0 ? 0.4 : 1.15) * dt);

  if (off) k.speed *= Math.exp(-0.7 * dt);
  if (off && k.speed > 13) k.speed += (13 - k.speed) * (1 - Math.exp(-4 * dt));
  if (k.speed > cap) k.speed += (cap - k.speed) * (1 - Math.exp(-6 * dt));
  if (k.speed < -REVERSE_MAX) k.speed = -REVERSE_MAX;

  const speedFactor = Math.max(0, Math.min(1, Math.abs(k.speed) / 8));
  const highTaper = 1 - Math.max(0, Math.min(0.42, (Math.abs(k.speed) - 18) / 28));
  k.yaw += steer * TURN_RATE * speedFactor * highTaper * reverse * dt;
  if (k.stun > 0) k.yaw += k.spin * dt;

  if (actions.drift && !k.drifting && Math.abs(steer) > 0.2 && k.speed > 11 && k.stun <= 0) {
    k.drifting = true;
    k.driftDir = Math.sign(steer) || 1;
    k.hop = 0.16;
    k.driftCharge = 0;
  }
  if (k.drifting) {
    if (!actions.drift || k.speed < 6) {
      boostFromDrift(k);
      k.drifting = false;
      k.driftCharge = 0;
    } else {
      k.driftCharge += dt;
      k.yaw += k.driftDir * 0.62 * dt * reverse;
      if (k.isPlayer && Math.random() < 0.045) sfxLib.drift();
      const stage: [number, number, number] = k.driftCharge > 1.5 ? [1, 0.45, 0.12] : [0.4, 0.65, 1];
      if (sim.particles.length < 200) {
        const rx = Math.cos(k.yaw);
        const rz = -Math.sin(k.yaw);
        emit(k.x - rx * 0.6, 0.12, k.z - rz * 0.6, stage, 1, 1.4);
      }
      k.skidAcc += dt;
      if (k.skidAcc > 0.045) {
        k.skidAcc = 0;
        if (sim.skids.length > 140) sim.skids.shift();
        sim.skids.push({ x: k.x, z: k.z, yaw: k.yaw, life: 3.2 });
      }
    }
  }

  if (actions.item && k.item && k.itemCooldown <= 0) useItem(k);

  if (k.itemSpin > 0) {
    k.itemSpin -= dt;
    if (k.itemSpin <= 0) {
      k.itemSpin = 0;
      k.item = k.pendingItem;
      k.pendingItem = null;
      if (k.isPlayer) sfxLib.item();
    }
  }

  const fx = -Math.sin(k.yaw);
  const fz = -Math.cos(k.yaw);
  const rx = Math.cos(k.yaw);
  const rz = -Math.sin(k.yaw);
  let lat = k.vx * rx + k.vz * rz;
  const grip = k.drifting ? 2.4 : 9.8;
  lat *= Math.exp(-grip * dt);
  k.vx = fx * k.speed + rx * lat;
  k.vz = fz * k.speed + rz * lat;
  k.x += k.vx * dt;
  k.z += k.vz * dt;

  q = queryTrack(k.x, k.z, k.hint);
  k.hint = q.index;
  const hopY = k.hop > 0 ? Math.sin((k.hop / 0.16) * Math.PI) * 0.42 : 0;
  k.y = q.sample.y + 0.5 + hopY;

  const latAbs = Math.abs(q.lat);
  if (latAbs > ROAD_HALF - 0.15) {
    const over = latAbs - (ROAD_HALF - 0.15);
    const pull = Math.min(22, 8 + over * 2.4) * dt;
    const dir = Math.sign(q.lat) || 1;
    k.x -= q.sample.rx * dir * pull;
    k.z -= q.sample.rz * dir * pull;
  }

  if (latAbs > WALL_HALF - 0.2) {
    const clamped = Math.sign(q.lat) * (WALL_HALF - 0.2);
    k.x = q.sample.x + q.sample.rx * clamped;
    k.z = q.sample.z + q.sample.rz * clamped;
    k.speed *= 0.78;
    lat *= 0.2;
  }

  if (off) k.offTimer += dt;
  else k.offTimer = 0;
  if (k.offTimer > 1.05 || q.dist > 16 || k.y < -2) {
    const s = sampleAt(checkpointT[k.lastCp] ?? 0);
    k.x = s.x;
    k.y = s.y + 0.5;
    k.z = s.z;
    k.yaw = yawFromForward(s.fx, s.fz);
    k.speed = 11;
    k.vx = s.fx * 11;
    k.vz = s.fz * 11;
    k.drifting = false;
    k.offTimer = 0;
    k.hint = Math.floor(s.t * samples.length);
  }

  const prevT = ((q.t - (k.vx * q.sample.fx + k.vz * q.sample.fz) * dt) % 1 + 1) % 1;
  const forward = k.vx * q.sample.fx + k.vz * q.sample.fz > 0.4;
  const gate = checkpointT[k.nextCp] ?? 0;
  if (crossedGate(prevT, q.t, gate, forward)) {
    k.lastCp = k.nextCp;
    if (k.nextCp === 0) {
      if (k.lap > 0 || q.t < 0.5) {
        if (sim.bestLap == null || k.lapTime < sim.bestLap) sim.bestLap = k.lapTime;
        k.lap += 1;
        k.lapTime = 0;
        if (k.lap >= TOTAL_LAPS) {
          k.finished = true;
          k.finishTime = k.raceTime;
          if (k.isPlayer) sfxLib.finish();
        }
      }
      k.nextCp = 1;
    } else {
      k.nextCp = (k.nextCp + 1) % CHECKPOINT_COUNT;
    }
  }

  k.raceTime += dt;
  k.lapTime += dt;
  k.steerAngle += (steer - k.steerAngle) * (1 - Math.exp(-12 * dt));
  k.wheelRot += k.speed * dt * 1.35;
  const wantRoll = k.drifting ? -k.driftDir * 0.22 : -steer * 0.12;
  k.visualRoll += (wantRoll - k.visualRoll) * (1 - Math.exp(-8 * dt));

  if (k.isPlayer) {
    const along = fx * q.sample.fx + fz * q.sample.fz;
    if (k.speed > 7 && along < -0.45) sim.wrongTimer += dt;
    else sim.wrongTimer = Math.max(0, sim.wrongTimer - dt * 2.8);
  }

  if (!k.isPlayer && k.item == null && k.aiDelay <= 0) k.aiDelay = 0.4 + Math.random();
}

function kartKartPush(dt: number) {
  const ks = sim.karts;
  for (let i = 0; i < ks.length; i++) {
    for (let j = i + 1; j < ks.length; j++) {
      const a = ks[i]!;
      const b = ks[j]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const ra = KART_RADIUS * (a.shrink > 0 ? 0.7 : 1);
      const rb = KART_RADIUS * (b.shrink > 0 ? 0.7 : 1);
      const min = ra + rb;
      if (d > 0.001 && d < min) {
        const nx = dx / d;
        const nz = dz / d;
        const pen = (min - d) * 0.5;
        a.x -= nx * pen;
        a.z -= nz * pen;
        b.x += nx * pen;
        b.z += nz * pen;
        a.speed *= 0.99;
        b.speed *= 0.99;
      }
    }
  }
  void dt;
}

function stepItems(dt: number) {
  for (const box of sim.boxes) {
    if (box.respawn > 0) {
      box.respawn = Math.max(0, box.respawn - dt);
      continue;
    }
    const s = sampleAt(box.t);
    const bx = s.x + s.rx * box.offset;
    const bz = s.z + s.rz * box.offset;
    for (const k of sim.karts) {
      if (k.finished || k.item || k.itemSpin > 0) continue;
      const d = Math.hypot(k.x - bx, k.z - bz);
      if (d < 1.55) {
        k.pendingItem = rollItem(k.place, sim.karts.length);
        k.itemSpin = 1.05;
        box.respawn = 4.2;
        emit(bx, s.y + 1.1, bz, [1, 1, 0.75], 8, 4);
        if (k.isPlayer) sfxLib.spin();
        break;
      }
    }
  }

  for (const h of sim.hazards) h.life -= dt;
  sim.hazards = sim.hazards.filter((h) => h.life > 0);
  for (const h of sim.hazards) {
    for (const k of sim.karts) {
      if (k.stun > 0 || k.invuln > 0) continue;
      if (Math.hypot(k.x - h.x, k.z - h.z) < 1.25) {
        applyHit(k, "peel");
        h.life = 0;
      }
    }
  }
  sim.hazards = sim.hazards.filter((h) => h.life > 0);

  for (const p of sim.projectiles) {
    p.life -= dt;
    if (p.kind === "seeker" && p.target) {
      const t = sim.karts.find((k) => k.id === p.target);
      if (t && !t.finished) {
        const want = Math.atan2(-(t.x - p.x), -(t.z - p.z));
        p.yaw += wrapAngle(want - p.yaw) * Math.min(1, 4.2 * dt);
      }
    }
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    p.x += fx * p.speed * dt;
    p.z += fz * p.speed * dt;
    const q = queryTrack(p.x, p.z, 0);
    p.y = q.sample.y + 0.5;
    if (Math.abs(q.lat) > WALL_HALF - 0.2) {
      if (p.kind === "ricochet" && p.bounces > 0) {
        p.yaw = wrapAngle(p.yaw + Math.PI * 0.5 * Math.sign(q.lat || 1));
        p.bounces -= 1;
        const clamped = Math.sign(q.lat) * (WALL_HALF - 0.4);
        p.x = q.sample.x + q.sample.rx * clamped;
        p.z = q.sample.z + q.sample.rz * clamped;
      } else {
        p.life = 0;
      }
    }
    for (const k of sim.karts) {
      if (k.id === p.owner || k.finished) continue;
      if (Math.hypot(k.x - p.x, k.z - p.z) < 1.35) {
        applyHit(k, "orb");
        p.life = 0;
        break;
      }
    }
  }
  sim.projectiles = sim.projectiles.filter((p) => p.life > 0);
}

function stepParticles(dt: number) {
  for (const p of sim.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vy -= 8 * dt;
  }
  sim.particles = sim.particles.filter((p) => p.life > 0);
}

function updatePlaces() {
  const ranked = [...sim.karts].sort((a, b) => raceScore(b) - raceScore(a));
  ranked.forEach((k, i) => {
    k.place = i + 1;
  });
}

function maybeFinish() {
  const player = playerKart();
  if (!player.finished) return;
  const allDone = sim.karts.every((k) => k.finished);
  const wait = player.raceTime - player.finishTime > 8;
  if (allDone || wait) {
    for (const k of sim.karts) {
      if (!k.finished) {
        k.finished = true;
        k.finishTime = k.raceTime + 8;
      }
    }
    updatePlaces();
    sim.results = [...sim.karts]
      .sort((a, b) => a.place - b.place)
      .map((k) => {
        const pts = CUP_PTS[k.place - 1] ?? 0;
        if (useGame.getState().mode === "cup") {
          sim.cupPoints[k.racerId] = (sim.cupPoints[k.racerId] ?? 0) + pts;
        }
        return {
          id: k.id,
          racerId: k.racerId,
          name: racerById(k.racerId).name,
          time: k.finishTime,
          place: k.place,
          finished: k.lap >= TOTAL_LAPS,
          points: pts,
        };
      });
    if (player.finished) {
      saveBest(useGame.getState().trackId, player.finishTime);
    }
    const cupStandings: CupRow[] = RACERS.map((r) => ({
      racerId: r.id,
      name: r.name,
      points: sim.cupPoints[r.id] ?? 0,
    })).sort((a, b) => b.points - a.points);
    const cupDone = useGame.getState().mode === "cup" && sim.cupRound >= CUP_TRACKS.length - 1;
    useGame.getState().setHud({
      cupStandings,
      cupRound: sim.cupRound,
      cupDone,
    });
    sim.phase = "results";
  }
}

function syncHud() {
  const p = playerKart();
  const q = queryTrack(p.x, p.z, p.hint);
  const hud = useGame.getState();
  const countdown = sim.phase === "countdown" ? Math.ceil(sim.countdown) : 0;
  hud.setHud({
    phase: sim.phase,
    countdown,
    place: p.place,
    racers: sim.karts.length,
    lap: Math.min(TOTAL_LAPS, p.lap + 1),
    time: p.raceTime,
    lapTime: p.lapTime,
    bestLap: sim.bestLap,
    speed: Math.abs(p.speed),
    item: p.item,
    itemSpin: p.itemSpin,
    driftCharge: p.drifting ? p.driftCharge : 0,
    drifting: p.drifting,
    boosting: p.boost > 0,
    wrongWay: sim.phase === "racing" && sim.wrongTimer > 0.8,
    offTrack: sim.phase === "racing" && Math.abs(q.lat) > ROAD_HALF + 0.2,
    shield: p.shield,
    results: sim.results,
    personalBest: hud.trackBests[hud.trackId] ?? null,
    cupRound: sim.cupRound,
  });
}

export function setPlayerRacer(id: RacerId) {
  const p = sim.karts[0];
  if (p) p.racerId = id;
}

export function fixedUpdate(dt: number) {
  sim.trauma = Math.max(0, sim.trauma - dt * 1.8);

  if (sim.phase === "countdown") {
    sim.countdown -= dt;
    const beat = Math.ceil(sim.countdown);
    if (beat >= 0 && beat < sim.lastBeep && beat <= 3) {
      sfxLib.countdown(beat);
      sim.lastBeep = beat;
    }
    if (sim.countdown <= 0 && sim.lastBeep > 0) {
      sfxLib.countdown(0);
      sim.lastBeep = 0;
    }
    if (sim.countdown <= -0.5) {
      sim.phase = "racing";
      sim.countdown = 0;
    }
    syncHud();
    return;
  }

  if (sim.phase !== "racing") {
    if (sim.phase === "title") syncHud();
    return;
  }

  const player = sampleActions();
  if (player.pausePressed) {
    sim.phase = "paused";
    syncHud();
    return;
  }

  for (const k of sim.karts) {
    const actions = k.isPlayer ? player : aiActions(k);
    stepKart(k, dt, actions);
  }
  kartKartPush(dt);
  stepItems(dt);
  stepParticles(dt);
  updatePlaces();
  maybeFinish();
  syncHud();
}

export function visualUpdate(dt: number) {
  for (const s of sim.skids) s.life -= dt;
  if (sim.skids.length > 0) sim.skids = sim.skids.filter((s) => s.life > 0);
  if (sim.phase === "paused") {
    const a = sampleActions();
    if (a.pausePressed) {
      sim.phase = "racing";
      syncHud();
    }
  }
  void dt;
}

export function resumeRace() {
  if (sim.phase === "paused") sim.phase = "racing";
  syncHud();
}

export function pauseRace() {
  if (sim.phase === "racing") sim.phase = "paused";
  syncHud();
}

export function exitToTitle() {
  setQaKeys(null);
  sim.cupRound = 0;
  useGame.getState().setHud({ cupDone: false, cupStandings: [] });
  setupTitle();
  sim.phase = "title";
  syncHud();
}

if (typeof window !== "undefined") {
  window.__controlsTest = {
    getYaw: () => playerKart().yaw,
    getSpeed: () => playerKart().speed,
    setSteer: (v: number) => {
      setQaSteer(v);
    },
    setKeys: (codes: string[]) => {
      setQaKeys(codes);
      if (codes.length) forceRacing();
    },
  };
}
