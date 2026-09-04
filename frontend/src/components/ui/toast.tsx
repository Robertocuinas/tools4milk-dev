"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
};

type ToastContextType = {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastContextType>({
  success: () => {},
  error: () => {},
  info: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

// ── Toast item styles ─────────────────────────────────────────────────────────

const TOAST_STYLES: Record<ToastType, { wrapper: string; icon: React.ReactNode }> = {
  success: {
    wrapper: "border-state-ok/30 bg-white shadow-card",
    icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-state-ok" />,
  },
  error: {
    wrapper: "border-state-critica/30 bg-white shadow-card",
    icon: <AlertTriangle className="h-4 w-4 shrink-0 text-state-critica" />,
  },
  info: {
    wrapper: "border-state-info/30 bg-white shadow-card",
    icon: <Info className="h-4 w-4 shrink-0 text-state-info" />,
  },
};

const TOAST_TEXT: Record<ToastType, string> = {
  success: "text-state-ok",
  error: "text-state-critica",
  info: "text-state-info",
};

const TOAST_DURATION = 4_000;

// ── Toast item component ──────────────────────────────────────────────────────

function ToastItemComponent({
  toast,
  onClose,
}: {
  toast: ToastItem;
  onClose: () => void;
}) {
  const style = TOAST_STYLES[toast.type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(onClose, TOAST_DURATION);
    return () => clearTimeout(timerRef.current);
  }, [onClose]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex min-w-[280px] max-w-sm items-start gap-3 rounded-[14px] border px-4 py-3 transition-all ${style.wrapper}`}
    >
      <div className="mt-0.5">{style.icon}</div>
      <div className="min-w-0 flex-1">
        {toast.title && (
          <p className={`text-sm font-bold ${TOAST_TEXT[toast.type]}`}>{toast.title}</p>
        )}
        <p className="text-sm font-semibold text-app-text">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-0.5 shrink-0 text-app-dim hover:text-app-text"
        aria-label="Cerrar notificación"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Toast provider ────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((type: ToastType, message: string, title?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-4), { id, type, title, message }]);
  }, []);

  const ctx: ToastContextType = {
    success: useCallback((msg, title) => add("success", msg, title), [add]),
    error: useCallback((msg, title) => add("error", msg, title), [add]),
    info: useCallback((msg, title) => add("info", msg, title), [add]),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast container — fixed, bottom-right, above everything */}
      {toasts.length > 0 && (
        <div
          aria-label="Notificaciones"
          className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2"
        >
          {toasts.map((toast) => (
            <ToastItemComponent
              key={toast.id}
              toast={toast}
              onClose={() => remove(toast.id)}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
