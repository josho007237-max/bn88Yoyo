import React from "react";

type Bot = {
  id: string;
  tenant: string;
  name: string;
  platform: string;
  active: boolean;
  verifiedAt?: string | null;
  createdAt?: string;
};

type Props = {
  bot: Bot;
  saving: boolean;
};

export const BotInfoSection: React.FC<Props> = ({ bot, saving }) => {
  const verifiedText = bot.verifiedAt
    ? new Date(bot.verifiedAt).toLocaleString()
    : "ยังไม่ Verify";

  return (
    <section className="rounded-2xl border border-gray-700 bg-gray-900/80 p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">Bot Info</h2>
        <span className="text-xs text-gray-400">
          {saving ? "กำลังบันทึก..." : "พร้อมใช้งาน"}
        </span>
      </div>

      <div className="grid gap-3 text-sm md:grid-cols-2">
        <div className="space-y-1">
          <div className="text-gray-400">Bot ID</div>
          <div className="font-mono text-gray-100 break-all">{bot.id}</div>
        </div>
        <div className="space-y-1">
          <div className="text-gray-400">Tenant</div>
          <div className="font-mono text-gray-100 break-all">
            {bot.tenant}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-gray-400">Name</div>
          <div className="text-gray-100">{bot.name}</div>
        </div>
        <div className="space-y-1">
          <div className="text-gray-400">Platform</div>
          <div className="uppercase text-gray-100">{bot.platform}</div>
        </div>
        <div className="space-y-1">
          <div className="text-gray-400">Verified</div>
          <div className="text-gray-100">{verifiedText}</div>
        </div>
        {bot.createdAt && (
          <div className="space-y-1">
            <div className="text-gray-400">Created At</div>
            <div className="text-gray-100">
              {new Date(bot.createdAt).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
