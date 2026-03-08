import { useEffect } from "react";

/**
 * Sets --keyboard-inset-bottom CSS variable to the virtual keyboard height.
 *
 * On iOS Safari, dvh/interactive-widget don't respond to the keyboard,
 * so page-scroll layouts need explicit bottom padding to keep the cursor
 * visible above the keyboard. Android Chrome handles this natively via
 * interactive-widget=resizes-content in the viewport meta tag.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function sync() {
      const vv = window.visualViewport;
      if (!vv) return;
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty(
        "--keyboard-inset-bottom",
        `${kb}px`,
      );
    }

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);

    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      document.documentElement.style.removeProperty("--keyboard-inset-bottom");
    };
  }, []);
}
