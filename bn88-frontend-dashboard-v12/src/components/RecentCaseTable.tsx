import type { RecentCase } from "@/types/api";

export default function RecentCaseTable({ items = [] as RecentCase[] }) {
  return (
    <div>
      <div className="mb-2 text-sm opacity-80">Recent Cases (10 รายการล่าสุด)</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left opacity-70">
            <tr>
              <th className="py-2">เวลา</th>
              <th className="py-2">ผู้ใช้</th>
              <th className="py-2">ช่องทาง</th>
              <th className="py-2">เรื่อง</th>
              <th className="py-2">ด่วน</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center opacity-60">— ไม่มีรายการ —</td>
              </tr>
            )}
            {items.map((c) => (
              <tr key={c.id} className="border-t border-white/10">
                <td className="py-2">{new Date(c.createdAt).toLocaleString()}</td>
                <td className="py-2">{c.user}</td>
                <td className="py-2"><span className="rounded bg-slate-700 px-2 py-0.5 text-xs">{c.channel}</span></td>
                <td className="py-2">{c.subject}</td>
                <td className="py-2">{c.urgent ? "●" : "○"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


