import { AccordionId } from "@/constants/accordionKeys";
import { useCallback, useEffect, useRef, useState } from "react";

export const useAccordion = (accordionKey: AccordionId, initialExpanded = false) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  const toggle = useCallback((expand?: boolean) => {
    setIsExpanded((prev) => {
      const nextState = expand === undefined ? !prev : expand;
      return nextState;
    });
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      // Set height to 0 if not expanded, otherwise to scrollHeight
      setContentHeight(isExpanded ? contentRef.current.scrollHeight : 0);
    } else {
      setContentHeight(0); // Ensure height is 0 if ref is not available
    }
  }, [isExpanded, contentRef.current?.scrollHeight]); // Re-calculate on scrollHeight change too

  return {
    isExpanded,
    toggle,
    contentRef,
    contentHeight,
    setIsExpanded, // Exporting this directly for cases where we need to control expansion from outside
  };
};
