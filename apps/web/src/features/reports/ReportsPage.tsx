import { useState } from "react";
import { FileSpreadsheet, FileText, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { formatRupiah } from "../../lib/utils";
import { useGetSalesReportQuery } from "../../services/api";
import { exportSalesExcel, exportSalesPdf } from "./export";
import { useLanguage } from "../../lib/i18n";

const localDate = (): string => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export function ReportsPage() {
  const { t, language } = useLanguage();
  const today = localDate();
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const validRange = from <= to;
  const { data, isLoading, isError } = useGetSalesReportQuery({ from, to }, { skip: !validRange });
  return <main className="mx-auto min-h-dvh max-w-[1400px] space-y-5 px-4 py-6 md:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-primary">{t("ANALITIK")}</p><h1 className="text-2xl font-bold md:text-3xl">{t("Laporan penjualan")}</h1></div>
      <div className="flex flex-wrap items-center gap-2"><Input className="w-36" type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label={t("Dari tanggal")} /><span className="text-slate-500">{t("s.d.")}</span><Input className="w-36" type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label={t("Sampai tanggal")} /></div>
    </header>
    {!validRange && <p role="alert" className="text-sm text-red-600">{t("Tanggal awal harus sama dengan atau lebih awal daripada tanggal akhir.")}</p>}
    {isError && <Card className="p-5 text-sm text-red-700">{t("Laporan tidak dapat dimuat.")}</Card>}
    {isLoading && <Card className="h-72 animate-pulse bg-slate-100" />}
    {data && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title={t("Penjualan bersih")} value={formatRupiah(data.summary.revenue)} />
        <Metric title={t("Laba kotor")} value={formatRupiah(data.summary.grossProfit)} highlight />
        <Metric title={t("Transaksi")} value={data.summary.orders.toLocaleString(language === "id" ? "id-ID" : "en-US")} />
        <Metric title={t("HPP barang terjual")} value={formatRupiah(data.summary.itemCost)} />
      </div>
      <Card className="p-4 md:p-6"><div className="mb-4"><h2 className="font-semibold">{t("Tren penjualan harian")}</h2><p className="text-sm text-slate-500">{t("Nilai penjualan bersih tanpa pajak.")}</p></div>
        <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.daily} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="_id" tick={{ fontSize: 11 }} tickMargin={8} minTickGap={24} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => new Intl.NumberFormat(language === "id" ? "id-ID" : "en-US", { notation: "compact" }).format(value)} width={48} />
          <Tooltip formatter={(value) => formatRupiah(Number(value))} labelFormatter={(value) => `${t("Tanggal")} ${value}`} />
          <Line type="monotone" dataKey="revenue" name={t("Penjualan")} stroke="#059669" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
        </LineChart></ResponsiveContainer></div>
      </Card>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => exportSalesExcel(data)}><FileSpreadsheet className="h-4 w-4" />{t("Ekspor Excel")}</Button><Button variant="outline" onClick={() => exportSalesPdf(data)}><FileText className="h-4 w-4" />{t("Ekspor PDF")}</Button></div>
      <Card className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 font-medium">{t("Tanggal")}</th><th className="p-3 font-medium">{t("Transaksi")}</th><th className="p-3 text-right font-medium">{t("Penjualan bersih")}</th></tr></thead><tbody>{data.daily.map((row) => <tr key={row._id} className="border-t border-border"><td className="p-3">{row._id}</td><td className="p-3">{row.orders}</td><td className="p-3 text-right">{formatRupiah(row.revenue)}</td></tr>)}</tbody></table></Card>
    </>}
  </main>;
}

function Metric({ title, value, highlight = false }: { title: string; value: string; highlight?: boolean }) {
  return <Card className="p-4"><div className="flex items-center justify-between text-sm text-slate-500"><span>{title}</span>{highlight && <TrendingUp className="h-4 w-4 text-emerald-600" />}</div><p className="mt-2 text-xl font-bold">{value}</p></Card>;
}
