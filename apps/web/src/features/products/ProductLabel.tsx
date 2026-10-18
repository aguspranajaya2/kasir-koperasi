import Barcode from "react-barcode";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useLanguage } from "../../lib/i18n";

export function ProductLabel({ name, sku, barcode }: { name: string; sku: string; barcode?: string }) {
  const { t } = useLanguage();
  const value = barcode || sku;
  return <div className="print-label inline-flex flex-col items-center rounded-lg border border-border bg-white p-3 text-center">
    <p className="max-w-48 truncate text-sm font-semibold">{name}</p>
    <Barcode value={value} height={48} width={1.5} displayValue />
    <QRCodeSVG value={value} size={84} level="M" includeMargin />
    <Button className="mt-2 print:hidden" variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" />{t("Cetak label")}</Button>
  </div>;
}
