import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { racerById, type RacerId } from "./racers";
import { sim } from "./sim";

function CharacterBits({ id, accent, helmet }: { id: RacerId; accent: string; helmet: string }) {
  return (
    <group position={[0, 0.52, -0.08]}>
      <mesh castShadow>
        <sphereGeometry args={[0.22, 14, 12]} />
        <meshStandardMaterial color={accent} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.08, 0.02]} castShadow>
        <sphereGeometry args={[0.18, 12, 10]} />
        <meshStandardMaterial color={helmet} roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[-0.07, 0.04, 0.16]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.07, 0.04, 0.16]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {id === "chili" && (
        <mesh position={[0, 0.24, 0]} rotation={[0.2, 0, 0]} castShadow>
          <coneGeometry args={[0.07, 0.22, 6]} />
          <meshStandardMaterial color={helmet} />
        </mesh>
      )}
      {id === "pip" && (
        <group>
          <mesh position={[-0.14, 0.18, 0]} castShadow>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color={helmet} />
          </mesh>
          <mesh position={[0.14, 0.18, 0]} castShadow>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color={helmet} />
          </mesh>
        </group>
      )}
      {id === "bolt" && (
        <group>
          <mesh position={[-0.1, 0.22, -0.02]} rotation={[0.2, 0, -0.2]} castShadow>
            <capsuleGeometry args={[0.04, 0.2, 4, 8]} />
            <meshStandardMaterial color={helmet} />
          </mesh>
          <mesh position={[0.1, 0.22, -0.02]} rotation={[0.2, 0, 0.2]} castShadow>
            <capsuleGeometry args={[0.04, 0.2, 4, 8]} />
            <meshStandardMaterial color={helmet} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function Wheel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.22, 12]} />
        <meshStandardMaterial color="#16161c" roughness={0.78} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.24, 10]} />
        <meshStandardMaterial color="#c9c3b8" metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.26, 8]} />
        <meshStandardMaterial color="#2a2a32" metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
}

function BoostJet({ index }: { index: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const k = sim.karts[index];
    const m = ref.current;
    if (!m) return;
    const on = !!k && k.boost > 0;
    m.visible = on;
    if (!on) return;
    const pulse = 0.85 + Math.sin(clock.elapsedTime * 28) * 0.15;
    m.scale.set(pulse, pulse * 1.1, pulse);
  });
  return (
    <mesh ref={ref} position={[0, 0.22, -0.95]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <coneGeometry args={[0.16, 0.7, 8]} />
      <meshStandardMaterial
        color="#ff7a2a"
        emissive="#ff4d12"
        emissiveIntensity={1.8}
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </mesh>
  );
}

