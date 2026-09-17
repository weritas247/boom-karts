import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  activeTrack,
  isTunnelT,
  palmSpots,
  rockSpots,
  ROAD_HALF,
  sampleAt,
  samples,
  trackLength,
  WALL_HALF,
} from "./track";
import { sim } from "./sim";
import { useGame } from "./store";
import { getTextures } from "./textures";

function buildRibbon(half: number, yOff: number, vRepeat: number) {
  const n = samples.length;
  const positions = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = samples[i]!;
    const o = i * 6;
    positions[o] = s.x - s.rx * half;
    positions[o + 1] = s.y + yOff;
    positions[o + 2] = s.z - s.rz * half;
    positions[o + 3] = s.x + s.rx * half;
    positions[o + 4] = s.y + yOff;
    positions[o + 5] = s.z + s.rz * half;
    const v = (i / n) * vRepeat;
    uvs[i * 4] = 0;
    uvs[i * 4 + 1] = v;
    uvs[i * 4 + 2] = 1;
    uvs[i * 4 + 3] = v;
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const c = ((i + 1) % n) * 2;
    indices.push(a, c, a + 1, a + 1, c, c + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildStrip(lat: number, half: number, yOff: number, dashed = false) {
  const n = samples.length;
  const positions: number[] = [];
  const indices: number[] = [];
  let v = 0;
  for (let i = 0; i < n; i++) {
    if (dashed && Math.floor(i / 5) % 2 === 1) continue;
    const s = samples[i]!;
    const s2 = samples[(i + 1) % n]!;
    if (dashed && Math.floor((i + 1) / 5) % 2 === 1) continue;
    const l = lat - half;
    const r = lat + half;
    const a = v;
    positions.push(
      s.x + s.rx * l,
      s.y + yOff,
      s.z + s.rz * l,
      s.x + s.rx * r,
      s.y + yOff,
      s.z + s.rz * r,
      s2.x + s2.rx * l,
      s2.y + yOff,
      s2.z + s2.rz * l,
      s2.x + s2.rx * r,
      s2.y + yOff,
      s2.z + s2.rz * r,
    );
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    v += 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildEdgeWalls(lat: number, y0: number, y1: number) {
  const n = samples.length;
  const positions = new Float32Array(n * 2 * 3);
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = samples[i]!;
    const x = s.x + s.rx * lat;
    const z = s.z + s.rz * lat;
    const o = i * 6;
    positions[o] = x;
    positions[o + 1] = s.y + y0;
    positions[o + 2] = z;
    positions[o + 3] = x;
    positions[o + 4] = s.y + y1;
    positions[o + 5] = z;
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const b = ((i + 1) % n) * 2;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildCurb() {
  const n = samples.length;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const innerW = ROAD_HALF - 0.02;
  const outerW = ROAD_HALF + 1.35;
  let base = 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const s = samples[i]!;
      const ix = s.x + s.rx * side * innerW;
      const iz = s.z + s.rz * side * innerW;
      const ox = s.x + s.rx * side * outerW;
      const oz = s.z + s.rz * side * outerW;
      positions.push(
        ix,
        s.y + 0.14,
        iz,
        ix,
        s.y + 0.34,
        iz,
        ox,
        s.y + 0.36,
        oz,
        ox,
        s.y + 0.04,
        oz,
      );
      const stripe = Math.floor(i / 4) % 2 === 0;
      const c = stripe ? [0.94, 0.12, 0.16] : [0.97, 0.96, 0.92];
      for (let k = 0; k < 4; k++) colors.push(c[0]!, c[1]!, c[2]!);
    }
    for (let i = 0; i < n; i++) {
      const a = base + i * 4;
      const b = base + ((i + 1) % n) * 4;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
      indices.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
      indices.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3);
    }
    base += n * 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function Track() {
  const rev = useGame((s) => s.trackRev);
  const theme = activeTrack;
  const dirt = useMemo(() => buildRibbon(ROAD_HALF + 5.6, 0.03, 22), [trackLength, rev]);
  const road = useMemo(() => buildRibbon(ROAD_HALF, 0.2, 48), [trackLength, rev]);
  const wallL = useMemo(() => buildEdgeWalls(-ROAD_HALF, -0.16, 0.2), [trackLength, rev]);
  const wallR = useMemo(() => buildEdgeWalls(ROAD_HALF, -0.16, 0.2), [trackLength, rev]);
  const curb = useMemo(() => buildCurb(), [trackLength, rev]);
  const edgeL = useMemo(() => buildStrip(-(ROAD_HALF - 0.4), 0.14, 0.215), [trackLength, rev]);
  const edgeR = useMemo(() => buildStrip(ROAD_HALF - 0.4, 0.14, 0.215), [trackLength, rev]);
  const mid = useMemo(() => buildStrip(0, 0.1, 0.215, true), [trackLength, rev]);
  useLayoutEffect(
    () => () => {
      dirt.dispose();
      road.dispose();
      wallL.dispose();
      wallR.dispose();
      curb.dispose();
      edgeL.dispose();
      edgeR.dispose();
      mid.dispose();
    },
    [dirt, road, wallL, wallR, curb, edgeL, edgeR, mid],
  );
  const tex = useMemo(() => getTextures(), []);
  return (
    <group>
      <mesh geometry={dirt} receiveShadow>
        <meshStandardMaterial
          color={theme.dirt}
          map={tex.dirt}
          roughness={1}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={road} receiveShadow>
        <meshStandardMaterial
          color={theme.road}
          map={tex.asphalt}
          roughness={0.92}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh geometry={wallL}>
        <meshStandardMaterial color="#2f333a" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={wallR}>
        <meshStandardMaterial color="#2f333a" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={edgeL} receiveShadow>
        <meshStandardMaterial color="#f4f1ea" roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={edgeR} receiveShadow>
        <meshStandardMaterial color="#f4f1ea" roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={mid} receiveShadow>
        <meshStandardMaterial color="#f0c94a" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={curb} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.42} side={THREE.DoubleSide} />
      </mesh>
      <FinishGate />
    </group>
  );
}

function FinishGate() {
  const s = sampleAt(0);
  const yaw = Math.atan2(-s.fx, -s.fz);
  const tex = useMemo(() => getTextures(), []);
  return (
    <group position={[s.x, s.y, s.z]} rotation={[0, yaw, 0]}>
      <mesh position={[-ROAD_HALF - 0.25, 2.05, 0]} castShadow>
        <boxGeometry args={[0.32, 4.1, 0.32]} />
        <meshStandardMaterial color="#f3efe6" roughness={0.45} />
      </mesh>
      <mesh position={[ROAD_HALF + 0.25, 2.05, 0]} castShadow>
        <boxGeometry args={[0.32, 4.1, 0.32]} />
        <meshStandardMaterial color="#f3efe6" roughness={0.45} />
      </mesh>
      <mesh position={[0, 3.95, 0]} castShadow>
        <boxGeometry args={[ROAD_HALF * 2 + 1.4, 0.7, 0.22]} />
        <meshStandardMaterial map={tex.checker} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROAD_HALF * 2 - 0.4, 1.8]} />
        <meshStandardMaterial map={tex.checker} roughness={0.55} />
      </mesh>
    </group>
  );
}

function Palms() {
  const rev = useGame((s) => s.trackRev);
  const spots = useMemo(() => palmSpots(), [rev]);
  const kind = activeTrack.props;
  const trunk = useRef<THREE.InstancedMesh>(null);
  const leaf = useRef<THREE.InstancedMesh>(null);
  const leaf2 = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    spots.forEach((p, i) => {
      dummy.position.set(p.x, (kind === "cactus" ? 1.15 : 2) * p.scale, p.z);
      dummy.rotation.set(0, p.rot, 0);
      dummy.scale.set(p.scale, p.scale, p.scale);
      dummy.updateMatrix();
      trunk.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, (kind === "cactus" ? 2.2 : 4.15) * p.scale, p.z);
      dummy.scale.set(p.scale * (kind === "pine" ? 1.1 : 1.6), p.scale * (kind === "pine" ? 1.8 : 1.1), p.scale * (kind === "cactus" ? 1.1 : 1.6));
      dummy.updateMatrix();
      leaf.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, (kind === "cactus" ? 1.7 : 3.55) * p.scale, p.z);
      dummy.rotation.set(0, p.rot + 0.6, 0);
      dummy.scale.set(p.scale * 1.25, p.scale * 0.85, p.scale * 1.25);
      dummy.updateMatrix();
      leaf2.current?.setMatrixAt(i, dummy.matrix);
    });
    if (trunk.current) trunk.current.instanceMatrix.needsUpdate = true;
    if (leaf.current) leaf.current.instanceMatrix.needsUpdate = true;
    if (leaf2.current) leaf2.current.instanceMatrix.needsUpdate = true;
  }, [spots, kind]);
  const trunkColor = kind === "cactus" ? "#3d7a3a" : kind === "pine" ? "#4a3424" : "#6a4024";
  const leafColor = kind === "cactus" ? "#5aa34a" : kind === "pine" ? "#1f5c38" : "#2f8a4a";
  return (
    <group>
      <instancedMesh ref={trunk} args={[undefined, undefined, spots.length]} castShadow>
        <cylinderGeometry args={[kind === "cactus" ? 0.22 : 0.16, 0.26, kind === "cactus" ? 2.4 : 4, 6]} />
        <meshStandardMaterial color={trunkColor} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={leaf} args={[undefined, undefined, spots.length]} castShadow>
        <coneGeometry args={[kind === "cactus" ? 0.55 : 1.15, kind === "pine" ? 2.4 : 1.6, 5]} />
        <meshStandardMaterial color={leafColor} roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={leaf2} args={[undefined, undefined, spots.length]} castShadow>
        <coneGeometry args={[1.0, 1.2, 5]} />
        <meshStandardMaterial color={leafColor} roughness={0.75} />
      </instancedMesh>
    </group>
  );
}

