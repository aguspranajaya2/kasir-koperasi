import { useState, type FormEvent, type ReactNode } from "react";
import { ClipboardList, FileClock, WalletCards } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { formatRupiah } from "../../lib/utils";
import { useCreateCashMovementMutation, useGetAuditLogsQuery, useGetCashMovementsQuery } from "../../services/api";
import { useLanguage } from "../../lib/i18n";

export function OperationsPage() {
  const { t, language } = useLanguage();
  const { data: cashData, isLoading: cashLoading, isError: cashError } = useGetCashMovementsQuery();
  const { data: auditData, isLoading: auditLoading, isError: auditError } = useGetAuditLogsQuery();
  const [createMovement, movementState] = useCreateCashMovementMutation();
  const [type, setType] = useState<"opening" | "cash_in" | "cash_out" | "closing">("opening");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createMovement({ type, amount: Number(amount), ...(note.trim() ? { note: note.trim() } : {}) }).unwrap();
      setAmount(""); setNote(""); setMessage("Mutasi kas berhasil dicatat.");
    } catch { setMessage("Mutasi kas gagal disimpan."); }
  };

  return <main className="mx-auto min-h-dvh max-w-[1400px] space-y-5 px-4 py-6 pb-24 md:px-8">
    <header><p className="text-sm font-semibold text-primary">{t("OPERASIONAL")}</p><h1 className="text-2xl font-bold md:text-3xl">{t("Kasir & audit")}</h1><p className="mt-1 text-sm text-slate-500">{t("Pencatatan kas dan jejak perubahan sensitif.")}</p></header>
    {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{t(message)}</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <section className="space-y-4"><Card className="p-4 md:p-5"><div className="mb-3 flex items-center gap-2"><WalletCards className="h-4 w-4 text-primary" /><div><h2 className="font-semibold">{t("Catat mutasi kas")}</h2><p className="text-xs text-slate-500">{t("Setiap catatan menyimpan pengguna dan waktu.")}</p></div></div><form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(event) => void submit(event)}><Field label={t("Jenis")}><select className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="opening">{t("Saldo awal")}</option><option value="cash_in">{t("Kas masuk")}</option><option value="cash_out">{t("Kas keluar")}</option><option value="closing">{t("Saldo akhir")}</option></select></Field><Field label={t("Nominal (rupiah)")}><Input required type="number" min="0" step="1" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field><Button className="sm:mb-0.5" type="submit" disabled={movementState.isLoading}>{t("Catat kas")}</Button><div className="sm:col-span-3"><Field label={t("Catatan")}><Input maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("Setoran modal / pembelian perlengkapan")} /></Field></div></form></Card>
        <Card className="overflow-hidden"><div className="flex items-center gap-2 border-b border-border p-4"><FileClock className="h-4 w-4 text-primary" /><div><h2 className="font-semibold">{t("Riwayat mutasi kas")}</h2><p className="text-xs text-slate-500">{t("50 catatan terakhir")}</p></div></div>{cashError ? <p className="p-4 text-sm text-red-700">{t("Riwayat kas gagal dimuat.")}</p> : cashLoading ? <div className="h-36 animate-pulse bg-slate-100" /> : !cashData?.items.length ? <p className="p-4 text-sm text-slate-500">{t("Belum ada mutasi kas.")}</p> : <div className="divide-y divide-border">{cashData.items.map((item) => <div key={item._id} className="flex items-start justify-between gap-3 p-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{t(cashLabel(item.type))}</p><Badge className="bg-slate-100 text-slate-600">{typeof item.cashierId === "string" ? "Kasir" : item.cashierId.name}</Badge></div><p className="mt-1 truncate text-xs text-slate-500">{new Date(item.createdAt).toLocaleString(language === "id" ? "id-ID" : "en-US")}{item.note ? ` · ${item.note}` : ""}</p></div><p className="shrink-0 text-sm font-semibold">{formatRupiah(item.amount)}</p></div>)}</div>}</Card>
      </section>
      <section><Card className="overflow-hidden"><div className="flex items-center gap-2 border-b border-border p-4"><ClipboardList className="h-4 w-4 text-primary" /><div><h2 className="font-semibold">{t("Audit log")}</h2><p className="text-xs text-slate-500">{t("Aktivitas sensitif terbaru, maksimal 50 catatan")}</p></div></div>{auditError ? <p className="p-4 text-sm text-red-700">{t("Audit log gagal dimuat.")}</p> : auditLoading ? <div className="h-36 animate-pulse bg-slate-100" /> : !auditData?.items.length ? <p className="p-4 text-sm text-slate-500">{t("Belum ada aktivitas.")}</p> : <ol className="max-h-[720px] divide-y divide-border overflow-y-auto">{auditData.items.map((entry) => <li key={entry._id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{actionLabel(entry.action)}</p><p className="mt-1 text-xs text-slate-500">{typeof entry.actorId === "string" ? t("Pengguna") : entry.actorId.name} · {new Date(entry.createdAt).toLocaleString(language === "id" ? "id-ID" : "en-US")}</p><p className="mt-1 text-xs text-slate-500">{entry.entity} · {entry.entityId}</p></div><Badge className="shrink-0 bg-amber-50 text-amber-800">audit</Badge></div>{Object.keys(entry.metadata ?? {}).length > 0 && <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">{t("Detail perubahan")}</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2">{JSON.stringify(entry.metadata, null, 2)}</pre></details>}</li>)}</ol>}</Card></section>
    </div>
  </main>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5 text-xs font-medium text-slate-600"><span>{label}</span>{children}</label>; }
function cashLabel(type: string) { return ({ opening: "Saldo awal", cash_in: "Kas masuk", cash_out: "Kas keluar", closing: "Saldo akhir" } as Record<string, string>)[type] ?? type; }
function actionLabel(action: string) { return action.replace(/[._]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
