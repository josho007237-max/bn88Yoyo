import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";

export type DailyPoint = {
  date: string;
  msg: number;
  newUsers: number;
  urgent: number;
};

export default function DailyChart({ data }: { data: DailyPoint[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="4 4" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="msg" stroke="#60a5fa" dot={false} />
          <Line type="monotone" dataKey="newUsers" stroke="#34d399" dot={false} />
          <Line type="monotone" dataKey="urgent" stroke="#f87171" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
