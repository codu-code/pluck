"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Scales a fixed-size stage (the loop is 1200 x 750) to the width of its column.
export function ConnectLoopFit({ children, width = 1200, height = 750 }: { children: ReactNode; width?: number; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e!.contentRect.width / width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={box} style={{ position: "relative", width: "100%", aspectRatio: `${width} / ${height}`, overflow: "hidden", borderRadius: 12 }}>
      <div style={{ position: "absolute", left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: "0 0" }}>{children}</div>
    </div>
  );
}
