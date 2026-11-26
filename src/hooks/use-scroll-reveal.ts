import { useEffect, useRef, useState } from "react";
import { useInView, type UseInViewOptions } from "framer-motion";

// Further off screen than any hidden pose moves an element
const OFFSCREEN: UseInViewOptions = { margin: "100px" };

/**
 * Like `whileInView`, but rewinds only once the element is well off screen. `whileInView` rewinds
 * at the same line it plays at, so an element whose hidden pose moves it back over that line (a
 * card that sits 40px lower, a bar that shrinks to its base) plays again at once, and flickers for
 * as long as it's held there. Returns the ref for the element to watch, and whether it's shown.
 */
export const useScrollReveal = <T extends Element = HTMLDivElement>(viewport: UseInViewOptions) => {
  const ref = useRef<T>(null);
  const inView = useInView(ref, viewport);
  const nearView = useInView(ref, OFFSCREEN);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (inView) setShown(true);
    else if (!nearView) setShown(false);
  }, [inView, nearView]);

  return { ref, shown };
};
