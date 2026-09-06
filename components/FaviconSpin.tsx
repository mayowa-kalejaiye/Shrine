"use client";
import { useEffect } from "react";

// Animated favicon: tiny twirling world — dark globe, red shrine dots orbiting.
// Drawn live on canvas, swapped into <link rel="icon"> ~8fps. Pauses when tab hidden.
export default function FaviconSpin() {
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    let angle = 0;
    let raf = 0;
    let last = 0;

    const dots = [
      { lat: 0.5, lon: 0.4 },
      { lat: -0.3, lon: 2.4 },
      { lat: 0.9, lon: 4.4 },
    ];

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 120) return; // ~8fps, cheap
      last = t;
      if (document.hidden) return;
      angle += 0.12;
      ctx.clearRect(0, 0, size, size);
      // globe
      ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.fillStyle = "#0a0a0b"; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = "#ffffff"; ctx.stroke();
      ctx.save();
      ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2); ctx.clip();
      // graticule drift = spin
      ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const x = ((i * 22 + angle * 28) % 66) - 5;
        ctx.beginPath(); ctx.ellipse(x, 32, 7, 28, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(4, 32); ctx.lineTo(60, 32); ctx.stroke();
      // orbiting shrine dots (front hemisphere only)
      dots.forEach(d => {
        const lon = d.lon + angle;
        const x = 32 + 24 * Math.sin(lon) * Math.cos(d.lat);
        const y = 32 - 24 * Math.sin(d.lat);
        const front = Math.cos(lon) > -0.15;
        if (!front) return;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ff3b30"; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = "#ffffff"; ctx.stroke();
      });
      ctx.restore();
      link!.href = canvas.toDataURL("image/png");
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return null;
}
