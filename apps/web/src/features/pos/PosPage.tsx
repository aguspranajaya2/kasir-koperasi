import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AlertTriangle, Minus, Plus, Printer, Search, ShoppingBag, Trash2 } from "lucide-react";
import type { AppDispatch, RootState } from "../../app/store";
import { addToCart, clearCart, removeLine, setQuantity } from "../cart/cartSlice";
import type { Product } from "../cart/cartSlice";
import { useCheckoutMutation, useGetCheckoutConfigQuery, useGetLowStockQuery, useGetMembersQuery, useGetProductsQuery, type TransactionReceipt } from "../../services/api";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { formatRupiah } from "../../lib/utils";
import { Receipt } from "./Receipt";
import { useLanguage } from "../../lib/i18n";

export function PosPage() {
  const { t } = useLanguage();
  const dispatch = useDispatch<AppDispatch>();
  const lines = useSelector((state: RootState) => state.cart.lines);
  const [search, setSearch] = useState("");
  const [cash, setCash] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "member_balance">("cash");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<{ _id: string; memberNo: string; name: string; savings: { voluntary: number } } | null>(null);
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
  const deferredSearch = useDeferredValue(search);
  const { data, isLoading, isError } = useGetProductsQuery({ q: deferredSearch || undefined, limit: 40 });
  const { data: checkoutConfig } = useGetCheckoutConfigQuery();
  const { data: lowStockData } = useGetLowStockQuery(undefined, { pollingInterval: 60_000 });
  const { data: members } = useGetMembersQuery({ q: memberSearch }, { skip: paymentMethod !== "member_balance" && !memberSearch });
  const [checkout, checkoutState] = useCheckoutMutation();
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + line.product.price * line.qty, 0), [lines]);
  const tax = Math.round(subtotal * (checkoutConfig?.taxRateBps ?? 0) / 10000);
  const total = subtotal + tax;
  const parsedCash = Number(cash.replace(/\D/g, "")) || 0;
  const amountTendered = paymentMethod === "cash" ? parsedCash : total;
  const insufficientMemberBalance = paymentMethod === "member_balance" && (!selectedMember || selectedMember.savings.voluntary < total);

  useEffect(() => { setCheckoutKey(null); }, [lines]);

  useEffect(() => {
    if (!receipt) return;
    const timer = window.setTimeout(() => window.print(), 200);
    return () => window.clearTimeout(timer);
  }, [receipt]);

  const pay = async () => {
    if (!lines.length || (paymentMethod === "cash" && parsedCash < total) || insufficientMemberBalance) return;
    const idempotencyKey = checkoutKey ?? crypto.randomUUID();
    if (!checkoutKey) setCheckoutKey(idempotencyKey);
    try {
      const result = await checkout({
        idempotencyKey,
        items: lines.map(({ product, qty }) => ({ productId: product._id, qty })),
        paymentMethod, paidAmount: amountTendered, memberId: selectedMember?._id, discount: 0
      }).unwrap();
      setReceipt(result.item);
      dispatch(clearCart());
      setCash("");
      setSelectedMember(null);
      setCheckoutKey(null);
      setCartOpen(false);
    } catch { /* Error state is shown from RTK Query below. */ }
  };

  const cart = <Card className="flex max-h-[calc(100dvh-7.5rem)] flex-col overflow-hidden p-4 md:max-h-[calc(100dvh-8rem)]">
    <div className="mb-3 flex items-center justify-between">
      <div><h2 className="text-lg font-semibold">{t("Keranjang")}</h2><p className="text-sm text-slate-500">{lines.length} {t("jenis barang")}</p></div>
      {lines.length > 0 && <Button variant="ghost" size="sm" disabled={checkoutState.isLoading} onClick={() => dispatch(clearCart())}>{t("Kosongkan")}</Button>}
    </div>
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
      {lines.length === 0 ? <div className="grid min-h-36 place-items-center text-center text-sm text-slate-500"><div><ShoppingBag className="mx-auto mb-2 h-6 w-6" />{t("Keranjang masih kosong")}</div></div> : lines.map(({ product, qty }) => <div key={product._id} className="rounded-lg border border-border p-3">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-medium">{product.name}</p><p className="text-sm text-slate-500">{formatRupiah(product.price)}</p></div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" disabled={checkoutState.isLoading} aria-label={`Hapus ${product.name}`} onClick={() => dispatch(removeLine(product._id))}><Trash2 className="h-4 w-4" /></Button></div>
        <div className="mt-2 flex items-center justify-between"><div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" disabled={checkoutState.isLoading} aria-label={t("Kurangi jumlah")} onClick={() => dispatch(setQuantity({ productId: product._id, qty: qty - 1 }))}><Minus className="h-4 w-4" /></Button>
          <span className="w-7 text-center font-medium">{qty}</span>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label={t("Tambah jumlah")} disabled={checkoutState.isLoading || qty >= product.stock} onClick={() => dispatch(setQuantity({ productId: product._id, qty: qty + 1 }))}><Plus className="h-4 w-4" /></Button>
        </div><strong>{formatRupiah(product.price * qty)}</strong></div>
      </div>)}</div>
    <div className="mt-4 border-t border-border pt-4">
      <div className="mb-3 flex justify-between text-lg font-bold"><span>{t("Total")}</span><span>{formatRupiah(total)}</span></div>
      {tax > 0 && <div className="-mt-2 mb-3 flex justify-between text-sm text-slate-500"><span>{t("Pajak")}</span><span>{formatRupiah(tax)}</span></div>}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button variant={paymentMethod === "cash" ? "default" : "outline"} size="sm" disabled={checkoutState.isLoading} onClick={() => setPaymentMethod("cash")}>{t("Tunai")}</Button>
        <Button variant={paymentMethod === "member_balance" ? "default" : "outline"} size="sm" disabled={checkoutState.isLoading} onClick={() => setPaymentMethod("member_balance")}>{t("Saldo anggota")}</Button>
      </div>
      <div className="mb-3 space-y-2">
        <label className="block text-sm font-medium" htmlFor="member-search">{t("Anggota")} {paymentMethod === "cash" ? `(${t("opsional untuk poin")})` : ""}</label>
        <Input id="member-search" disabled={checkoutState.isLoading} placeholder={t("Cari nomor atau nama anggota")} value={memberSearch} onChange={(event) => { setMemberSearch(event.target.value); setSelectedMember(null); }} />
        {selectedMember ? <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3 text-sm"><span>{selectedMember.name} · {selectedMember.memberNo}</span><span className="flex items-center gap-2"><strong>{formatRupiah(selectedMember.savings.voluntary)}</strong><button disabled={checkoutState.isLoading} className="text-primary underline" onClick={() => setSelectedMember(null)}>{t("Hapus")}</button></span></div>
          : (paymentMethod === "member_balance" || memberSearch.length > 0) && <div className="max-h-32 space-y-1 overflow-y-auto">{members?.items.map((member) => <button key={member._id} disabled={checkoutState.isLoading} className="flex w-full justify-between rounded-md p-2 text-left text-sm hover:bg-muted disabled:opacity-50" onClick={() => setSelectedMember(member)}><span>{member.name} · {member.memberNo}</span><span>{formatRupiah(member.savings.voluntary)}</span></button>)}</div>}
        {insufficientMemberBalance && selectedMember && <p className="text-xs text-red-600">{t("Saldo sukarela tidak mencukupi.")}</p>}
      </div>
      {paymentMethod === "cash" && <>
        <label className="mb-2 block text-sm font-medium" htmlFor="cash">{t("Uang diterima")}</label>
        <Input id="cash" disabled={checkoutState.isLoading} inputMode="numeric" placeholder={t("Masukkan nominal")} value={cash} onChange={(event) => setCash(event.target.value)} />
        <div className="my-2 flex justify-between text-sm text-slate-500"><span>{t("Kembalian")}</span><span>{formatRupiah(Math.max(0, parsedCash - total))}</span></div>
      </>}
      {checkoutState.isError && <p className="mb-2 text-sm text-red-600">{t("Transaksi gagal. Periksa stok, koneksi, atau sesi login.")}</p>}
      <Button className="mt-3 w-full" disabled={!lines.length || (paymentMethod === "cash" && parsedCash < total) || insufficientMemberBalance || checkoutState.isLoading} onClick={() => void pay()}>
        {checkoutState.isLoading ? t("Memproses…") : paymentMethod === "cash" ? t("Bayar tunai") : t("Bayar dari saldo anggota")}
      </Button>
    </div>
  </Card>;

  return <main className="mx-auto min-h-dvh max-w-[1600px] px-4 pb-8 pt-5 md:px-8">
    <header className="mb-6 flex items-center justify-between gap-4">
      <div><p className="text-sm font-medium text-primary">{t("KOPERASI")}</p><h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("Kasir")}</h1></div>
      {lowStockData?.items.length ? <Badge className="bg-amber-50 text-amber-800">{lowStockData.items.length} {t("Stok menipis")}</Badge> : <Badge className="bg-emerald-50 text-emerald-700">{t("POS aktif")}</Badge>}
    </header>
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <div className="relative mb-4"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><Input autoFocus placeholder={t("Cari nama, SKU, atau barcode…")} className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        {isLoading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-slate-200" />)}</div>
          : isError ? <Card className="p-5 text-sm text-red-700">{t("Produk tidak dapat dimuat. Pastikan sudah masuk dan API berjalan.")}</Card>
          : data?.items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{data.items.map((product: Product) => <ProductTile key={product._id} product={product} disabled={checkoutState.isLoading} onAdd={() => dispatch(addToCart(product))} />)}</div>
          : <Card className="p-8 text-center text-slate-500">{t("Produk tidak ditemukan.")}</Card>}
      </section>
      <aside className="hidden md:block">{cart}</aside>
    </div>
    <div className="md:hidden">
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white/95 p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur">
        <Button variant={cartOpen ? "outline" : "default"} className="w-full justify-between" onClick={() => setCartOpen(!cartOpen)}>
          <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" />{cartOpen ? t("Tutup keranjang") : `${t("Keranjang")} · ${lines.reduce((n, line) => n + line.qty, 0)} ${t("barang")}`}</span>
          <span>{formatRupiah(subtotal)}</span>
        </Button>
        {cartOpen && <div className="mt-3">{cart}</div>}
      </div>
      <div className="h-20" />
    </div>
    {lowStockData?.items.length ? <p className="mt-5 flex items-center gap-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" />{t("Ada")} {lowStockData.items.length} {t("produk dengan stok menipis. Hubungi pengurus untuk pengisian stok.")}</p> : null}
    {receipt && <><div className="fixed bottom-20 right-4 z-10 hidden print:hidden md:block"><Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />{t("Cetak ulang struk")}</Button></div><Receipt transaction={receipt} /></>}
  </main>;
}

function ProductTile({ product, onAdd, disabled = false }: { product: Product; onAdd: () => void; disabled?: boolean }) {
  const low = product.stock <= product.lowStockThreshold;
  return <button onClick={onAdd} disabled={disabled || product.stock < 1} className="group min-h-36 rounded-xl border border-border bg-white p-3 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md active:scale-[.99] disabled:opacity-50">
    <div className="mb-3 flex items-start justify-between gap-2"><Badge className={low ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}>{product.stock} {product.unit}</Badge><Plus className="h-4 w-4 text-slate-400 group-hover:text-primary" /></div>
    <p className="line-clamp-2 min-h-10 font-medium">{product.name}</p><p className="mt-2 font-semibold text-primary">{formatRupiah(product.price)}</p>
  </button>;
}
