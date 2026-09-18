import { useEffect, useRef } from "react";

/** Ref for a step's h1. Focuses it on mount so keyboard and screen-reader
 *  users land at the start of each new step. */
export function useStepHeading() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}