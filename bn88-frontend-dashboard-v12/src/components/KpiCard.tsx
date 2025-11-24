type Props = { title: string; subtitle?: string; value: number | string };

export default function KpiCard({ title, subtitle, value }: Props) {
  return (
    <div className="rounded-2xl bg-slate-800/40 p-4">
      <div className="text-sm opacity-80">{title}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      {subtitle && <div className="text-xs opacity-60">{subtitle}</div>}
    </div>
  );
}

