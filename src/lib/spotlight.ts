import type { PointerEvent } from "react";

// A card's spotlight and frame highlight follow the mouse (see .gradient-border in index.css).
// Written straight to CSS variables, so moving the mouse never re-renders anything.
export const spotlightHandlers = {
  onPointerMove: (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
  },
  onPointerLeave: (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.style.removeProperty("--mx");
    event.currentTarget.style.removeProperty("--my");
  },
};
