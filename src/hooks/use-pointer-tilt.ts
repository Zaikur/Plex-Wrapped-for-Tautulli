import type { PointerEvent } from "react";
import { useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

const SPRING = { stiffness: 150, damping: 18, mass: 0.6 };

/**
 * 3D tilt toward the mouse pointer. Returns sprung rotations and the glare position (in %)
 * to bind to `style`, plus the handlers for the element being tilted. Touch and pen input are
 * ignored (a tilt that follows a finger gets in the way of scrolling), as is reduced motion.
 */
export const usePointerTilt = (maxDegrees = 10) => {
  const reduceMotion = useReducedMotion();
  // Pointer position over the element, 0..1 on both axes (0.5 = centre)
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const hovering = useMotionValue(0);
  const sx = useSpring(px, SPRING);
  const sy = useSpring(py, SPRING);

  const rotateY = useTransform(sx, [0, 1], [-maxDegrees, maxDegrees]);
  const rotateX = useTransform(sy, [0, 1], [maxDegrees, -maxDegrees]);
  const glareX = useTransform(sx, [0, 1], ["0%", "100%"]);
  const glareY = useTransform(sy, [0, 1], ["0%", "100%"]);
  const hover = useSpring(hovering, { stiffness: 200, damping: 25 });

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - rect.left) / rect.width);
    py.set((event.clientY - rect.top) / rect.height);
    hovering.set(1);
  };

  const onPointerLeave = () => {
    px.set(0.5);
    py.set(0.5);
    hovering.set(0);
  };

  return { rotateX, rotateY, glareX, glareY, hover, handlers: { onPointerMove, onPointerLeave } };
};
