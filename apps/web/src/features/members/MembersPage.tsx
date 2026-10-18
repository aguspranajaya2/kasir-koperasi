import { useDeferredValue, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Archive, Coins, History, IdCard, Pencil, Plus, Printer, Search, UserRound, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { formatRupiah } from "../../lib/utils";
import {
  useArchiveMemberMutation, useCreateMemberMutation, useDepositSavingsMutation, useGetMemberLedgerQuery,
  useGetMembersQuery, useGetNextMemberNumberQuery, useUpdateMemberMutation, type CooperativeMember
} from "../../services/api";
import { MemberIdCard } from "./MemberIdCard";
import { useLanguage } from "../../lib/i18n";

type MemberDraft = { memberNo: string; name: string; phone: string; email: string };
const blankDraft: MemberDraft = { memberNo: "", name: "", phone: "", email: "" };

export function MembersPage({ canManage, isAdmin }: { canManage: boolean; isAdmin: boolean }) {
  const { t, language } = useLanguage();
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim());
  const { data, isLoading, isError } = useGetMembersQuery({ q: query || undefined, limit: 50 });
  const { data: nextMemberNumber } = useGetNextMemberNumberQuery();
  const [createMember, createState] = useCreateMemberMutation();
  const [updateMember, updateState] = useUpdateMemberMutation();
  const [archiveMember] = useArchiveMemberMutation();
  const [depositSavings, depositState] = useDepositSavingsMutation();
  const [selected, setSelected] = useState<CooperativeMember | null>(null);
  const { data: ledgerData, isLoading: ledgerLoading } = useGetMemberLedgerQuery(selected?._id ?? "", { skip: !selected });
  const [draft, setDraft] = useState<MemberDraft>(blankDraft);
  const [editing, setEditing] = useState<CooperativeMember | null>(null);
  const [cardTarget, setCardTarget] = useState<CooperativeMember | null>(null);
  const [depositType, setDepositType] = useState<"mandatory" | "voluntary">("voluntary");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (editing || !nextMemberNumber) return;
    setDraft((current) => ({ ...current, memberNo: nextMemberNumber.memberNo }));
  }, [editing, nextMemberNumber]);

  const startEdit = (member: CooperativeMember) => {
    setEditing(member); setDraft({ memberNo: member.memberNo, name: member.name, phone: member.phone ?? "", email: member.email ?? "" });
    setSelected(member); setMessage("");
  };
  const resetForm = () => { setEditing(null); setDraft(blankDraft); };
  const submitMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draft.name.trim();
    const phone = draft.phone.trim();
    const email = draft.email.trim();
    try {
      if (editing) {
        const updated = await updateMember({ id: editing._id, changes: { name, phone, ...(email ? { email } : {}) } }).unwrap();
        setSelected(updated.item);
        setMessage("Data anggota berhasil diperbarui.");
      } else {
        const created = await createMember({ name, ...(phone ? { phone } : {}), ...(email ? { email } : {}) }).unwrap();
        setSelected(created.item);
        setMessage("Anggota berhasil ditambahkan.");
      }
      resetForm();
    } catch { setMessage("Data anggota gagal disimpan. Pastikan nomor anggota unik dan email valid."); }
  };
  const submitDeposit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    try {
      const updated = await depositSavings({ id: selected._id, type: depositType, amount: Number(amount), ...(note.trim() ? { note: note.trim() } : {}) }).unwrap();
      setSelected(updated.item);
      setMessage("Setoran simpanan berhasil dicatat pada buku mutasi."); setAmount(""); setNote("");
    } catch { setMessage("Setoran tidak berhasil. Periksa nominal dan saldo anggota."); }
  };

  return <main className="mx-auto min-h-dvh max-w-[1400px] space-y-5 px-4 py-6 pb-24 md:px-8">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-primary">{t("DATA ANGGOTA")}</p><h1 className="text-2xl font-bold md:text-3xl">{t("Anggota & simpanan")}</h1><p className="mt-1 text-sm text-slate-500">{t("Profil, saldo simpanan wajib/sukarela, poin, dan buku mutasi.")}</p></div><div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800"><UserRound className="h-4 w-4" />{data?.items.length ?? 0} {t("anggota")}</div></header>
    {message && <div role="status" className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{t(message)}<button onClick={() => setMessage("")} aria-label={t("Tutup pesan")}><X className="h-4 w-4" /></button></div>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
      <section className="space-y-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" placeholder={t("Cari nama, nomor anggota, atau telepon")} aria-label={t("Cari anggota")} /></div>
        {isError && <Card className="p-4 text-sm text-red-700">{t("Daftar anggota gagal dimuat.")}</Card>}{isLoading && <Card className="h-36 animate-pulse bg-slate-100" />}{!isLoading && data?.items.length === 0 && <Card className="p-8 text-center text-sm text-slate-500">{t("Anggota belum ditemukan.")}</Card>}
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{data?.items.map((member) => <Card key={member._id} className={`space-y-3 p-4 ${selected?._id === member._id ? "border-primary ring-1 ring-primary/20" : ""}`}><button className="block w-full text-left" onClick={() => { setSelected(member); setMessage(""); }}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{member.name}</p><p className="text-xs text-slate-500">{member.memberNo}{member.phone ? ` · ${member.phone}` : ""}</p></div><Badge className="shrink-0 bg-violet-100 text-violet-800">{member.points} {t("poin")}</Badge></div><div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs"><div><p className="text-slate-500">{t("Simpanan wajib")}</p><p className="mt-1 font-semibold text-slate-800">{formatRupiah(member.savings.mandatory)}</p></div><div><p className="text-slate-500">{t("Simpanan sukarela")}</p><p className="mt-1 font-semibold text-slate-800">{formatRupiah(member.savings.voluntary)}</p></div></div></button><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setCardTarget(member)}><IdCard className="h-4 w-4" />{t("Lihat / cetak")}</Button>{canManage && <Button size="sm" variant="outline" onClick={() => startEdit(member)}><Pencil className="h-4 w-4" />{t("Ubah")}</Button>}{isAdmin && <Button size="sm" variant="ghost" className="text-red-700" onClick={() => { if (window.confirm(`Arsipkan anggota ${member.name}?`)) void archiveMember(member._id); }}><Archive className="h-4 w-4" />{t("Arsip")}</Button>}</div></Card>)}</div>
      </section>
      <aside className="space-y-4">
        {canManage && <Card className="p-4 md:p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">{editing ? t("Ubah anggota") : t("Anggota baru")}</h2><p className="text-xs text-slate-500">{t("Saldo hanya berubah melalui mutasi resmi.")}</p></div>{editing && <Button variant="ghost" size="sm" onClick={resetForm}><X className="h-4 w-4" />{t("Batal")}</Button>}</div><form className="space-y-3" onSubmit={(event) => void submitMember(event)}>{!editing && <Field label={t("Nomor anggota otomatis")}><Input readOnly value={draft.memberNo} placeholder={t("Dibuat otomatis")} /></Field>}<Field label={t("Nama lengkap")}><Input required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field><Field label={t("Nomor telepon")}><Input maxLength={32} inputMode="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></Field><Field label={t("Email")}><Input type="email" maxLength={254} value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field><Button className="w-full" type="submit" disabled={createState.isLoading || updateState.isLoading}>{editing ? t("Simpan perubahan") : <><Plus className="h-4 w-4" />{t("Tambah anggota")}</>}</Button></form></Card>}
        {canManage && <Card className="p-4 md:p-5"><div className="mb-4 flex items-center gap-2"><Coins className="h-4 w-4 text-primary" /><div><h2 className="font-semibold">{t("Catat setoran")}</h2><p className="text-xs text-slate-500">{t("Setoran masuk ke ledger anggota.")}</p></div></div>{selected ? <><p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">{selected.name} <span className="text-slate-500">· sukarela {formatRupiah(selected.savings.voluntary)}</span></p><form className="space-y-3" onSubmit={(event) => void submitDeposit(event)}><Field label={t("Jenis simpanan")}><select className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm" value={depositType} onChange={(event) => setDepositType(event.target.value as "mandatory" | "voluntary")}><option value="voluntary">{t("Sukarela")}</option><option value="mandatory">{t("Wajib")}</option></select></Field><Field label={t("Nominal (rupiah)")}><Input required min="1" step="1" type="number" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field><Field label={t("Catatan")}><Input maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("Setoran bulan ini")} /></Field><Button className="w-full" type="submit" disabled={depositState.isLoading}><Coins className="h-4 w-4" />{t("Simpan setoran")}</Button></form></> : <p className="text-sm text-slate-500">{t("Pilih anggota untuk mencatat simpanan.")}</p>}</Card>}
        {selected && <Card className="flex items-center justify-between gap-3 p-4"><div><h2 className="font-semibold">{t("ID anggota")}</h2><p className="text-xs text-slate-500">{t("Cetak QR untuk identitas absensi.")}</p></div><Button size="sm" variant="outline" onClick={() => setCardTarget(selected)}><IdCard className="h-4 w-4" />{t("Lihat / cetak")}</Button></Card>}<Card className="p-4 md:p-5"><div className="mb-3 flex items-center gap-2"><History className="h-4 w-4 text-primary" /><div><h2 className="font-semibold">{t("Mutasi simpanan")}</h2><p className="text-xs text-slate-500">{t("Maksimal 100 transaksi terbaru.")}</p></div></div>{!selected ? <p className="text-sm text-slate-500">{t("Pilih anggota untuk melihat riwayat.")}</p> : ledgerLoading ? <div className="h-24 animate-pulse rounded bg-slate-100" /> : !ledgerData?.items.length ? <p className="text-sm text-slate-500">{t("Belum ada mutasi simpanan.")}</p> : <ol className="max-h-80 divide-y divide-border overflow-y-auto">{ledgerData.items.map((entry) => <li key={entry._id} className="py-2.5"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-medium">{t(ledgerLabel(entry.type))}</p><p className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString(language === "id" ? "id-ID" : "en-US")}{entry.note ? ` · ${entry.note}` : ""}</p></div><div className="text-right"><p className="text-sm font-semibold">{formatRupiah(entry.amount)}</p><p className="text-xs text-slate-500">{t("Saldo")} {formatRupiah(entry.balanceAfter)}</p></div></div></li>)}</ol>}</Card>
      </aside>
    </div>
    {cardTarget && <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 sm:place-items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCardTarget(null); }}><Card className="w-full rounded-b-none p-5 sm:w-auto sm:rounded-2xl"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">{t("ID anggota & QR absensi")}</h2><p className="text-sm text-slate-500">{t("QR berisi nomor anggota ")}{cardTarget.memberNo}{t(" untuk dipindai sistem absensi.")}</p></div><Button variant="ghost" size="icon" onClick={() => setCardTarget(null)} aria-label={t("Tutup")}><X className="h-4 w-4" /></Button></div><MemberIdCard memberNo={cardTarget.memberNo} name={cardTarget.name} /><Button className="mt-4 w-full" onClick={() => window.print()}><Printer className="h-4 w-4" />{t("Cetak kartu anggota")}</Button></Card></div>}
  </main>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5 text-xs font-medium text-slate-600"><span>{label}</span>{children}</label>; }
function ledgerLabel(type: string) { return ({ mandatory_deposit: "Setoran simpanan wajib", voluntary_deposit: "Setoran simpanan sukarela", voluntary_withdrawal: "Penarikan simpanan sukarela", purchase: "Pembayaran belanja", purchase_reversal: "Pembatalan belanja", adjustment: "Penyesuaian saldo" } as Record<string, string>)[type] ?? type; }
