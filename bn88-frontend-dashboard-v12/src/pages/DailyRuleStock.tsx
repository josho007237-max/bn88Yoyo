import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  getRuleStock,
  generateRuleCodes,
  importRuleCodes,
  type RuleStockResponse,
} from "../lib/api";

export default function DailyRuleStock() {
  const { ruleId = "" } = useParams();

  const [stock, setStock] = useState<RuleStockResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const [count, setCount] = useState<number>(5);
  const [prefix, setPrefix] = useState<string>("");
  const [digits, setDigits] = useState<number>(6);

  const [importText, setImportText] = useState<string>("");

  const parsedCodes = useMemo(() => {
    return importText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [importText]);

  const refresh = async () => {
    if (!ruleId) return;
    setLoading(true);
    try {
      const res = await getRuleStock(ruleId);
      setStock(res);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || e?.message || "โหลดสต็อกไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleId]);

  const onGenerate = async () => {
    if (!ruleId) return;
    if (!count || count < 1) return toast.error("จำนวนต้องมากกว่า 0");

    const cleanPrefix = prefix
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "");

    setLoading(true);
    try {
      const res = await generateRuleCodes(ruleId, {
        count,
        prefix: cleanPrefix || undefined,
        digits: digits || undefined,
      });
      toast.success(`Generate สำเร็จ: +${res.generated}`);
      await refresh();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || e?.message || "Generate ไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
    }
  };

  const onImport = async () => {
    if (!ruleId) return;
    if (parsedCodes.length === 0) return toast.error("ยังไม่มีโค้ดให้ import");

    // backend รับ codesText เป็น string
    const codesText = parsedCodes.join("\n");

    setLoading(true);
    try {
      const res = await importRuleCodes(ruleId, codesText);
      toast.success(
        `Import สำเร็จ: input=${res.input}, unique=${res.uniqueInput}, imported=${res.imported}, dup=${res.duplicated}`
      );
      setImportText("");
      await refresh();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || e?.message || "Import ไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm text-neutral-400">
            <Link className="hover:underline" to="/rules">
              Rules
            </Link>{" "}
            / <span className="font-mono">{ruleId}</span>
          </div>
          <h1 className="text-xl font-semibold">DailyRule Stock</h1>
        </div>

        <button
          onClick={refresh}
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-sm disabled:opacity-60"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard title="AVAILABLE" value={stock?.available ?? "-"} />
        <StatCard title="USED" value={stock?.used ?? "-"} />
        <StatCard title="TOTAL" value={stock?.total ?? "-"} />
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
        <div className="font-semibold">Generate</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Count">
            <input
              aria-label="Count"
              type="number"
              min={1}
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </Field>

          <Field label="Prefix (optional)">
            <input
              aria-label="Prefix"
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="เช่น BN"
            />
          </Field>

          <Field label="Digits">
            <input
              aria-label="Digits"
              type="number"
              min={1}
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none"
              value={digits}
              onChange={(e) => setDigits(Number(e.target.value))}
            />
          </Field>
        </div>

        <button
          onClick={onGenerate}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-neutral-200 text-neutral-900 hover:bg-white text-sm disabled:opacity-60"
        >
          Generate
        </button>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
        <div className="font-semibold">Import</div>
        <div className="text-sm text-neutral-400">
          วางโค้ด “1 บรรทัดต่อ 1 โค้ด” (ตอนนี้มี {parsedCodes.length} บรรทัด)
        </div>

        <textarea
          aria-label="Import codes"
          className="w-full min-h-[180px] rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm font-mono outline-none"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder={"CODE001\nCODE002\nCODE003"}
        />

        <button
          onClick={onImport}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-neutral-200 text-neutral-900 hover:bg-white text-sm disabled:opacity-60"
        >
          Import
        </button>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-xs text-neutral-400">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-neutral-400">{label}</div>
      {children}
    </div>
  );
}
