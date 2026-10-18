import { useDeferredValue, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Archive, Barcode, Boxes, Pencil, Plus, RotateCcw, Save, Search, Tag, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { formatRupiah } from "../../lib/utils";
import {
  useAdjustStockMutation, useArchiveCategoryMutation, useArchiveProductMutation, useCreateCategoryMutation,
  useCreateProductMutation, useGetCategoriesQuery, useGetInventoryProductsQuery, useGetNextProductCodeQuery, useUpdateCategoryMutation,
  useUpdateProductMutation, type Category, type InventoryProduct
} from "../../services/api";
import { ProductLabel } from "../products/ProductLabel";
import { useLanguage } from "../../lib/i18n";

type ProductDraft = { sku: string; barcode: string; name: string; categoryId: string; unit: string; price: string; cost: string; stock: string; lowStockThreshold: string };
const emptyProduct: ProductDraft = { sku: "", barcode: "", name: "", categoryId: "", unit: "pcs", price: "", cost: "", stock: "0", lowStockThreshold: "5" };
const toSlug = (value: string) => value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function InventoryPage({ canManage, isAdmin }: { canManage: boolean; isAdmin: boolean }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim());
  const { data, isLoading, isError } = useGetInventoryProductsQuery({ q: query || undefined, limit: 100 });
  const { data: categoryData } = useGetCategoriesQuery();
  const { data: nextProductCode } = useGetNextProductCodeQuery();
  const [createProduct, createState] = useCreateProductMutation();
  const [updateProduct, updateState] = useUpdateProductMutation();
  const [archiveProduct] = useArchiveProductMutation();
  const [adjustStock, stockState] = useAdjustStockMutation();
  const [createCategory] = useCreateCategoryMutation();
  const [updateCategory] = useUpdateCategoryMutation();
  const [archiveCategory] = useArchiveCategoryMutation();
  const [draft, setDraft] = useState<ProductDraft>(emptyProduct);
  const [editing, setEditing] = useState<InventoryProduct | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<InventoryProduct | null>(null);
  const [stockTarget, setStockTarget] = useState<InventoryProduct | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (editing || !nextProductCode) return;
    setDraft((current) => ({ ...current, sku: nextProductCode.sku, barcode: nextProductCode.barcode }));
  }, [editing, nextProductCode]);

  const startEdit = (product: InventoryProduct) => {
    setEditing(product);
    setDraft({ sku: product.sku, barcode: product.barcode ?? "", name: product.name, categoryId: product.categoryId ?? "", unit: product.unit, price: String(product.price), cost: String(product.cost ?? 0), stock: String(product.stock), lowStockThreshold: String(product.lowStockThreshold) });
    setMessage("");
  };
  const resetProduct = () => { setEditing(null); setDraft(emptyProduct); };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const common = {
      ...(editing ? { sku: draft.sku.trim(), ...(draft.barcode.trim() ? { barcode: draft.barcode.trim() } : {}) } : {}), name: draft.name.trim(),
      ...(draft.categoryId ? { categoryId: draft.categoryId } : {}), unit: draft.unit.trim() || "pcs",
      price: Number(draft.price), cost: Number(draft.cost), lowStockThreshold: Number(draft.lowStockThreshold)
    };
    try {
      if (editing) await updateProduct({ id: editing._id, changes: common }).unwrap();
      else {
        await createProduct({ ...common, stock: Number(draft.stock) }).unwrap();
        setMessage(`Produk berhasil ditambahkan.`);
      }
      if (editing) setMessage("Produk berhasil diperbarui.");
      resetProduct();
    } catch { setMessage("Produk tidak tersimpan. Periksa SKU/barcode duplikat dan data yang diisi."); }
  };

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    const payload = { name, slug: toSlug(name) };
    try {
      if (editingCategory) await updateCategory({ id: editingCategory._id, ...payload }).unwrap();
      else await createCategory(payload).unwrap();
      setCategoryName(""); setEditingCategory(null); setMessage("Kategori berhasil disimpan.");
    } catch { setMessage("Kategori tidak tersimpan. Nama kategori mungkin sudah digunakan."); }
  };

  const submitStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stockTarget) return;
    try {
      await adjustStock({ id: stockTarget._id, delta: Number(delta), reason: reason.trim() }).unwrap();
      setMessage("Penyesuaian stok dan audit berhasil dicatat."); setStockTarget(null); setDelta(""); setReason("");
    } catch { setMessage("Stok tidak berubah. Pastikan jumlah tidak membuat stok menjadi negatif."); }
  };

  return <main className="mx-auto min-h-dvh max-w-[1400px] space-y-5 px-4 py-6 pb-24 md:px-8">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-primary">{t("MASTER DATA")}</p><h1 className="text-2xl font-bold md:text-3xl">{t("Produk & stok")}</h1><p className="mt-1 text-sm text-slate-500">{t("Katalog, kategori, label barcode, dan penyesuaian stok.")}</p></div><div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"><Boxes className="h-4 w-4" />{data?.total ?? data?.items.length ?? 0} {t("produk")}</div></header>
    {message && <div role="status" className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{t(message)}<button onClick={() => setMessage("")} aria-label={t("Tutup pesan")}><X className="h-4 w-4" /></button></div>}

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
      <section className="space-y-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" placeholder={t("Cari nama, SKU, atau barcode")} aria-label={t("Cari produk")} /></div>
        {isError && <Card className="p-4 text-sm text-red-700">{t("Daftar produk gagal dimuat.")}</Card>}
        {isLoading && <Card className="h-36 animate-pulse bg-slate-100" />}
        {!isLoading && data?.items.length === 0 && <Card className="p-8 text-center text-sm text-slate-500">{t("Belum ada produk yang cocok.")}</Card>}
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {data?.items.map((product) => <Card key={product._id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{product.name}</p><p className="mt-0.5 text-xs text-slate-500">{product.sku}{product.barcode ? ` · ${product.barcode}` : ""}</p></div><Badge className={product.stock <= product.lowStockThreshold ? "shrink-0 bg-amber-100 text-amber-800" : "shrink-0 bg-emerald-100 text-emerald-800"}>{product.stock <= product.lowStockThreshold ? t("Stok menipis") : t("Tersedia")}</Badge></div>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm"><div><p className="text-xs text-slate-500">{t("Harga jual")}</p><p className="font-semibold">{formatRupiah(product.price)}</p></div><div><p className="text-xs text-slate-500">{t("Stok")}</p><p className="font-semibold">{product.stock} {product.unit}</p></div></div>
            <div className="mt-auto flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setSelectedLabel(product)}><Barcode className="h-4 w-4" />{t("Label")}</Button>{canManage && <><Button size="sm" variant="outline" onClick={() => startEdit(product)}><Pencil className="h-4 w-4" />{t("Ubah")}</Button><Button size="sm" variant="outline" onClick={() => { setStockTarget(product); setDelta(""); setReason(""); }}><RotateCcw className="h-4 w-4" />{t("Stok")}</Button>{isAdmin && <Button size="sm" variant="ghost" className="text-red-700" onClick={() => { if (window.confirm(`Arsipkan ${product.name}?`)) void archiveProduct(product._id); }}><Archive className="h-4 w-4" />{t("Arsip")}</Button>}</>}</div>
          </Card>)}
        </div>
      </section>

    <aside className="flex flex-col gap-4">
        {canManage && <Card className="order-2 p-4 md:p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">{editing ? t("Ubah produk") : t("Tambah produk")}</h2><p className="text-xs text-slate-500">{t("Harga dan biaya dicatat dalam rupiah.")}</p></div>{editing && <Button variant="ghost" size="sm" onClick={resetProduct}><X className="h-4 w-4" />Batal</Button>}</div>
          <form className="space-y-3" onSubmit={(event) => void saveProduct(event)}><div className="grid grid-cols-2 gap-3"><Field label={editing ? t("SKU") : t("SKU otomatis")}><Input required readOnly={!editing} maxLength={48} value={draft.sku} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} placeholder={t("Dibuat otomatis")} /></Field><Field label={editing ? t("Barcode") : t("Barcode otomatis dari SKU")}><Input readOnly={!editing} maxLength={80} value={draft.barcode} onChange={(event) => setDraft({ ...draft, barcode: event.target.value })} placeholder={t("Dibuat otomatis")} /></Field></div><Field label={t("Nama produk")}><Input required maxLength={160} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label={t("Kategori")}><select className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm" value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}><option value="">{t("Tanpa kategori")}</option>{categoryData?.items.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></Field><Field label={t("Satuan")}><Input maxLength={24} value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} /></Field></div><div className="grid grid-cols-2 gap-3"><Field label={t("Harga jual")}><Input required min="0" step="1" type="number" inputMode="numeric" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} /></Field><Field label={t("Harga pokok")}><Input required min="0" step="1" type="number" inputMode="numeric" value={draft.cost} onChange={(event) => setDraft({ ...draft, cost: event.target.value })} /></Field></div><div className="grid grid-cols-2 gap-3"><Field label={editing ? t("Stok saat ini") : t("Stok awal")}><Input disabled={Boolean(editing)} required min="0" step="1" type="number" inputMode="numeric" value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: event.target.value })} /></Field><Field label={t("Batas stok rendah")}><Input required min="0" step="1" type="number" inputMode="numeric" value={draft.lowStockThreshold} onChange={(event) => setDraft({ ...draft, lowStockThreshold: event.target.value })} /></Field></div><Button className="w-full" type="submit" disabled={createState.isLoading || updateState.isLoading}><Save className="h-4 w-4" />{editing ? t("Simpan perubahan") : t("Simpan produk")}</Button></form>
        </Card>}

        {canManage && <Card className="order-1 p-4 md:p-5"><div className="mb-1 flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /><h2 className="font-semibold">{t("Kategori")}</h2></div><p className="mb-3 text-xs text-slate-500">{t("Buat kategori di sini, lalu pilih saat menambahkan produk.")}</p><form className="flex gap-2" onSubmit={(event) => void saveCategory(event)}><Input aria-label={t("Nama kategori")} placeholder={t("Contoh: Sembako")} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /><Button type="submit" size="icon" aria-label={editingCategory ? t("Simpan kategori") : t("Tambah kategori")}>{editingCategory ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</Button></form>{editingCategory && <p className="mt-2 text-xs text-slate-500">{t("Mengubah:")} {editingCategory.name}<button className="ml-2 underline" onClick={() => { setEditingCategory(null); setCategoryName(""); }}>{t("Batal")}</button></p>}{categoryData && categoryData.items.length === 0 && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">{t("Belum ada kategori. Ketik nama kategori di atas, lalu tekan tombol +.")}</p>}<ul className="mt-3 divide-y divide-border">{categoryData?.items.map((category) => <li key={category._id} className="flex items-center justify-between py-2 text-sm"><span>{category.name}</span><span className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`Ubah ${category.name}`} onClick={() => { setEditingCategory(category); setCategoryName(category.name); }}><Pencil className="h-4 w-4" /></Button>{isAdmin && <Button variant="ghost" size="icon" className="text-red-700" aria-label={`Arsipkan ${category.name}`} onClick={() => { if (window.confirm(`Arsipkan kategori ${category.name}?`)) void archiveCategory(category._id); }}><Archive className="h-4 w-4" /></Button>}</span></li>)}</ul></Card>}
      </aside>
    </div>

    {stockTarget && <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 sm:place-items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setStockTarget(null); }}><Card className="w-full space-y-4 rounded-b-none p-5 sm:max-w-md sm:rounded-2xl"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">{t("Penyesuaian stok")}</h2><p className="text-sm text-slate-500">{stockTarget.name} · stok saat ini {stockTarget.stock}</p></div><Button variant="ghost" size="icon" onClick={() => setStockTarget(null)} aria-label={t("Tutup")}><X className="h-4 w-4" /></Button></div><form className="space-y-3" onSubmit={(event) => void submitStock(event)}><Field label={t("Perubahan jumlah (gunakan minus untuk stok keluar)")}><Input required type="number" step="1" inputMode="numeric" value={delta} onChange={(event) => setDelta(event.target.value)} placeholder={t("Contoh: 12 atau -2")} /></Field><Field label={t("Alasan (wajib untuk audit)")}><Input required minLength={3} maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t("Stok opname / barang rusak")} /></Field><Button className="w-full" type="submit" disabled={stockState.isLoading || !Number(delta)}><RotateCcw className="h-4 w-4" />{t("Catat penyesuaian")}</Button></form></Card></div>}
    {selectedLabel && <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 sm:place-items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedLabel(null); }}><Card className="w-full rounded-b-none p-5 sm:w-auto sm:rounded-2xl"><div className="mb-3 flex items-center justify-between print:hidden"><div><h2 className="font-semibold">{t("Label produk")}</h2><p className="text-sm text-slate-500">{selectedLabel.sku}</p></div><Button variant="ghost" size="icon" onClick={() => setSelectedLabel(null)} aria-label={t("Tutup")}><X className="h-4 w-4" /></Button></div><ProductLabel name={selectedLabel.name} sku={selectedLabel.sku} barcode={selectedLabel.barcode} /></Card></div>}
  </main>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5 text-xs font-medium text-slate-600"><span>{label}</span>{children}</label>;
}
