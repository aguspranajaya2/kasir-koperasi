import type { SalesReport } from "../../services/api";

export async function exportSalesExcel(report: SalesReport): Promise<void> {
  const { utils, writeFile } = await import("xlsx");
  const workbook = utils.book_new();
  const summary = [{
    Periode: `${report.from} s.d. ${report.to}`,
    Transaksi: report.summary.orders,
    Penjualan: report.summary.revenue,
    HPP: report.summary.itemCost,
    "Laba kotor": report.summary.grossProfit,
    Pajak: report.summary.tax,
    Diskon: report.summary.discount
  }];
  utils.book_append_sheet(workbook, utils.json_to_sheet(summary), "Ringkasan");
  utils.book_append_sheet(workbook, utils.json_to_sheet(report.daily.map((row) => ({ Tanggal: row._id, Transaksi: row.orders, Penjualan: row.revenue }))), "Harian");
  writeFile(workbook, `laporan-penjualan-${report.from}-${report.to}.xlsx`);
}

export async function exportSalesPdf(report: SalesReport): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFontSize(18);
  doc.text("Laporan Penjualan Koperasi", 15, 20);
  doc.setFontSize(10);
  doc.text(`Periode: ${report.from} sampai ${report.to}`, 15, 28);
  doc.text(`Transaksi: ${report.summary.orders}`, 15, 38);
  doc.text(`Penjualan bersih: Rp ${report.summary.revenue.toLocaleString("id-ID")}`, 15, 45);
  doc.text(`HPP: Rp ${report.summary.itemCost.toLocaleString("id-ID")}`, 15, 52);
  doc.text(`Laba kotor: Rp ${report.summary.grossProfit.toLocaleString("id-ID")}`, 15, 59);
  doc.text("Tanggal                 Transaksi              Penjualan", 15, 72);
  report.daily.slice(0, 35).forEach((row, index) => {
    doc.text(`${row._id}                    ${row.orders}                    Rp ${row.revenue.toLocaleString("id-ID")}`, 15, 80 + index * 6);
  });
  doc.save(`laporan-penjualan-${report.from}-${report.to}.pdf`);
}