function Rocks() {
  const rev = useGame((s) => s.trackRev);
  const spots = useMemo(() => rockSpots(), [rev]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    spots.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0.2, p.rot, 0.1);
      dummy.scale.set(p.scale, p.scale * 0.7, p.scale);
      dummy.updateMatrix();
      ref.current?.setMatrixAt(i, dummy.matrix);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} castShadow>
      <dodecahedronGeometry args={[0.7, 0]} />
      <meshStandardMaterial color="#8b8478" roughness={0.95} />
    </instancedMesh>
  );
}

function TunnelSafe() {
  const rev = useGame((s) => s.trackRev);
  const rings = useMemo(() => {
    const out: { x: number; y: number; z: number; yaw: number }[] = [];
    for (let i = 0; i < samples.length; i += 5) {
      const s = samples[i]!;
      if (!isTunnelT(s.t)) continue;
      out.push({ x: s.x, y: s.y, z: s.z, yaw: Math.atan2(-s.fx, -s.fz) });
    }
    return out;
  }, [rev]);
  return (
    <group>
      {rings.map((r, i) => (
        <group key={i} position={[r.x, r.y, r.z]} rotation={[0, r.yaw, 0]}>
          <mesh position={[-WALL_HALF - 0.1, 1.45, 0]}>
            <boxGeometry args={[0.45, 2.9, 3.4]} />
            <meshStandardMaterial color="#6e665c" roughness={0.85} />
          </mesh>
          <mesh position={[WALL_HALF + 0.1, 1.45, 0]}>
            <boxGeometry args={[0.45, 2.9, 3.4]} />
            <meshStandardMaterial color="#6e665c" roughness={0.85} />
          </mesh>
          <mesh position={[0, 3.05, 0]}>
            <boxGeometry args={[WALL_HALF * 2 + 1.1, 0.4, 3.4]} />
            <meshStandardMaterial color="#5c564e" roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Bridge() {
  const rev = useGame((s) => s.trackRev);
  const pillars = useMemo(() => {
    const out: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < samples.length; i += 8) {
      const s = samples[i]!;
      if (s.y < 1.15) continue;
      out.push({ x: s.x + s.rx * (ROAD_HALF + 0.8), y: s.y, z: s.z + s.rz * (ROAD_HALF + 0.8) });
      out.push({ x: s.x - s.rx * (ROAD_HALF + 0.8), y: s.y, z: s.z - s.rz * (ROAD_HALF + 0.8) });
    }
    return out;
  }, [rev]);
  return (
    <group>
      {pillars.map((p, i) => (
        <mesh key={i} position={[p.x, p.y / 2, p.z]}>
          <cylinderGeometry args={[0.28, 0.38, Math.max(0.6, p.y + 0.4), 6]} />
          <meshStandardMaterial color="#9a9388" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function ItemBoxes() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      const box = sim.boxes[i];
      if (!box) {
        child.visible = false;
        return;
      }
      const live = box.respawn <= 0;
      child.visible = live;
      if (!live) return;
      const s = sampleAt(box.t);
      child.position.set(s.x + s.rx * box.offset, s.y + 1.05 + Math.sin(Date.now() * 0.004 + i) * 0.12, s.z + s.rz * box.offset);
      child.rotation.y += dt * 1.6;
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} castShadow>
          <octahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial
            color="#f3efe6"
            emissive="#7ec8ff"
            emissiveIntensity={0.55}
            roughness={0.18}
            metalness={0.35}
            transparent
            opacity={0.92}
          />
        </mesh>
      ))}
    </group>
  );
}

function Projectiles() {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const list = sim.projectiles;
    for (let i = 0; i < g.children.length; i++) {
      const child = g.children[i]!;
      const p = list[i];
      if (!p) {
        child.visible = false;
        continue;
      }
      child.visible = true;
      child.position.set(p.x, p.y, p.z);
    }
  });
  return (
    <group ref={group}>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.28, 10, 8]} />
          <meshStandardMaterial color="#e23d4a" emissive="#e23d4a" emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function Hazards() {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const list = sim.hazards;
    for (let i = 0; i < g.children.length; i++) {
      const child = g.children[i]!;
      const h = list[i];
      if (!h) {
        child.visible = false;
        continue;
      }
      child.visible = true;
      child.position.set(h.x, 0.18, h.z);
    }
  });
  return (
    <group ref={group}>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} rotation={[0.15, 0, 0.2]}>
          <sphereGeometry args={[0.38, 8, 6]} />
          <meshStandardMaterial color="#e6c94a" roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function Sparkles() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(240 * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(240 * 3), 3));
    return g;
  }, []);
  useFrame(() => {
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const col = geo.getAttribute("color") as THREE.BufferAttribute;
    const pts = sim.particles;
    for (let i = 0; i < 240; i++) {
      const p = pts[i];
      if (!p) {
        pos.setXYZ(i, 0, -20, 0);
        col.setXYZ(i, 0, 0, 0);
        continue;
      }
      pos.setXYZ(i, p.x, p.y, p.z);
      const a = Math.max(0, p.life / p.max);
      col.setXYZ(i, p.r * a, p.g * a, p.b * a);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  });
  return (
    <points geometry={geo} ref={ref}>
      <pointsMaterial size={0.18} vertexColors transparent depthWrite={false} />
    </points>
  );
}

