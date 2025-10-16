import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

function createToastId(counterRef) {
  counterRef.current += 1;
  return `toast-${Date.now()}-${counterRef.current}`;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (type, message, options = {}) => {
      if (!type || !message) {
        return null;
      }

      const duration = Number.isFinite(options.duration) ? options.duration : 5000;
      const id = createToastId(counterRef);

      setToasts((prev) => [...prev, { id, type, message }]);

      if (duration > 0) {
        const timeout = setTimeout(() => removeToast(id), duration);
        timersRef.current.set(id, timeout);
      }

      return id;
    },
    [removeToast]
  );

  const contextValue = useMemo(() => ({ showToast, removeToast }), [showToast, removeToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-3 px-4 sm:items-end sm:px-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg transition focus-within:ring-2 focus-within:ring-offset-2 sm:text-base ${
              toast.type === "error"
                ? "bg-red-600 text-white"
                : toast.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-slate-900 text-white"
            }`}
          >
            <span className="flex-1 break-words">{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="rounded-full bg-black/10 p-1 text-white transition hover:bg-black/20 focus:outline-none"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
