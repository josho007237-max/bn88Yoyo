// src/pages/Rules.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function Rules() {
  const [ruleId, setRuleId] = useState("");
  const nav = useNavigate();

  const go = () => {
    const id = ruleId.trim();
    if (!id) return toast.error("ใส่ Rule ID ก่อน");
    nav(`/rules/${encodeURIComponent(id)}`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Rules</h1>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
        <div className="text-sm text-neutral-300">
          ใส่ <span className="font-mono">ruleId</span> เพื่อเปิดหน้าจัดการสต็อก
          CodePool
        </div>

        <input
          className="w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-700"
          placeholder="เช่น rule_..."
          value={ruleId}
          onChange={(e) => setRuleId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
        />

        <button
          onClick={go}
          className="px-4 py-2 rounded-lg bg-neutral-200 text-neutral-900 hover:bg-white text-sm"
        >
          เปิด Rule
        </button>
      </div>
    </div>
  );
}
