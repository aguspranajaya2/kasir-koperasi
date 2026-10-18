import { useState, type FormEvent, type ReactNode } from "react";
import { KeyRound, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useCreateUserMutation, useGetUsersQuery, useUpdateUserMutation, type SessionUser } from "../../services/api";
import { useLanguage } from "../../lib/i18n";

type Role = SessionUser["role"];
const roles: Array<{ value: Role; label: string; detail: string }> = [
  { value: "admin", label: "Admin", detail: "Pengaturan akun dan seluruh akses" },
  { value: "cashier", label: "Kasir", detail: "POS dan pencarian master data" },
  { value: "board", label: "Pengurus", detail: "Produk, anggota, kas, dan laporan" }
];

export function UsersPage({ currentUserId }: { currentUserId: string }) {
  const { t, language } = useLanguage();
  const { data, isLoading, isError } = useGetUsersQuery();
  const [createUser, createState] = useCreateUserMutation();
  const [updateUser, updateState] = useUpdateUserMutation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("cashier");
  const [passwordTarget, setPasswordTarget] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createUser({ name: name.trim(), email: email.trim().toLowerCase(), password, role }).unwrap();
      setName(""); setEmail(""); setPassword(""); setRole("cashier"); setMessage("Akun berhasil dibuat.");
    } catch { setMessage("Akun gagal dibuat. Email mungkin sudah terdaftar; kata sandi harus minimal 12 karakter."); }
  };
  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordTarget) return;
    try {
      await updateUser({ id: passwordTarget, changes: { password: newPassword } }).unwrap();
      setPasswordTarget(null); setNewPassword(""); setMessage("Kata sandi diperbarui dan sesi akun tersebut dicabut.");
    } catch { setMessage("Kata sandi gagal diperbarui."); }
  };

  return <main className="mx-auto min-h-dvh max-w-[1400px] space-y-5 px-4 py-6 pb-24 md:px-8">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-primary">{t("AKSES APLIKASI")}</p><h1 className="text-2xl font-bold md:text-3xl">{t("Pengguna & peran")}</h1><p className="mt-1 text-sm text-slate-500">{t("Kelola akun staf dan batasi akses sesuai tugas koperasi.")}</p></div><div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800"><Users className="h-4 w-4" />{data?.items.length ?? 0} {t("akun")}</div></header>
    {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{t(message)}</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
      <section className="space-y-3"><div className="grid gap-3 sm:grid-cols-3">{roles.map((item) => <Card key={item.value} className="p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><p className="font-semibold">{t(item.label)}</p></div><p className="mt-1 text-xs leading-5 text-slate-500">{t(item.detail)}</p></Card>)}</div>
        {isError && <Card className="p-4 text-sm text-red-700">{t("Daftar pengguna gagal dimuat.")}</Card>}{isLoading && <Card className="h-28 animate-pulse bg-slate-100" />}
        {data?.items.map((user) => <Card key={user._id} className="space-y-3 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{user.name}{user._id === currentUserId ? <span className="ml-2 text-xs font-normal text-slate-500">({t("akun Anda")})</span> : null}</p><p className="truncate text-sm text-slate-500">{user.email}</p><p className="mt-1 text-xs text-slate-400">{user.lastLoginAt ? `${t("Login terakhir")} ${new Date(user.lastLoginAt).toLocaleString(language === "id" ? "id-ID" : "en-US")}` : t("Belum pernah login")}</p></div><Badge className={user.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}>{user.active ? "Aktif" : "Nonaktif"}</Badge></div><div className="flex flex-wrap items-end gap-2"><label className="min-w-40 flex-1 space-y-1 text-xs font-medium text-slate-600"><span>{t("Peran")}</span><select className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm" value={user.role} disabled={updateState.isLoading || user._id === currentUserId} onChange={(event) => void updateUser({ id: user._id, changes: { role: event.target.value as Role } }).unwrap().then(() => setMessage(`Peran ${user.name} diperbarui.`)).catch(() => setMessage("Peran gagal diperbarui."))}>{roles.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></label><Button variant="outline" size="sm" onClick={() => { setPasswordTarget(user._id); setNewPassword(""); }}><KeyRound className="h-4 w-4" />{t("Atur kata sandi")}</Button><Button variant={user.active ? "outline" : "default"} size="sm" disabled={user._id === currentUserId || updateState.isLoading} onClick={() => void updateUser({ id: user._id, changes: { active: !user.active } }).unwrap().then(() => setMessage(user.active ? "Akun dinonaktifkan dan seluruh sesi dicabut." : "Akun diaktifkan.")).catch(() => setMessage("Status akun gagal diubah."))}>{user.active ? t("Nonaktifkan") : t("Aktifkan")}</Button></div></Card>)}
      </section>
      <aside><Card className="p-4 md:p-5"><div className="mb-4 flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /><div><h2 className="font-semibold">{t("Buat akun staf")}</h2><p className="text-xs text-slate-500">{t("Kata sandi minimal 12 karakter.")}</p></div></div><form className="space-y-3" onSubmit={(event) => void submit(event)}><Field label={t("Nama")}><Input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Email"><Input required type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field><Field label={t("Kata sandi awal")}><Input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field><Field label={t("Peran")}><select className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value as Role)}>{roles.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></Field><Button className="w-full" type="submit" disabled={createState.isLoading}><UserPlus className="h-4 w-4" />{t("Buat akun")}</Button></form></Card></aside>
    </div>
    {passwordTarget && <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 sm:place-items-center sm:p-4"><Card className="w-full space-y-4 rounded-b-none p-5 sm:max-w-md sm:rounded-2xl"><div><h2 className="font-semibold">{t("Atur kata sandi baru")}</h2><p className="text-sm text-slate-500">{t("Sesi pengguna akan dicabut setelah diperbarui.")}</p></div><form className="space-y-3" onSubmit={(event) => void savePassword(event)}><Field label={t("Kata sandi baru")}><Input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></Field><div className="flex gap-2"><Button className="flex-1" type="submit" disabled={updateState.isLoading}>{t("Simpan kata sandi")}</Button><Button type="button" variant="outline" onClick={() => setPasswordTarget(null)}>{t("Batal")}</Button></div></form></Card></div>}
  </main>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5 text-xs font-medium text-slate-600"><span>{label}</span>{children}</label>; }
