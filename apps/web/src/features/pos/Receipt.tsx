import type { TransactionReceipt } from "../../services/api";
import { formatRupiah } from "../../lib/utils";
import { useLanguage } from "../../lib/i18n";

export function Receipt({ transaction }: { transaction: TransactionReceipt }) {
  const { t, language } = useLanguage();
  return <section className="print-receipt mx-auto hidden w-[72mm] bg-white p-2 font-mono text-[11px] text-black print:block">
    <h1 className="text-center text-sm font-bold">{t("KOPERASI")}</h1>
    <p className="text-center">{t("Struk transaksi")}</p>
    <hr className="my-2 border-dashed" />
    <p>{transaction.receiptNo}</p>
    <p>{new Date(transaction.createdAt).toLocaleString(language === "id" ? "id-ID" : "en-US")}</p>
    <hr className="my-2 border-dashed" />
    {transaction.items.map((line, index) => <div key={`${line.name}-${index}`} className="mb-1">
      <p>{line.name}</p><p className="flex justify-between"><span>{line.qty} x {formatRupiah(line.unitPrice)}</span><span>{formatRupiah(line.lineTotal)}</span></p>
    </div>)}
    <hr className="my-2 border-dashed" />
    <p className="flex justify-between"><span>{t("Subtotal")}</span><span>{formatRupiah(transaction.subtotal)}</span></p>
    {transaction.discount > 0 && <p className="flex justify-between"><span>{t("Diskon")}</span><span>-{formatRupiah(transaction.discount)}</span></p>}
    {transaction.tax > 0 && <p className="flex justify-between"><span>{t("Pajak")}</span><span>{formatRupiah(transaction.tax)}</span></p>}
    <p className="flex justify-between font-bold"><span>{t("Total")}</span><span>{formatRupiah(transaction.total)}</span></p>
    <p className="flex justify-between"><span>{t("Dibayar")}</span><span>{formatRupiah(transaction.paidAmount)}</span></p>
    <p className="flex justify-between"><span>{t("Kembalian")}</span><span>{formatRupiah(transaction.changeAmount)}</span></p>
    <p className="mt-3 text-center">{t("Terima kasih")}</p>
  </section>;
}
