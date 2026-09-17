import * as THREE from "three";

function canvasTex(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.Texture();
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function noise(ctx: CanvasRenderingContext2D, size: number, amount: number, alpha = 40) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, (d[i] ?? 0) + n));
    d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] ?? 0) + n));
    d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] ?? 0) + n));
    if (alpha < 255) d[i + 3] = Math.min(255, (d[i + 3] ?? 255));
  }
  ctx.putImageData(img, 0, 0);
}

export function asphaltTex() {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#3d424c";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const g = 40 + Math.random() * 50;
      ctx.fillStyle = `rgba(${g},${g + 4},${g + 8},${0.18 + Math.random() * 0.2})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 2);
    }
    noise(ctx, s, 18);
  });
}

export function grassTex(hex = "#3a8f44") {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(20,70,28,0.28)" : "rgba(180,220,90,0.18)";
      const x = Math.random() * s;
      const y = Math.random() * s;
      ctx.fillRect(x, y, 1, 2 + Math.random() * 4);
    }
    noise(ctx, s, 14);
  });
}

export function dirtTex(hex = "#8b6d3c") {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = `rgba(40,28,12,${0.08 + Math.random() * 0.15})`;
      ctx.beginPath();
      ctx.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    noise(ctx, s, 16);
  });
}

export function waterTex(hex = "#1d7fa3") {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(210,240,255,0.18)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      const y = (i / 18) * s;
      ctx.moveTo(0, y);
      for (let x = 0; x <= s; x += 16) {
        ctx.lineTo(x, y + Math.sin(x * 0.08 + i) * 6);
      }
      ctx.stroke();
    }
  });
}

export function checkerTex() {
  return canvasTex(128, (ctx, s) => {
    const n = 8;
    const cell = s / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#f4f1ea" : "#1a1a1a";
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  });
}

let cache: {
  asphalt: THREE.Texture;
  grass: THREE.Texture;
  dirt: THREE.Texture;
  water: THREE.Texture;
  checker: THREE.Texture;
} | null = null;

export function getTextures() {
  if (typeof document === "undefined") {
    return {
      asphalt: new THREE.Texture(),
      grass: new THREE.Texture(),
      dirt: new THREE.Texture(),
      water: new THREE.Texture(),
      checker: new THREE.Texture(),
    };
  }
  if (!cache) {
    cache = {
      asphalt: asphaltTex(),
      grass: grassTex(),
      dirt: dirtTex(),
      water: waterTex(),
      checker: checkerTex(),
    };
    cache.asphalt.repeat.set(1, 18);
    cache.grass.repeat.set(48, 48);
    cache.dirt.repeat.set(8, 22);
    cache.water.repeat.set(24, 24);
  }
  return cache;
}
