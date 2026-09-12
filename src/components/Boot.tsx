import { useEffect, useRef, useState } from "react";
import { BOOT_LINES } from "../lib/const";
import { armAudio, playBootScore, sfx, stopDrone } from "../lib/audio";

type Particle = { x: number; y: number; tx: number; ty: number; vx: number; vy: number; a: number };

export function Boot({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [showHero, setShowHero] = useState(false);
  const [showWord, setShowWord] = useState(false);
  const [out, setOut] = useState(false);
  const done = useRef(false);

  const ignited = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    stopDrone();
    setOut(true);
    setTimeout(onDone, 620);
  };

  useEffect(() => {
    const ignite = () => {
      armAudio();
      if (ignited.current) return false;
      ignited.current = true;
      playBootScore();
      return true;
    };
    const onKey = (e: KeyboardEvent) => {
      ignite();
      if (e.key === "Enter" || e.key === "Escape" || e.key === " ") finish();
    };
    const onClick = () => {
      if (ignite()) return;
      finish();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let particles: Particle[] = [];
    let t0 = performance.now();
    const img = new Image();
    img.src = "/hero/opening.jpg";

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    img.onload = () => {
      const oc = document.createElement("canvas");
      const maxH = Math.min(window.innerHeight * 0.78, 760);
      const scale = maxH / img.height;
      oc.width = Math.floor(img.width * scale);
      oc.height = Math.floor(img.height * scale);
      const octx = oc.getContext("2d");
      if (!octx) return;
      octx.drawImage(img, 0, 0, oc.width, oc.height);
      const data = octx.getImageData(0, 0, oc.width, oc.height).data;
      const ox = (canvas.width - oc.width) / 2;
      const oy = (canvas.height - oc.height) / 2 - 20;
      const step = 5;
      for (let y = 0; y < oc.height; y += step) {
        for (let x = 0; x < oc.width; x += step) {
          const i = (y * oc.width + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 40 || g < 28) continue;
          if (g < r + 8 && g < b + 8) continue;
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height * 1.2,
            tx: ox + x,
            ty: oy + y,
            vx: 0,
            vy: 0,
            a: g / 255,
          });
        }
      }
      sfx.tick();
    };

    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const assemble = Math.min(1, Math.max(0, (t - 0.2) / 2.4));
      ctx.fillStyle = "#c6ff1a";
      for (const p of particles) {
        p.x += (p.tx - p.x) * (0.045 + assemble * 0.12);
        p.y += (p.ty - p.y) * (0.045 + assemble * 0.12);
        ctx.globalAlpha = p.a * (0.35 + assemble * 0.65);
        ctx.fillRect(p.x, p.y, 3, 3);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const timers = [
      setTimeout(() => setShowHero(true), 2200),
      setTimeout(() => setShowWord(true), 2800),
      setTimeout(() => finish(), 8200),
    ];
    let i = 0;
    const logTimer = setInterval(() => {
      if (i >= BOOT_LINES.length) {
        clearInterval(logTimer);
        return;
      }
      setLines((prev) => [...prev, BOOT_LINES[i]]);
      sfx.tick();
      i += 1;
    }, 380);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      timers.forEach(clearTimeout);
      clearInterval(logTimer);
    };
  }, []);

  return (
    <div className={`boot${out ? " out" : ""}`}>
      <div className="boot-frame" />
      <canvas ref={canvasRef} className="boot-canvas" />
      <img src="/hero/opening.jpg" alt="HERO" className={`boot-hero${showHero ? " show" : ""}`} />
      <div className={`boot-word${showWord ? " show" : ""}`}>PART</div>
      <div className="boot-log">
        {lines.map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
      <div className="boot-skip">CLICK / ENTER — AUDIO + JACK IN</div>
    </div>
  );
}
