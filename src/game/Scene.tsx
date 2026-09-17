import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { World } from "./World";
import { KartView } from "./KartModel";
import { sim, fixedUpdate, visualUpdate, playerKart } from "./sim";
import { activeTrack, sampleAt, queryTrack, ROAD_HALF } from "./track";
import { setEngine } from "./audio";
import { useGame } from "./store";

const FIXED = 1 / 60;
const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _lookCur = new THREE.Vector3();

function Ticker() {
  const acc = useRef(0);
  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1);
    acc.current += d;
    let steps = 0;
    while (acc.current >= FIXED && steps < 5) {
      fixedUpdate(FIXED);
      acc.current -= FIXED;
      steps++;
    }
    visualUpdate(d);
    const p = playerKart();
    const phase = sim.phase;
    setEngine(p.speed, p.boost > 0, phase === "racing" || phase === "countdown");
  });
  return null;
}

function ChaseCamera() {
  const inited = useRef(false);
  useFrame((state, delta) => {
    const d = Math.min(delta, 0.1);
    const phase = sim.phase;
    const p = playerKart();
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cam = state.camera as THREE.PerspectiveCamera;
    if (phase === "title") {
      const s = sampleAt(0.02);
      const t = state.clock.elapsedTime * 0.15;
      const sway = Math.sin(t) * 1.2;
      cam.position.set(
        s.x + s.rx * (8.5 + sway) - s.fx * 11,
        s.y + 4.4,
        s.z + s.rz * (8.5 + sway) - s.fz * 11,
      );
      cam.lookAt(s.x + s.fx * 8, s.y + 0.7, s.z + s.fz * 8);
      cam.fov = 42;
      cam.updateProjectionMatrix();
      inited.current = false;
      return;
    }

    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const portrait = state.size.height > state.size.width * 1.08;
    const back = portrait ? 6.4 : 8.6;
    const lift = portrait ? 2.65 : 3.55;
    const ahead = portrait ? 6.8 : 5.4;
    const q = queryTrack(p.x, p.z, p.hint);
    const off = Math.abs(q.lat) > ROAD_HALF;
    if (off) {
      const side = Math.sign(q.lat) || 1;
      _desired.set(
        p.x - fx * back * 0.7 + q.sample.rx * side * 5.5,
        p.y + lift + 1.35,
        p.z - fz * back * 0.7 + q.sample.rz * side * 5.5,
      );
      _look.set(q.sample.x + q.sample.fx * 8, q.sample.y + 0.7, q.sample.z + q.sample.fz * 8);
    } else {
      _desired.set(p.x - fx * back, p.y + lift, p.z - fz * back);
      _look.set(p.x + fx * ahead, p.y + 1.1, p.z + fz * ahead);
    }
    if (!inited.current) {
      cam.position.copy(_desired);
      _lookCur.copy(_look);
      inited.current = true;
    }
    const k = 1 - Math.exp(-4.4 * d);
    cam.position.lerp(_desired, k);
    _lookCur.lerp(_look, k);
    cam.lookAt(_lookCur);

    if (!reduced) {
      const shake = sim.trauma * sim.trauma;
      if (shake > 0.002) {
        cam.position.x += (Math.random() - 0.5) * shake * 0.42;
        cam.position.y += (Math.random() - 0.5) * shake * 0.28;
        cam.position.z += (Math.random() - 0.5) * shake * 0.42;
      }
    }

    const wantFov =
      (portrait ? 43 : 54) + Math.min(Math.abs(p.speed) * 0.28, 10) + (p.boost > 0 ? 4 : 0);
    cam.fov += (wantFov - cam.fov) * (1 - Math.exp(-5 * d));
    cam.updateProjectionMatrix();
  });
  return null;
}

function Karts() {
  const count = useGame((s) => s.racers);
  const n = Math.max(count, sim.karts.length, 1);
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <KartView key={i} index={i} />
      ))}
    </>
  );
}

function Atmosphere() {
  const rev = useGame((s) => s.trackRev);
  const t = activeTrack;
  void rev;
  return (
    <>
      <color attach="background" args={[t.sky]} />
      <fog attach="fog" args={[t.fog, 70, 260]} />
      <ambientLight intensity={0.42} />
      <hemisphereLight args={[t.hemiSky, t.hemiGround, 0.62]} />
      <directionalLight
        castShadow
        position={[70, 90, 36]}
        intensity={t.sun}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={260}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
        shadow-bias={-0.00025}
      />
      <directionalLight position={[-40, 30, -50]} intensity={0.35} color={t.hemiSky} />
    </>
  );
}

export function RaceCanvas() {
  return (
    <Canvas
      className="absolute inset-0 h-full w-full"
      shadows
      dpr={[1, 2]}
      camera={{ position: [12, 8, 18], fov: 50, near: 1.15, far: 420 }}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.12,
      }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFShadowMap;
      }}
    >
      <Atmosphere />
      <World />
      <Karts />
      <ChaseCamera />
      <Ticker />
    </Canvas>
  );
}
