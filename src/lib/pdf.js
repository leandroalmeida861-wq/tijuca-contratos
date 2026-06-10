import { jsPDF } from 'jspdf';

export function exportSimplePdf({ title, subtitle, fileName, columns, rows, totals = [] }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  const usableWidth = pageWidth - margin * 2;
  const colWidth = usableWidth / columns.length;
  let y = 42;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(title, margin, y);
  y += 18;

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(subtitle, margin, y);
    y += 18;
  }

  totals.forEach((item) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${item.label}: ${item.value}`, margin, y);
    y += 14;
  });

  y += 8;
  drawHeader(doc, columns, margin, y, colWidth);
  y += 22;

  rows.forEach((row) => {
    if (y > 555) {
      doc.addPage();
      y = 42;
      drawHeader(doc, columns, margin, y, colWidth);
      y += 22;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    columns.forEach((column, index) => {
      const value = String(row[column.key] ?? '-');
      const lines = doc.splitTextToSize(value, colWidth - 8).slice(0, 2);
      doc.text(lines, margin + index * colWidth + 4, y);
    });
    y += 24;
  });

  doc.save(fileName);
}

function drawHeader(doc, columns, x, y, colWidth) {
  doc.setFillColor(31, 122, 69);
  doc.rect(x, y - 14, colWidth * columns.length, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  columns.forEach((column, index) => {
    doc.text(column.label, x + index * colWidth + 4, y);
  });
  doc.setTextColor(17, 24, 39);
}
