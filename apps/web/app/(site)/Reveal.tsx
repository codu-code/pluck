"use client";

import { useEffect } from "react";

// Marks each [data-reveal] block below the fold as "wait", then "in" once it scrolls into view, so its CSS can
// play once. Without JavaScript, or with reduced motion, nothing is marked and everything shows as drawn.
export function Reveal() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.setAttribute("data-reveal", "in"); io.unobserve(e.target); }
    }, { threshold: 0.3 });
    for (const el of document.querySelectorAll("[data-reveal]")) {
      if (el.getBoundingClientRect().top < innerHeight) continue; // already on screen: leave it be
      el.setAttribute("data-reveal", "wait");
      io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return null;
}
