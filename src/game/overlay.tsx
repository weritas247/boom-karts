import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Flag,
  Gauge,
  Pause,
  Rocket,
  Shield,
  Target,
  Triangle,
  Volume2,
  VolumeX,
  Zap,
  Disc,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RACERS, racerById } from "./racers";
import { CUP_TRACKS, TOTAL_LAPS, TRACKS, samples, type TrackId } from "./track";
import { useGame } from "./store";
import {
  beginCountdown,
  continueCup,
  exitToTitle,
  pauseRace,
  previewTrack,
  resumeRace,
  setPlayerRacer,
  sim,
} from "./sim";
import { setMuted, unlockAudio } from "./audio";
import {
  setTouchDrift,
  setTouchItem,
  setTouchSteer,
  setTouchThrottle,
  clearTouch,
} from "./input";
import type { Difficulty, ItemKind, RaceMode } from "./types";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  const whole = Math.floor(rem);
  const frac = Math.floor((rem - whole) * 100);
  return `${m}:${String(whole).padStart(2, "0")}.${String(frac).padStart(2, "0")}`;
}

function placeLabel(n: number) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

const ITEM_ICON: Record<ItemKind, typeof Rocket> = {
  nitro: Rocket,
  peel: Triangle,
  ricochet: Disc,
  seeker: Target,
  shield: Shield,
  zap: Zap,
};

const ITEM_NAME: Record<ItemKind, string> = {
  nitro: "니트로",
  peel: "껍질",
  ricochet: "리코셰",
  seeker: "시커",
  shield: "실드",
  zap: "잽",
};

const ITEM_CYCLE: ItemKind[] = ["nitro", "peel", "ricochet", "seeker", "shield", "zap"];

const MODE_LABEL: Record<RaceMode, string> = {
  vs: "레이스",
  trial: "타임 트라이얼",
  cup: "코럴 컵",
};

export function Overlay() {
  const phase = useGame((s) => s.phase);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-fg">
      {phase === "title" && <TitleScreen />}
      {(phase === "countdown" || phase === "racing" || phase === "paused") && <Hud />}
      {phase === "paused" && <PauseMenu />}
      {phase === "results" && <Results />}
      {(phase === "racing" || phase === "countdown") && <TouchControls />}
    </div>
  );
}

