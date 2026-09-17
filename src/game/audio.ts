let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let engine: OscillatorNode | null = null;
let engineGain: GainNode | null = null;
let engineFilter: BiquadFilterNode | null = null;
let muted = false;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfx = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    sfx.gain.value = 0.9;
    sfx.connect(master);
    master.connect(ctx.destination);
  }
  return ctx;
}

export function unlockAudio() {
  const ac = ensure();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  startEngine();
}

export function setMuted(next: boolean) {
  muted = next;
  if (master && ctx) {
    master.gain.setTargetAtTime(next ? 0 : 0.7, ctx.currentTime, 0.04);
  }
}

export function isMuted() {
  return muted;
}

function startEngine() {
  const ac = ensure();
  if (!ac || !sfx || engine) return;
  engine = ac.createOscillator();
  engine.type = "sawtooth";
  engine.frequency.value = 55;
  engineFilter = ac.createBiquadFilter();
  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 420;
  engineGain = ac.createGain();
  engineGain.gain.value = 0;
  engine.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(sfx);
  engine.start();
}

export function setEngine(speed: number, boosting: boolean, active: boolean) {
  if (!ctx || !engine || !engineGain || !engineFilter) return;
  const rpm = Math.abs(speed);
  const target = active ? Math.min(0.07, 0.012 + rpm * 0.0018) : 0;
  engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.05);
  engine.frequency.setTargetAtTime(48 + rpm * 9 + (boosting ? 28 : 0), ctx.currentTime, 0.08);
  engineFilter.frequency.setTargetAtTime(360 + rpm * 18, ctx.currentTime, 0.1);
}

function beep(freq: number, dur: number, type: OscillatorType, gain = 0.12, slide = 0) {
  const ac = ensure();
  if (!ac || !sfx) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, ac.currentTime + dur);
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.connect(g);
  g.connect(sfx);
  o.start();
  o.stop(ac.currentTime + dur + 0.02);
}

function noiseBurst(dur: number, gain = 0.1, freq = 900) {
  const ac = ensure();
  if (!ac || !sfx) return;
  const n = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = n.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = n;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  src.connect(f);
  f.connect(g);
  g.connect(sfx);
  src.start();
}

export const sfxLib = {
  countdown: (n: number) => beep(n <= 0 ? 880 : 420, n <= 0 ? 0.28 : 0.12, "square", 0.1),
  item: () => {
    beep(620, 0.08, "square", 0.09);
    beep(880, 0.1, "square", 0.07);
  },
  boost: () => beep(180, 0.28, "sawtooth", 0.08, 420),
  hit: () => noiseBurst(0.22, 0.16, 420),
  peel: () => beep(140, 0.18, "triangle", 0.1, -80),
  zap: () => {
    beep(1200, 0.08, "square", 0.08, -400);
    noiseBurst(0.18, 0.1, 1800);
  },
  finish: () => {
    beep(523, 0.14, "square", 0.09);
    setTimeout(() => beep(659, 0.14, "square", 0.09), 90);
    setTimeout(() => beep(784, 0.28, "square", 0.1), 180);
  },
  drift: () => noiseBurst(0.08, 0.04, 1100),
  spin: () => beep(740, 0.05, "square", 0.05),
};
