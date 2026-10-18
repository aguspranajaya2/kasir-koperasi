import { lazy, Suspense, useState } from "react";
import { LogOut, Store } from "lucide-react";
import { Button } from "./components/ui/button";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { LoginPage } from "./features/auth/LoginPage";
import { PosPage } from "./features/pos/PosPage";
import { useGetMeQuery, useLogoutMutation, type SessionUser } from "./services/api";
import { useLanguage } from "./lib/i18n";

const InventoryPage = lazy(() => import("./features/inventory/InventoryPage").then((module) => ({ default: module.InventoryPage })));
const MembersPage = lazy(() => import("./features/members/MembersPage").then((module) => ({ default: module.MembersPage })));
const OperationsPage = lazy(() => import("./features/operations/OperationsPage").then((module) => ({ default: module.OperationsPage })));
const ReportsPage = lazy(() => import("./features/reports/ReportsPage").then((module) => ({ default: module.ReportsPage })));
const UsersPage = lazy(() => import("./features/users/UsersPage").then((module) => ({ default: module.UsersPage })));

type Page = "pos" | "inventory" | "members" | "users" | "operations" | "reports";
export default function App() {
  const { t } = useLanguage();
  const { data, isLoading, isError } = useGetMeQuery();
  const [logout] = useLogoutMutation();
  const [page, setPage] = useState<Page>("pos");
  if (isLoading) return <main className="grid min-h-dvh place-items-center text-slate-500">{t("Memuat sesi…")}</main>;
  if (isError || !data) return <LoginPage />;

  const role = data.user.role;
  const isAdmin = role === "admin";
  const canManage = isAdmin || role === "board";
  const canViewReports = canManage;
  const roleLabel: Record<SessionUser["role"], string> = { admin: t("Admin"), cashier: t("Cashier"), board: t("Pengurus") };
  const navItems: Array<{ key: Page; label: string }> = [
    { key: "pos", label: "Kasir" },
    ...(canManage ? [{ key: "inventory" as const, label: "Produk & stok" }, { key: "members" as const, label: "Anggota" }] : []),
    ...(isAdmin ? [{ key: "users" as const, label: "Pengguna" }] : []),
    ...(canViewReports ? [{ key: "operations" as const, label: "Kas & audit" }, { key: "reports" as const, label: "Laporan" }] : [])
  ];
  const currentPage = navItems.some((item) => item.key === page) ? page : "pos";

  return <div className="min-h-dvh bg-slate-50">
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur print:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-3 md:px-8"><div className="flex min-w-0 items-center gap-2"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white"><Store className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-sm font-bold">Koperasi</p><p className="hidden text-[11px] text-slate-500 sm:block">{t("Sistem kasir & anggota")}</p></div></div><div className="flex items-center gap-2"><span className="hidden text-right sm:block"><span className="block max-w-44 truncate text-sm font-medium">{data.user.name}</span><span className="block text-xs text-slate-500">{roleLabel[role]}</span></span><LanguageSwitcher /><Button variant="ghost" size="sm" aria-label={t("Keluar")} onClick={() => void logout()}><LogOut className="h-4 w-4" /><span className="hidden sm:inline">{t("Keluar")}</span></Button></div></div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:px-8" aria-label={t("Menu utama")}>{navItems.map((item) => <Button key={item.key} size="sm" variant={currentPage === item.key ? "default" : "ghost"} className="shrink-0" onClick={() => setPage(item.key)}>{t(item.label)}</Button>)}</nav>
    </header>
    <Suspense fallback={<main className="mx-auto min-h-64 max-w-7xl px-4 py-8 text-sm text-slate-500">{t("Memuat halaman…")}</main>}>
    {currentPage === "inventory" && canManage ? <InventoryPage canManage={canManage} isAdmin={isAdmin} />
      : currentPage === "members" && canManage ? <MembersPage canManage={canManage} isAdmin={isAdmin} />
      : currentPage === "users" && isAdmin ? <UsersPage currentUserId={data.user.id ?? data.user._id ?? ""} />
      : currentPage === "operations" && canViewReports ? <OperationsPage />
      : currentPage === "reports" && canViewReports ? <ReportsPage />
      : <PosPage />}
    </Suspense>
  </div>;
}
