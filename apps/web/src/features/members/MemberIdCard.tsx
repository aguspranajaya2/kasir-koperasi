import { QRCodeSVG } from "qrcode.react";
import { useLanguage } from "../../lib/i18n";

export function MemberIdCard({ memberNo, name }: { memberNo: string; name: string }) {
  const { t } = useLanguage();
  return <article className="print-member-card relative flex h-[54mm] w-full max-w-[86mm] overflow-hidden rounded-xl border border-emerald-200 bg-white p-3 text-slate-900 shadow-sm print:rounded-none print:border-0 print:shadow-none">
    <div className="absolute inset-x-0 top-0 h-2 bg-emerald-700" />
    <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
      <div><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-emerald-700">{t("Koperasi")}</p><h3 className="mt-2 line-clamp-2 text-sm font-bold leading-tight">{name}</h3></div>
      <div><p className="text-[8px] uppercase tracking-wide text-slate-500">{t("Nomor anggota")}</p><p className="font-mono text-xs font-bold tracking-wider">{memberNo}</p><p className="mt-1 text-[8px] text-slate-500">{t("Kartu anggota · QR absensi")}</p></div>
    </div>
    <div className="ml-2 flex flex-col items-center justify-center border-l border-slate-100 pl-2">
      <QRCodeSVG value={memberNo} size={116} level="H" includeMargin aria-label={`QR code anggota ${memberNo}`} />
      <span className="mt-1 font-mono text-[8px] text-slate-500">SCAN ID</span>
    </div>
  </article>;
}
