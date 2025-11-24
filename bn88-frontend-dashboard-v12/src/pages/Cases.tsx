// src/pages/Cases.tsx
import { useEffect, useState } from "react";
import axios from "axios";

export default function Cases({ tenant, botId }: { tenant: string; botId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ kind: "", userId: "", search: "" });

  const load = async () => {
    const res = await axios.get(`/api/cases`, {
      params: { botId, page, size: 20, ...filters },
      headers: { "x-tenant": tenant },
    });
    setItems(res.data.items);
    setTotal(res.data.total);
  };

  useEffect(() => { load(); }, [page, filters]);

  const pages = Math.ceil(total / 20);

  return (
    <div className="p-4">
      <h2 className="font-semibold mb-3">Cases</h2>
      <div className="flex gap-2 mb-3">
        <input
          className="border p-2"
          placeholder="kind"
          value={filters.kind}
          onChange={(e) => setFilters(f => ({ ...f, kind: e.target.value }))}
        />
        <input
          className="border p-2"
          placeholder="userId"
          value={filters.userId}
          onChange={(e) => setFilters(f => ({ ...f, userId: e.target.value }))}
        />
        <input
          className="border p-2 flex-1"
          placeholder="search text"
          value={filters.search}
          onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
        />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th>Time</th><th>User</th><th>Kind</th><th>Text</th><th>Channel</th>
          </tr>
        </thead>
        <tbody>
          {items.map(i => (
            <tr key={i.id} className="border-b">
              <td>{new Date(i.createdAt).toLocaleString()}</td>
              <td>{i.userId}</td>
              <td>{i.kind}</td>
              <td>{i.text}</td>
              <td>{i.channel || "line"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => setPage(p => Math.max(p - 1, 1))} className="border px-2 py-1">Prev</button>
        <span>Page {page} / {pages || 1}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={page >= pages} className="border px-2 py-1">Next</button>
      </div>
    </div>
  );
}