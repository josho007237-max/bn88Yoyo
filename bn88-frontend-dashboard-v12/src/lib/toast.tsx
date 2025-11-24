import { useState, useEffect } from "react";

export function useToast() {
  const [msg, setMsg] = useState<string>("");
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2500);
    return () => clearTimeout(t);
  }, [msg]);
  return { msg, show: (m: string) => setMsg(m) };
}

export function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-xl shadow-lg">
      {msg}
    </div>
  );
}
