import React from "react";

export type BotIntent = {
  id: string;
  code: string;
  title: string;
  keywords: string[];
  fallback?: string | null;
};

type Props = {
  intents: BotIntent[];
};

export const BotIntentsSection: React.FC<Props> = ({ intents }) => {
  return (
    <section className="rounded-2xl border border-gray-700 bg-gray-900/80 p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">Intents</h2>
        <span className="text-xs text-gray-400">
          ตอนนี้เป็นโหมดอ่านอย่างเดียว (จะเพิ่ม CRUD ในเฟสถัดไป)
        </span>
      </div>

      {intents.length === 0 ? (
        <div className="text-sm text-gray-400">
          ยังไม่มี Intents สำหรับบอทตัวนี้
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/40">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/80 text-xs uppercase text-gray-400">
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Keywords</th>
                <th className="px-3 py-2 text-left">Fallback</th>
              </tr>
            </thead>
            <tbody>
              {intents.map((it) => (
                <tr
                  key={it.id}
                  className="border-b border-gray-800/60 last:border-0 hover:bg-gray-900/60"
                >
                  <td className="px-3 py-2 font-mono text-xs text-emerald-300">
                    {it.code}
                  </td>
                  <td className="px-3 py-2 text-gray-100">{it.title}</td>
                  <td className="px-3 py-2 text-gray-200">
                    {it.keywords && it.keywords.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {it.keywords.map((kw, idx) => (
                          <span
                            key={idx}
                            className="rounded-full bg-gray-800 px-2 py-0.5 text-[11px] text-gray-100"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">
                        (no keywords)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-300">
                    {it.fallback ? (
                      <span className="line-clamp-2">{it.fallback}</span>
                    ) : (
                      <span className="text-gray-600">(none)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