function SkidMarks() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const list = sim.skids;
    for (let i = 0; i < 140; i++) {
      const s = list[i];
      if (!s) {
        dummy.scale.setScalar(0);
        dummy.position.set(0, -4, 0);
      } else {
        dummy.position.set(s.x, 0.21, s.z);
        dummy.rotation.set(0, s.yaw, 0);
        dummy.scale.set(0.55, 0.08, 0.9);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 140]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#1a1a1e" transparent opacity={0.45} depthWrite={false} />
    </instancedMesh>
  );
}

function SkyDome() {
  const theme = activeTrack;
  const geo = useMemo(() => new THREE.SphereGeometry(320, 24, 16), []);
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        top: { value: new THREE.Color(theme.sky) },
        mid: { value: new THREE.Color(theme.hemiSky) },
        bot: { value: new THREE.Color(theme.fog) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 mid;
        uniform vec3 bot;
        varying vec3 vPos;
        void main() {
          float h = clamp(vPos.y / 220.0, -0.2, 1.0);
          vec3 col = mix(bot, mid, smoothstep(-0.15, 0.18, h));
          col = mix(col, top, smoothstep(0.18, 0.85, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    return m;
  }, [theme.sky, theme.hemiSky, theme.fog]);
  return <mesh geometry={geo} material={mat} />;
}

function Clouds() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const n = 28;
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 90 + (i % 7) * 14;
      dummy.position.set(Math.cos(a) * r + 40, 18 + (i % 5) * 3.5, Math.sin(a) * r - 20);
      dummy.rotation.set(0, a, 0);
      dummy.scale.set(4 + (i % 4), 1.4 + (i % 3) * 0.3, 2.6 + (i % 3));
      dummy.updateMatrix();
      ref.current?.setMatrixAt(i, dummy.matrix);
    }
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial color="#f7fbff" roughness={1} transparent opacity={0.82} />
    </instancedMesh>
  );
}

