import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
}

/**
 * A slow warp-drift starfield rendered to a full-viewport canvas. Stars stream
 * outward from centre with subtle parallax; a faint nebula wash sits behind.
 * Respects prefers-reduced-motion by holding the field still.
 */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    const COUNT = 320;
    const stars: Star[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function reset(s: Star, init: boolean) {
      s.x = (Math.random() - 0.5) * w;
      s.y = (Math.random() - 0.5) * h;
      s.z = init ? Math.random() * w : w;
      s.px = 0;
      s.py = 0;
    }

    function resize() {
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      cx = w / 2;
      cy = h / 2;
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    for (let i = 0; i < COUNT; i++) {
      const s: Star = { x: 0, y: 0, z: 0, px: 0, py: 0 };
      reset(s, true);
      stars.push(s);
    }

    let raf = 0;
    const speed = 0.55;

    function frame() {
      ctx!.fillStyle = "rgba(3, 6, 14, 0.34)";
      ctx!.fillRect(0, 0, w, h);

      for (const s of stars) {
        if (!reduce) s.z -= speed;
        if (s.z <= 0.1) reset(s, false);
        const k = 128 / s.z;
        const sx = cx + s.x * k;
        const sy = cy + s.y * k;
        if (sx < 0 || sx >= w || sy < 0 || sy >= h) {
          if (!reduce) reset(s, false);
          continue;
        }
        const size = (1 - s.z / w) * 2.2;
        const lum = 1 - s.z / w;
        const hue = 190 + (s.x + s.y) * 0.02;
        if (!reduce && s.px) {
          ctx!.strokeStyle = `hsla(${hue}, 90%, ${55 + lum * 30}%, ${0.25 + lum * 0.5})`;
          ctx!.lineWidth = size;
          ctx!.beginPath();
          ctx!.moveTo(s.px, s.py);
          ctx!.lineTo(sx, sy);
          ctx!.stroke();
        } else {
          ctx!.fillStyle = `hsla(${hue}, 90%, ${60 + lum * 30}%, ${0.3 + lum * 0.6})`;
          ctx!.fillRect(sx, sy, size, size);
        }
        s.px = sx;
        s.py = sy;
      }
      raf = window.requestAnimationFrame(frame);
    }
    frame();

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas id="starfield" ref={ref} aria-hidden />;
}
