import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Point = { date: string; messages: number; newUsers: number; urgent: number };

export default function DailyChart({ data = [] as Point[] }) {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 6 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(v: any, n: any) => [v, n === "messages" ? "ข้อความ" : n === "newUsers" ? "ลูกค้าใหม่" : "เร่งด่วน"]}
            labelFormatter={(l) => `วันที่: ${l}`}
          />
          <Line type="monotone" dataKey="messages" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="newUsers" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="urgent" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

