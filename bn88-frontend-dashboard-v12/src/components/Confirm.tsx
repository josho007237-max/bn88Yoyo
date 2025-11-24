// src/components/Confirm.tsx
import React, { createContext, useCallback, useContext, useState } from "react";

type ConfirmOptions = {
  title?: string;
  message?: string;
  okText?: string;
  cancelText?: string;
  requireTextMatch?: string; // เช่น "DELETE"
  jsonPreview?: any;
};
type Ctx = { confirm: (opts: ConfirmOptions) => Promise<boolean> };

const ConfirmCtx = createContext<Ctx | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({});
  const [resolver, setResolver] = useState<(v: boolean) => void>(() => () => {});
  const [typing, setTyping] = useState("");

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setTyping("");
    setVisible(true);
    return new Promise<boolean>((resolve) => setResolver(() => resolve));
  }, []);

  const close = (v: boolean) => {
    setVisible(false);
    resolver(v);
  };

  const must = opts.requireTextMatch;
  const disabled = !!must && typing.trim() !== must;

  const titleId = "bn9-confirm-title";
  const inputId = "bn9-confirm-text";

  return (
    <ConfirmCtx.Provider value={{ confirm }}>
      {children}

      {visible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          aria-hidden={!visible}
        >
          <div
            className="w-[min(520px,92vw)] rounded-2xl bg-neutral-900 text-white p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div id={titleId} className="text-lg font-semibold">
              {opts.title ?? "ยืนยันการทำรายการ"}
            </div>

            {opts.message && (
              <p className="text-neutral-300 mt-1">{opts.message}</p>
            )}

            {opts.jsonPreview !== undefined && (
              <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-neutral-800 p-3 text-xs">
                {JSON.stringify(opts.jsonPreview, null, 2)}
              </pre>
            )}

            {must && (
              <div className="mt-3">
                <label htmlFor={inputId} className="text-xs text-neutral-300">
                  พิมพ์คำว่า <b>{must}</b> เพื่อยืนยัน
                </label>
                <input
                  id={inputId}
                  autoFocus
                  className="mt-1 w-full rounded-xl bg-neutral-800 px-3 py-2 outline-none"
                  value={typing}
                  onChange={(e) => setTyping(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !disabled) close(true);
                    if (e.key === "Escape") close(false);
                  }}
                  aria-invalid={disabled}
                />
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl bg-neutral-700 px-3 py-2 hover:bg-neutral-600"
                onClick={() => close(false)}
              >
                {opts.cancelText ?? "ยกเลิก"}
              </button>
              <button
                type="button"
                className={`rounded-xl px-3 py-2 ${
                  disabled
                    ? "bg-neutral-700 opacity-50 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500"
                }`}
                disabled={disabled}
                onClick={() => close(true)}
              >
                {opts.okText ?? "ตกลง"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const v = useContext(ConfirmCtx);
  if (!v) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return v.confirm;
}

