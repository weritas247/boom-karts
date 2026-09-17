export type Actions = {
  throttle: number;
  steer: number;
  drift: boolean;
  item: boolean;
  pausePressed: boolean;
};

const GAME_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "KeyE",
  "KeyQ",
]);

const keys = new Set<string>();
let qaKeys: Set<string> | null = null;
let qaSteer: number | null = null;
let prevPause = false;

let touchSteer = 0;
let touchThrottle = 0;
let touchDrift = false;
let touchItem = false;
let listenersBound = false;

function radialDeadzone(x: number, y: number, dz = 0.16): { x: number; y: number } {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

function onKeyDown(e: KeyboardEvent) {
  keys.add(e.code);
  if (GAME_CODES.has(e.code)) e.preventDefault();
}

function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.code);
}

function onBlur() {
  keys.clear();
}

export function initInput() {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) keys.clear();
  });
}

export function setQaKeys(codes: string[] | null) {
  qaKeys = codes ? new Set(codes) : null;
  if (!codes || codes.length === 0) qaSteer = null;
}

export function setQaSteer(v: number | null) {
  qaSteer = v;
}

export function setTouchSteer(v: number) {
  touchSteer = Math.max(-1, Math.min(1, v));
}

export function setTouchThrottle(v: number) {
  touchThrottle = Math.max(-1, Math.min(1, v));
}

export function setTouchDrift(v: boolean) {
  touchDrift = v;
}

export function setTouchItem(v: boolean) {
  touchItem = v;
}

export function clearTouch() {
  touchSteer = 0;
  touchThrottle = 0;
  touchDrift = false;
  touchItem = false;
}

export function sampleActions(): Actions {
  const k = qaKeys ?? keys;
  let steer = 0;
  let throttle = 0;
  if (k.has("KeyA") || k.has("ArrowLeft")) steer += 1;
  if (k.has("KeyD") || k.has("ArrowRight")) steer -= 1;
  if (k.has("KeyW") || k.has("ArrowUp")) throttle += 1;
  if (k.has("KeyS") || k.has("ArrowDown")) throttle -= 1;

  steer += touchSteer;
  throttle += touchThrottle;

  if (qaSteer != null) steer = qaSteer;

  if (typeof navigator !== "undefined") {
    const pads = navigator.getGamepads?.() ?? [];
    for (const gp of pads) {
      if (!gp) continue;
      const stick = radialDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
      steer += -stick.x;
      if (stick.y < -0.12) throttle += -stick.y;
      if (stick.y > 0.12) throttle -= stick.y;
      const rt = gp.buttons[7]?.value ?? 0;
      const lt = gp.buttons[6]?.value ?? 0;
      if (rt > 0.08) throttle += rt;
      if (lt > 0.08) throttle -= lt;
      if (gp.buttons[12]?.pressed) throttle += 1;
      if (gp.buttons[13]?.pressed) throttle -= 1;
      if (gp.buttons[14]?.pressed) steer += 1;
      if (gp.buttons[15]?.pressed) steer -= 1;
    }
  }

  steer = Math.max(-1, Math.min(1, steer));
  throttle = Math.max(-1, Math.min(1, throttle));

  let drift = k.has("Space") || k.has("ShiftLeft") || k.has("KeyQ") || touchDrift;
  let item = k.has("KeyE") || k.has("ShiftRight") || k.has("KeyF") || touchItem;
  let pause = k.has("Escape") || k.has("KeyP");

  if (typeof navigator !== "undefined") {
    const pads = navigator.getGamepads?.() ?? [];
    for (const gp of pads) {
      if (!gp) continue;
      if (gp.buttons[1]?.pressed || gp.buttons[5]?.pressed || gp.buttons[4]?.pressed) drift = true;
      if (gp.buttons[0]?.pressed || gp.buttons[2]?.pressed) item = true;
      if (gp.buttons[9]?.pressed) pause = true;
    }
  }

  const pausePressed = pause && !prevPause;
  prevPause = pause;

  return { throttle, steer, drift, item, pausePressed };
}
