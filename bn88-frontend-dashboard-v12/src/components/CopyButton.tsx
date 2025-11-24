import React, { useState } from "react";

type Props = { text: string; label?: string };
export default function CopyButton({ text, label = "Copy" }: Props) {
  const [ok, setOk] = useState<boolean | null>(null);
  async function onCopy() {
    try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(()=>setOk(null), 1200); }
    catch { setOk(false); setTimeout(()=>setOk(null), 1200); }
  }
  return (
    <button onClick={onCopy} className="px-3 py-1 rounded-xl border shadow-sm text-sm hover:bg-white/5" title="Copy to clipboard">
      {ok === true ? "Copied!" : ok === false ? "Failed" : label}
    </button>
  );
}