function Water() {
  const ref = useRef<THREE.Mesh>(null);
  const theme = activeTrack;
  const tex = useMemo(() => getTextures(), []);
  useFrame(({ clock }) => {
    const m = ref.current?.material as THREE.MeshStandardMaterial | undefined;
    if (m?.map) {
      m.map.offset.x = clock.elapsedTime * 0.012;
      m.map.offset.y = Math.sin(clock.elapsedTime * 0.2) * 0.02;
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[40, -0.72, -20]} receiveShadow>
      <circleGeometry args={[420, 48]} />
      <meshStandardMaterial
        color={theme.water}
        map={tex.water}
        roughness={0.28}
        metalness={0.12}
      />
    </mesh>
  );
}

export function World() {
  const rev = useGame((s) => s.trackRev);
  const theme = activeTrack;
  const tex = useMemo(() => getTextures(), []);
  return (
    <group key={rev}>
      <SkyDome />
      <Water />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[40, -0.55, -20]} receiveShadow>
        <circleGeometry args={[210, 48]} />
        <meshStandardMaterial
          color={theme.grass}
          map={tex.grass}
          roughness={1}
          polygonOffset
          polygonOffsetFactor={4}
          polygonOffsetUnits={4}
        />
      </mesh>
      <mesh position={[140, 28, -90]}>
        <sphereGeometry args={[7, 16, 12]} />
        <meshBasicMaterial color="#fff3c2" />
      </mesh>
      <Clouds />
      <Track />
      <Palms />
      <Rocks />
      <TunnelSafe />
      <Bridge />
      <SkidMarks />
      <ItemBoxes />
      <Projectiles />
      <Hazards />
      <Sparkles />
    </group>
  );
}
