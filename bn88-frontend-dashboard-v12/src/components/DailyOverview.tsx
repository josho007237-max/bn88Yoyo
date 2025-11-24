// src/components/DailyOverview.tsx
import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// ข้อมูลที่คอมโพเนนต์ลูก “รับเข้ามา” (ยืดหยุ่น: รองรับทั้ง messages และ msg)
type DailyAny = {
  date: string;
  messages?: number; // รูปแบบใหม่จาก API
  msg?: number;      // รูปแบบเดิมใน UI
  newUsers?: number;
  urgent?: number;
};

type Props = {
  data: DailyAny[]; // พ่อบ้านส่งมาเป็น daily.data เลยก็ได้
  height?: number;
};

const DailyOverview: React.FC<Props> = ({ data = [], height = 280 }) => {
  // ✅ แปลงให้ UI ใช้ field เดิมได้ (msg)
  const uiData = data.map((p) => ({
    date: p.date,
    msg: typeof p.msg === "number" ? p.msg : (p.messages ?? 0),
    newUsers: p.newUsers ?? 0,
    urgent: p.urgent ?? 0,
  }));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={uiData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          {/* ใช้ dataKey เดิม 'msg' ได้ต่อเนื่อง */}
          <Line type="monotone" dataKey="msg" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DailyOverview;
