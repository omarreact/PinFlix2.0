"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type RGB = [number, number, number];
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const rgb = (c: RGB) => `rgb(${c.map(clamp).join(" ")} )`;
const blend = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => clamp(v * (1 - t) + b[i] * t)) as RGB;
const luminance = (c: RGB) => c.reduce((sum, v, i) => sum + [0.2126, 0.7152, 0.0722][i] * (v / 255), 0);
const neutral: RGB = [18, 20, 23];

function sample(image: HTMLImageElement): RGB | null {
  if (!image.complete || !image.naturalWidth) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, 32, 32);
    const data = ctx.getImageData(0, 0, 32, 32).data;
    let best: RGB | null = null, score = -1;
    for (let i = 0; i < data.length; i += 16) {
      if (data[i + 3] < 200) continue;
      const c: RGB = [data[i], data[i + 1], data[i + 2]];
      const max = Math.max(...c), min = Math.min(...c);
      const saturation = max ? (max - min) / max : 0;
      const light = luminance(c);
      const value = saturation * 1.8 + (1 - Math.abs(light - 125) / 125) * 0.35;
      if (light > 32 && light < 225 && value > score) { best = c; score = value; }
    }
    return best;
  } catch { return null; } // Cross-origin media may block pixel access.
}

function apply(color: RGB) {
  const root = document.documentElement;
  const base = blend(color, neutral, 0.89);
  const surface = blend(color, neutral, 0.78);
  const accent = blend(color, [255, 255, 255], luminance(color) < 110 ? 0.48 : 0.18);
  root.style.setProperty("--background", rgb(base));
  root.style.setProperty("--surface", rgb(surface));
  root.style.setProperty("--surface-elevated", rgb(blend(color, neutral, 0.69)));
  root.style.setProperty("--accent", rgb(accent));
  root.style.setProperty("--accent-soft", rgb(blend(accent, [255, 255, 255], 0.22)));
  root.style.setProperty("--line", rgb(blend(color, [115, 120, 125], 0.55)));
}

export default function AdaptiveMediaTheme() {
  const pathname = usePathname();
  useEffect(() => {
    let disposed = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (disposed) return;
      const images = [...document.querySelectorAll<HTMLImageElement>("img")].filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.width > 100 && rect.height > 90 && rect.top < innerHeight && rect.bottom > 0;
      });
      const preferred = images.sort((a, b) => {
        const rank = (img: HTMLImageElement) => {
          const r = img.getBoundingClientRect();
          return r.width * r.height + (img.closest("header") ? 100000 : 0);
        };
        return rank(b) - rank(a);
      });
      for (const img of preferred.slice(0, 8)) {
        const c = sample(img);
        if (c) { apply(c); return; }
      }
      apply(neutral);
    };
    const schedule = () => { clearTimeout(timeout); timeout = setTimeout(refresh, 180); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "srcset"] });
    document.addEventListener("load", schedule, true);
    schedule();
    return () => { disposed = true; clearTimeout(timeout); observer.disconnect(); document.removeEventListener("load", schedule, true); };
  }, [pathname]);
  return null;
}