function TitleScreen() {
  const racerId = useGame((s) => s.racerId);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const setRacer = useGame((s) => s.setRacer);
  const mode = useGame((s) => s.mode);
  const difficulty = useGame((s) => s.difficulty);
  const trackId = useGame((s) => s.trackId);
  const bests = useGame((s) => s.trackBests);
  const setHud = useGame((s) => s.setHud);

  const pickMode = (next: RaceMode) => {
    setHud({ mode: next });
    if (next === "cup") previewTrack("coral");
  };

  const pickTrack = (id: TrackId) => {
    setHud({ mode: mode === "cup" ? "vs" : mode });
    previewTrack(id);
  };

  return (
    <div className="pointer-events-auto flex h-full flex-col justify-between gap-4 overflow-y-auto p-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Beta</p>
          <h1 className="mt-1 font-display text-4xl leading-none text-balance sm:text-6xl">
            BOOM KARTS
          </h1>
          <p className="mt-3 max-w-md text-pretty text-sm text-muted">
            드리프트로 미니터보. 아이템은 뒤에서 쓰고, 3랩 먼저 들어오면 이깁니다.
          </p>
        </div>
        <button
          type="button"
          aria-label={muted ? "소리 켜기" : "음소거"}
          className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-fg"
          onClick={() => {
            toggleMute();
            setMuted(!useGame.getState().muted);
          }}
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </header>

      <div className="flex flex-col gap-5 sm:max-w-xl">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted">모드</p>
          <div className="grid grid-cols-3 gap-2">
            {(["vs", "trial", "cup"] as RaceMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => pickMode(m)}
                className={cn(
                  "min-h-11 rounded-md border px-2 py-2 font-display text-sm",
                  mode === m ? "border-fg bg-surface-2" : "border-border bg-surface",
                )}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        {mode !== "cup" && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted">트랙</p>
            <div className="grid grid-cols-3 gap-2">
              {TRACKS.map((t) => {
                const on = t.id === trackId;
                const best = bests[t.id];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pickTrack(t.id)}
                    className={cn(
                      "flex min-h-16 flex-col items-start rounded-md border px-3 py-2 text-left",
                      on ? "border-fg bg-surface-2" : "border-border bg-surface",
                    )}
                  >
                    <span className="font-display text-sm">{t.nameKo}</span>
                    <span className="mt-0.5 text-[11px] text-muted">{t.tag}</span>
                    <span className="mt-1 text-[11px] tabular-nums text-muted">
                      {best != null ? formatTime(best) : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mode === "cup" && (
          <p className="text-xs text-muted">
            코럴 → 듄 → 릿지, 세 경기 합산. {difficulty === "hard" ? "하드 AI." : "보통 AI."}
          </p>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted">레이서</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {RACERS.map((r) => {
              const on = r.id === racerId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRacer(r.id);
                    setPlayerRacer(r.id);
                  }}
                  className={cn(
                    "flex min-h-11 flex-col items-start rounded-md border px-3 py-2 text-left",
                    on ? "border-fg bg-surface-2" : "border-border bg-surface",
                  )}
                >
                  <span className="mb-1 block size-2.5 rounded-full" style={{ background: r.color }} />
                  <span className="font-display text-sm">{r.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {mode !== "trial" && (
          <div className="flex gap-2">
            {(["normal", "hard"] as Difficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setHud({ difficulty: d })}
                className={cn(
                  "min-h-10 rounded-md border px-3 font-display text-sm",
                  difficulty === d ? "border-fg bg-surface-2" : "border-border bg-surface",
                )}
              >
                {d === "normal" ? "보통" : "하드"}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            className="min-h-12 min-w-40"
            onClick={() => {
              unlockAudio();
              beginCountdown(useGame.getState().racerId);
            }}
          >
            {mode === "cup" ? "컵 시작" : "출발"}
          </Button>
          <p className="text-xs text-muted">
            W 가속 · A/D 조향 · Space 드리프트 · E 아이템
          </p>
        </div>
      </div>
    </div>
  );
}

function Hud() {
  const place = useGame((s) => s.place);
  const lap = useGame((s) => s.lap);
  const time = useGame((s) => s.time);
  const speed = useGame((s) => s.speed);
  const item = useGame((s) => s.item);
  const itemSpin = useGame((s) => s.itemSpin);
  const countdown = useGame((s) => s.countdown);
  const phase = useGame((s) => s.phase);
  const wrongWay = useGame((s) => s.wrongWay);
  const offTrack = useGame((s) => s.offTrack);
  const driftCharge = useGame((s) => s.driftCharge);
  const boosting = useGame((s) => s.boosting);
  const shield = useGame((s) => s.shield);
  const trackId = useGame((s) => s.trackId);
  const mode = useGame((s) => s.mode);
  const cupRound = useGame((s) => s.cupRound);
  const track = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0]!;

  return (
    <>
      <div className="pointer-events-none absolute top-0 left-0 right-0 flex items-start justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <p className="font-display text-4xl leading-none tabular-nums">{placeLabel(place)}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">
            랩 {lap}/{TOTAL_LAPS}
            {mode === "cup" ? ` · ${cupRound + 1}/3` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg tabular-nums">{formatTime(time)}</p>
          <p className="text-xs text-muted">{track.nameKo}</p>
        </div>
        <button
          type="button"
          aria-label="일시정지"
          className="pointer-events-auto flex size-11 items-center justify-center rounded-md border border-border bg-surface/90 text-fg"
          onClick={() => pauseRace()}
        >
          <Pause className="size-4" />
        </button>
      </div>

      <div className="absolute top-[4.6rem] right-4 sm:top-20">
        <Minimap />
      </div>

      <div className="absolute bottom-4 left-4 flex items-end gap-3 pb-[max(0px,env(safe-area-inset-bottom))] max-sm:bottom-[10.75rem]">
        <div className="rounded-lg border border-border bg-surface/85 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted">
            <Gauge className="size-3" /> 속도
          </p>
          <p className="font-display text-2xl tabular-nums leading-none">
            {Math.round(speed * 4.2)}
          </p>
        </div>
        {shield && (
          <div className="rounded-lg border border-border bg-surface/85 px-3 py-2 text-xs text-muted">
            실드
          </div>
        )}
        {boosting && (
          <div className="rounded-lg border border-border bg-primary px-3 py-2 text-xs text-primary-fg">
            부스트
          </div>
        )}
      </div>

      <div className="absolute bottom-4 right-4 pb-[max(0px,env(safe-area-inset-bottom))] max-sm:bottom-[10.75rem]">
        <ItemSlot item={item} spin={itemSpin} />
      </div>

      {driftCharge > 0 && (
        <div className="absolute bottom-24 left-1/2 w-40 -translate-x-1/2 max-sm:bottom-52">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface">
            <div
              className={cn("h-full rounded-full", driftCharge > 1.5 ? "bg-primary" : "bg-fg")}
              style={{ width: `${Math.min(100, (driftCharge / 1.6) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {phase === "countdown" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <p className="font-display text-7xl sm:text-8xl">
            {countdown > 0 ? countdown : "고!"}
          </p>
          <p className="max-w-xs text-center text-xs text-muted">
            W 가속 · A/D 조향 · Space 드리프트 · E 아이템
          </p>
        </div>
      )}

      {wrongWay && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 rounded-md bg-primary px-4 py-2 font-display text-sm text-primary-fg">
          반대 방향
        </div>
      )}
      {offTrack && !wrongWay && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 rounded-md bg-surface/90 px-4 py-2 font-display text-sm text-fg">
          트랙으로
        </div>
      )}
    </>
  );
}

function ItemSlot({ item, spin }: { item: ItemKind | null; spin: number }) {
  const shown: ItemKind | null =
    spin > 0 ? ITEM_CYCLE[Math.floor((1.05 - spin) * 18) % ITEM_CYCLE.length]! : item;
  const Icon = shown ? ITEM_ICON[shown] : Flag;
  return (
    <div className="flex size-16 flex-col items-center justify-center rounded-lg border border-border bg-surface/90">
      <Icon className={cn("size-5", spin > 0 && "animate-pulse")} />
      <span className="mt-1 text-[10px] uppercase tracking-wider text-muted">
        {shown ? ITEM_NAME[shown] : "없음"}
      </span>
    </div>
  );
}

function PauseMenu() {
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-bg/55 p-5">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-2xl">일시정지</h2>
        <p className="mt-1 text-sm text-muted">3랩 · 드리프트로 터보</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => resumeRace()}>계속</Button>
          <Button variant="ghost" onClick={() => beginCountdown(useGame.getState().racerId)}>
            재시작
          </Button>
          <Button variant="quiet" onClick={() => exitToTitle()}>
            타이틀
          </Button>
        </div>
      </div>
    </div>
  );
}

function Results() {
  const results = useGame((s) => s.results);
  const best = useGame((s) => s.personalBest);
  const mode = useGame((s) => s.mode);
  const cupStandings = useGame((s) => s.cupStandings);
  const cupDone = useGame((s) => s.cupDone);
  const cupRound = useGame((s) => s.cupRound);
  const playerId = useGame((s) => s.racerId);

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-end justify-center bg-bg/50 p-5 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-2xl">
          {mode === "cup" ? (cupDone ? "컵 우승 테이블" : `라운드 ${cupRound + 1}/3`) : "피니시"}
        </h2>
        {best != null && mode !== "cup" && (
          <p className="mt-1 text-sm text-muted">개인 기록 {formatTime(best)}</p>
        )}
        <ol className="mt-5 space-y-2">
          {mode === "cup"
            ? cupStandings.map((row, i) => {
                const mine = row.racerId === playerId;
                return (
                  <li
                    key={row.racerId}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2",
                      mine ? "border-fg bg-surface-2" : "border-border bg-surface-2/60",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-8 font-display tabular-nums">{placeLabel(i + 1)}</span>
                      <span className="size-2.5 rounded-full" style={{ background: racerById(row.racerId).color }} />
                      <span>{row.name}</span>
                    </span>
                    <span className="text-sm tabular-nums text-muted">{row.points} pts</span>
                  </li>
                );
              })
            : results.map((row) => {
                const mine = row.racerId === playerId;
                return (
                  <li
                    key={row.id}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2",
                      mine ? "border-fg bg-surface-2" : "border-border bg-surface-2/60",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-8 font-display tabular-nums">{placeLabel(row.place)}</span>
                      <span className="size-2.5 rounded-full" style={{ background: racerById(row.racerId).color }} />
                      <span>{row.name}</span>
                    </span>
                    <span className="text-sm tabular-nums text-muted">{formatTime(row.time)}</span>
                  </li>
                );
              })}
        </ol>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {mode === "cup" && !cupDone ? (
            <Button className="flex-1" onClick={() => continueCup()}>
              다음 트랙 · {TRACKS.find((t) => t.id === CUP_TRACKS[cupRound + 1])?.nameKo}
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => beginCountdown(useGame.getState().racerId)}>
              다시 하기
            </Button>
          )}
          <Button variant="ghost" className="flex-1" onClick={() => exitToTitle()}>
            타이틀
          </Button>
        </div>
      </div>
    </div>
  );
}

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const rev = useGame((s) => s.trackRev);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let raf = 0;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(11,16,24,0.72)";
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 10);
      ctx.fill();
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      for (let i = 0; i < samples.length; i += 4) {
        const s = samples[i]!;
        minX = Math.min(minX, s.x);
        maxX = Math.max(maxX, s.x);
        minZ = Math.min(minZ, s.z);
        maxZ = Math.max(maxZ, s.z);
      }
      const pad = 14;
      const sx = (w - pad * 2) / (maxX - minX || 1);
      const sz = (h - pad * 2) / (maxZ - minZ || 1);
      const sc = Math.min(sx, sz);
      const px = (x: number) => pad + (x - minX) * sc;
      const pz = (z: number) => pad + (z - minZ) * sc;
      ctx.strokeStyle = "#8b93a1";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= samples.length; i += 3) {
        const s = samples[i % samples.length]!;
        if (i === 0) ctx.moveTo(px(s.x), pz(s.z));
        else ctx.lineTo(px(s.x), pz(s.z));
      }
      ctx.closePath();
      ctx.stroke();
      for (const k of sim.karts) {
        ctx.fillStyle = k.isPlayer ? "#f3efe6" : racerById(k.racerId).color;
        ctx.beginPath();
        ctx.arc(px(k.x), pz(k.z), k.isPlayer ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [rev]);
  return <canvas ref={ref} width={148} height={148} className="size-[6.75rem] rounded-lg sm:size-[9.25rem]" />;
}

function TouchControls() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setTouch(coarse || window.innerWidth < 720);
  }, []);
  if (!touch) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Stick />
      <div className="pointer-events-auto flex flex-col gap-2">
        <HoldButton label="아이템" onHold={setTouchItem} />
        <HoldButton label="드리프트" onHold={setTouchDrift} />
      </div>
    </div>
  );
}

function HoldButton({ label, onHold }: { label: string; onHold: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className="min-h-12 min-w-20 rounded-lg border border-border bg-surface/90 px-4 font-display text-sm"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
    >
      {label}
    </button>
  );
}

function Stick() {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const R = 52;

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const o = origin.current;
    if (!o) return;
    let dx = e.clientX - o.x;
    let dy = e.clientY - o.y;
    const m = Math.hypot(dx, dy);
    if (m > R) {
      dx = (dx / m) * R;
      dy = (dy / m) * R;
    }
    setKnob({ x: dx, y: dy });
    setTouchSteer(-dx / R);
    setTouchThrottle(-dy / R);
  };

  const end = () => {
    origin.current = null;
    setKnob({ x: 0, y: 0 });
    clearTouch();
  };

  return (
    <div
      className="pointer-events-auto relative size-28 rounded-full border border-border bg-surface/70"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        className="absolute size-12 rounded-full bg-fg/80"
        style={{
          left: `calc(50% + ${knob.x}px - 24px)`,
          top: `calc(50% + ${knob.y}px - 24px)`,
        }}
      />
    </div>
  );
}
