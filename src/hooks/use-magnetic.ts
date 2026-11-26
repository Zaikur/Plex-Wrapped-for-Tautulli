import type { PointerEvent } from "react";
import { useMotionValue, useReducedMotion, useSpring } from "framer-motion";

/**
 * A "magnetic" element that leans toward the mouse pointer by up to `maxOffset` pixels.
 * Bind `style` to a motion element and spread `handlers` on it. Mouse only.
 */
export const useMagnetic = (maxOffset = 8, strength = 0.3) => {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 220, damping: 15, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 220, damping: 15, mass: 0.4 });

  const clamp = (value: number) => Math.max(-maxOffset, Math.min(maxOffset, value));

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(clamp((event.clientX - (rect.left + rect.width / 2)) * strength));
    y.set(clamp((event.clientY - (rect.top + rect.height / 2)) * strength));
  };

  const onPointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  return { style: { x: springX, y: springY }, handlers: { onPointerMove, onPointerLeave } };
};
