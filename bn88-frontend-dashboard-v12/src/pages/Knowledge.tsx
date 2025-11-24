// src/pages/Knowledge.tsx
import { useEffect, useState } from "react";
import axios from "axios";

export default function Knowledge({ tenant }: { tenant: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const load = async () => {
    const res = await axios.get(`/api/admin/ai/knowledge`, {
      headers: { "x-tenant": tenant },
    });
    setDocs(res.data.items || []);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    await axios.post(`/api/admin/ai/knowledge`, { title, body }, {
      headers: { "x-tenant": tenant },
    });
    setTitle(""); setBody("");
    load();
  };

  return (
    <div className="p-4">
      <h2 className="font-semibold mb-3">Knowledge Base</h2>
      <div className="flex flex-col gap-2 mb-3">
        <input className="border p-2" placeholder="Title" value={title}
          onChange={(e) => setTitle(e.target.value)} />
        <textarea className="border p-2" placeholder="Body" value={body}
          onChange={(e) => setBody(e.target.value)} />
        <button onClick={create} className="bg-green-500 text-white px-3 py-2">Add</button>
      </div>
      <ul>
        {docs.map((d) => (
          <li key={d.id} className="border-b py-2">
            <strong>{d.title}</strong> — {d.body.slice(0, 50)}...
          </li>
        ))}
      </ul>
    </div>
  );
}