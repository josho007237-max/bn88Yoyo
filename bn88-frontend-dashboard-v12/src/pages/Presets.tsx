// src/pages/Presets.tsx
import { useEffect, useState } from "react";
import axios from "axios";

export default function Presets({ tenant }: { tenant: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  const load = async () => {
    const res = await axios.get(`/api/admin/ai/presets`, {
      headers: { "x-tenant": tenant },
    });
    setItems(res.data.items || []);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    await axios.post(`/api/admin/ai/presets`, { name, systemPrompt }, {
      headers: { "x-tenant": tenant },
    });
    setName(""); setSystemPrompt("");
    load();
  };

  return (
    <div className="p-4">
      <h2 className="font-semibold mb-3">AI Presets</h2>
      <div className="flex gap-2 mb-3">
        <input className="border p-2 flex-1" placeholder="Preset name" value={name}
          onChange={(e) => setName(e.target.value)} />
        <input className="border p-2 flex-1" placeholder="System prompt" value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)} />
        <button onClick={create} className="bg-blue-500 text-white px-3 py-2">Add</button>
      </div>
      <ul>
        {items.map((p) => (
          <li key={p.id} className="border-b py-2">
            <strong>{p.name}</strong> — {p.systemPrompt}
          </li>
        ))}
      </ul>
    </div>
  );
}