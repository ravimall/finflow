import { createElement, forwardRef, useEffect, useMemo, useState } from "react";

const noopAnimatePresence = ({ children }) => children;

function createFallbackMotion() {
  const cache = new Map();
  const target = {};
  const proxy = new Proxy(target, {
    get: (_, key) => {
      if (typeof key === "symbol") return undefined;
      if (key === "__esModule") return false;
      if (key === "default") return proxy;
      if (cache.has(key)) {
        return cache.get(key);
      }
      const tag = typeof key === "string" && /^[a-z]/.test(key) ? key : "div";
      const Fallback = forwardRef(({ children, ...props }, ref) => {
        return createElement(tag, { ref, ...props }, children);
      });
      cache.set(key, Fallback);
      return Fallback;
    },
  });
  return proxy;
}

const fallbackMotion = createFallbackMotion();

export function useFramerMotion() {
  const [modules, setModules] = useState(null);

  useEffect(() => {
    let active = true;
    import("framer-motion")
      .then((mod) => {
        if (!active) return;
        if (!mod?.AnimatePresence || !mod?.motion) {
          setModules(null);
          return;
        }
        setModules({ AnimatePresence: mod.AnimatePresence, motion: mod.motion });
      })
      .catch(() => {
        if (!active) return;
        setModules(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const fallback = useMemo(
    () => ({ AnimatePresence: noopAnimatePresence, motion: fallbackMotion }),
    []
  );

  return modules ?? fallback;
}