export function KartView({ index }: { index: number }) {
  const ref = useRef<THREE.Group>(null);
  const bodyMat = useMemo(() => {
    const k = sim.karts[index];
    const r = racerById(k?.racerId ?? "chili");
    return new THREE.MeshStandardMaterial({
      color: r.color,
      roughness: 0.32,
      metalness: 0.22,
    });
  }, [index]);

  useFrame(() => {
    const k = sim.karts[index];
    const group = ref.current;
    if (!k || !group) {
      if (group) group.visible = false;
      return;
    }
    group.visible = true;
    const r = racerById(k.racerId);
    if (bodyMat.color.getHexString() !== r.color.replace("#", "").toLowerCase()) {
      bodyMat.color.set(r.color);
    }
    group.position.set(k.x, k.y, k.z);
    const fx = -Math.sin(k.yaw);
    const fz = -Math.cos(k.yaw);
    group.lookAt(k.x + fx, k.y, k.z + fz);
    group.rotateZ(k.visualRoll);
    const s = k.shrink > 0 ? 0.68 : 1;
    group.scale.setScalar(s);
  });

  const k = sim.karts[index];
  const racer = racerById(k?.racerId ?? "chili");

  return (
    <group ref={ref}>
      <mesh position={[0, 0.24, -0.04]} castShadow>
        <boxGeometry args={[1.12, 0.26, 1.58]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>
      <mesh position={[0, 0.32, 0.62]} castShadow>
        <boxGeometry args={[0.98, 0.22, 0.48]} />
        <meshStandardMaterial color={racer.color} roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.38, 0.88]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.72, 0.16, 0.28]} />
        <meshStandardMaterial color={racer.helmet} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.48, 0.18]} rotation={[0.45, 0, 0]}>
        <boxGeometry args={[0.78, 0.04, 0.62]} />
        <meshStandardMaterial color="#9ec4e8" transparent opacity={0.38} roughness={0.08} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.22, 0.08]}>
        <boxGeometry args={[0.72, 0.1, 0.72]} />
        <meshStandardMaterial color="#1e242c" roughness={0.7} />
      </mesh>
      <mesh position={[-0.28, 0.52, -0.78]} castShadow>
        <boxGeometry args={[0.06, 0.28, 0.06]} />
        <meshStandardMaterial color={racer.helmet} />
      </mesh>
      <mesh position={[0.28, 0.52, -0.78]} castShadow>
        <boxGeometry args={[0.06, 0.28, 0.06]} />
        <meshStandardMaterial color={racer.helmet} />
      </mesh>
      <mesh position={[0, 0.66, -0.78]} castShadow>
        <boxGeometry args={[1.18, 0.1, 0.28]} />
        <meshStandardMaterial color={racer.helmet} roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[-0.38, 0.28, 0.78]}>
        <boxGeometry args={[0.16, 0.1, 0.08]} />
        <meshStandardMaterial color="#fff4c8" emissive="#fff1b0" emissiveIntensity={0.85} />
      </mesh>
      <mesh position={[0.38, 0.28, 0.78]}>
        <boxGeometry args={[0.16, 0.1, 0.08]} />
        <meshStandardMaterial color="#fff4c8" emissive="#fff1b0" emissiveIntensity={0.85} />
      </mesh>
      <mesh position={[-0.34, 0.28, -0.82]}>
        <boxGeometry args={[0.14, 0.08, 0.06]} />
        <meshStandardMaterial color="#e23d4a" emissive="#e23d4a" emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[0.34, 0.28, -0.82]}>
        <boxGeometry args={[0.14, 0.08, 0.06]} />
        <meshStandardMaterial color="#e23d4a" emissive="#e23d4a" emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[-0.16, 0.18, -0.82]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.16, 8]} />
        <meshStandardMaterial color="#2a2a32" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.16, 0.18, -0.82]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.16, 8]} />
        <meshStandardMaterial color="#2a2a32" metalness={0.6} roughness={0.3} />
      </mesh>
      <CharacterBits id={racer.id} accent={racer.accent} helmet={racer.helmet} />
      <KartWheels index={index} />
      <BoostJet index={index} />
      <ShieldBubble index={index} />
    </group>
  );
}

function ShieldBubble({ index }: { index: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const k = sim.karts[index];
    const m = ref.current;
    if (!m) return;
    const on = !!k?.shield;
    m.visible = on;
    if (on) m.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.04);
  });
  return (
    <mesh ref={ref} visible={false}>
      <sphereGeometry args={[1.18, 16, 12]} />
      <meshStandardMaterial
        color="#9ecbff"
        transparent
        opacity={0.2}
        roughness={0.12}
        metalness={0.15}
        emissive="#4a90ff"
        emissiveIntensity={0.25}
      />
    </mesh>
  );
}

function KartWheels({ index }: { index: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const k = sim.karts[index];
    const g = group.current;
    if (!k || !g) return;
    const spin = k.wheelRot;
    const steer = k.steerAngle * 0.45;
    const wheels = g.children;
    if (wheels[0]) wheels[0].rotation.y = steer;
    if (wheels[1]) wheels[1].rotation.y = steer;
    for (const w of wheels) {
      for (const rim of w.children) {
        rim.rotation.x = spin;
      }
    }
  });
  return (
    <group ref={group}>
      <Wheel position={[-0.54, 0.3, 0.52]} />
      <Wheel position={[0.54, 0.3, 0.52]} />
      <Wheel position={[-0.54, 0.3, -0.58]} />
      <Wheel position={[0.54, 0.3, -0.58]} />
    </group>
  );
}
