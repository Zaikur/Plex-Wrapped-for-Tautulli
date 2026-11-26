import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

// Glide speed for titles that don't fit, in px per second
const SPEED = 32;

/**
 * One line of text. When it's too long for its space it glides across to show its end, pauses,
 * and glides back, instead of being cut off with "…". With reduced motion it wraps instead.
 */
export const ScrollingText = ({ text, className }: { text: string; className?: string }) => {
  const box = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const outer = box.current;
    if (!outer) return;
    const measure = () => {
      if (!box.current || !inner.current) return;
      setOverflow(Math.max(0, Math.ceil(inner.current.offsetWidth - box.current.clientWidth)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [text]);

  const scrolling = overflow > 0;
  // Pauses at both ends take 40% of each pass (see .animate-scroll-text)
  const style = scrolling
    ? ({ "--scroll-distance": `-${overflow}px`, "--scroll-duration": `${(overflow / SPEED / 0.6).toFixed(2)}s` } as CSSProperties)
    : undefined;

  return (
    <span
      ref={box}
      className={cn("scroll-text block min-w-0 overflow-hidden whitespace-nowrap", className, scrolling && "scroll-text-overflowing text-left")}
      title={scrolling ? text : undefined}
    >
      <span ref={inner} className={cn("inline-block", scrolling && "animate-scroll-text")} style={style}>
        {text}
      </span>
    </span>
  );
};
