import React, { createContext, useCallback, useContext, useState } from "react";

type ToastMsg = { id: number; text: string };
type ToastCtx = { toast: (text: string) => void };

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);
  const toast = useCallback((text: string) => {
    const id = Date.now();
    setItems((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {items.map((t) => (
          <div
            key={t.id}
            className="bg-neutral-800 text-white px-3 py-2 rounded-xl shadow"
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside <ToastProvider>");
  return v.toast;
}
