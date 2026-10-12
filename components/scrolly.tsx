"use client";

import { useEffect, useRef } from "react";

/**
 * A section that publishes how far it has been scrolled through, 0 to 1, as the CSS variable --p.
 * CSS does all the choreography from that one number; this only measures.
 */
export function Scrolly({ children, ...props }: React.ComponentProps<"section">) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const { top, height } = el.getBoundingClientRect();
      const range = height - window.innerHeight;
      const p = range > 0 ? Math.min(1, Math.max(0, -top / range)) : 0;
      el.style.setProperty("--p", p.toFixed(4));
    };
    const schedule = () => { frame ||= requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <section ref={ref} {...props}>{children}</section>;
}
