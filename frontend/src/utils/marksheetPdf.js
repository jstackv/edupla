/**
 * marksheetPdf.js — the Edupla mark sheet.
 *
 * A clean, branded A4 sheet with exactly four columns — No, Names, Score and
 * % — plus a small summary strip. Deliberately no emails, dates or times.
 * Uses the same masthead as the other Edupla PDFs (dark band, "E" badge,
 * EDU·PLA wordmark).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const pctOf = (score, max) => (max > 0 ? (score / max) * 100 : 0);
const fmtNum = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
const fmtPct = (p) => `${Number.isInteger(Math.round(p * 10) / 10) ? Math.round(p * 10) / 10 : (Math.round(p * 10) / 10).toFixed(1)}%`;

// Pass-band colours, shared by the % text and its little bar.
const bandOf = (p) => (p >= 70 ? [5, 150, 105] : p >= 50 ? [217, 119, 6] : [220, 38, 38]);

/**
 * @param {object}  o
 * @param {string}  o.title        task title
 * @param {string}  o.className
 * @param {string}  [o.subtitle]   e.g. module name
 * @param {string}  [o.kindLabel]  e.g. "Individual Assignment"
 * @param {number}  o.maxScore
 * @param {{name:string, score:(number|null)}[]} o.rows   already in the order to print
 * @param {string}  [o.teacherName]
 * @param {boolean} [o.dark]
 */
export function exportMarksheetPdf({ title, className, subtitle, kindLabel = 'Mark Sheet', maxScore, rows, teacherName, dark = false }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;
  const HEAD_H = 138;
  const max = maxScore || 100;

  const P = dark
    ? { page: [15, 15, 15], row: [24, 24, 24], rowAlt: [30, 30, 30], line: [52, 52, 52], border: [92, 84, 78], text: [238, 238, 238], muted: [140, 134, 128], no: [194, 98, 28], card: [26, 26, 26] }
    : { page: [255, 255, 255], row: [255, 255, 255], rowAlt: [252, 247, 243], line: [236, 222, 212], border: [196, 170, 152], text: [38, 30, 26], muted: [120, 110, 102], no: [194, 65, 12], card: [251, 247, 243] };

  const graded = rows.filter(r => Number.isFinite(r.score));
  const pcts = graded.map(r => pctOf(r.score, max));
  const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
  const top = pcts.length ? Math.max(...pcts) : null;

  const paintPage = () => { doc.setFillColor(...P.page); doc.rect(0, 0, W, H, 'F'); };

  const wordmark = (x, y, size) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(255, 255, 255);
    doc.text('EDU', x, y);
    const w = doc.getTextWidth('EDU');
    doc.setTextColor(251, 146, 60);
    doc.text('PLA', x + w, y);
  };

  const masthead = () => {
    doc.setFillColor(20, 10, 6);
    doc.rect(0, 0, W, HEAD_H, 'F');
    doc.setFillColor(194, 65, 12);
    doc.rect(0, 0, 7, HEAD_H, 'F');
    doc.setFillColor(124, 45, 18);
    doc.rect(0, HEAD_H - 4, W, 4, 'F');

    doc.setFillColor(194, 65, 12);
    doc.roundedRect(M, 20, 40, 40, 11, 11, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text('E', M + 20, 46, { align: 'center' });
    wordmark(M + 52, 38, 21);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setCharSpace(1.6);
    doc.setTextColor(196, 158, 133);
    doc.text('EDUCATION MANAGEMENT PLATFORM', M + 52, 49);
    doc.setCharSpace(0);

    // right-aligned pill
    const label = kindLabel.toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    // jsPDF's getTextWidth ignores letter-spacing, so add it by hand.
    const SPACING = 1.2;
    doc.setCharSpace(0);
    const lw = doc.getTextWidth(label) + SPACING * (label.length - 1) + 28;
    doc.setFillColor(194, 65, 12);
    doc.roundedRect(W - M - lw, 28, lw, 22, 11, 11, 'F');
    doc.setCharSpace(SPACING);
    doc.setTextColor(255, 255, 255);
    doc.text(label, W - M - lw + 14, 42);
    doc.setCharSpace(0);

    doc.setDrawColor(80, 45, 28);
    doc.setLineWidth(0.75);
    doc.line(M, 68, W - M, 68);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(251, 146, 60);
    doc.setCharSpace(1.4);
    doc.text('MARK SHEET', M, 87);
    doc.setCharSpace(0);

    doc.setFontSize(19);
    doc.setTextColor(255, 255, 255);
    const titleLines = doc.splitTextToSize(title, W - M * 2);
    doc.text(titleLines[0] + (titleLines.length > 1 ? '…' : ''), M, 109);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(255, 214, 178);
    const meta = [className, subtitle, `Out of ${fmtNum(max)}`, teacherName ? `Teacher: ${teacherName}` : null].filter(Boolean).join('   -   ');
    doc.text(meta, M, 126, { maxWidth: W - M * 2 });
  };

  const stats = () => {
    const items = [
      ['Students', String(rows.length)],
      ['Graded', `${graded.length}`],
      ['Average', avg === null ? '—' : fmtPct(avg)],
      ['Highest', top === null ? '—' : fmtPct(top)],
    ];
    const gap = 10;
    const w = (W - M * 2 - gap * (items.length - 1)) / items.length;
    const y = HEAD_H + 16;
    items.forEach(([label, value], i) => {
      const x = M + i * (w + gap);
      doc.setFillColor(...P.card);
      doc.setDrawColor(...P.line);
      doc.setLineWidth(0.75);
      doc.roundedRect(x, y, w, 46, 9, 9, 'FD');
      doc.setFillColor(194, 65, 12);
      doc.roundedRect(x, y + 10, 3.5, 26, 1.75, 1.75, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...P.no);
      doc.text(value, x + 16, y + 26);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...P.muted);
      doc.text(label.toUpperCase(), x + 16, y + 38);
    });
    return y + 46;
  };

  let firstPageBottom = HEAD_H + 16 + 46;

  const body = rows.map((r, i) => {
    const has = Number.isFinite(r.score);
    return [
      String(i + 1),
      r.name || '—',
      has ? `${fmtNum(r.score)} / ${fmtNum(max)}` : '—',
      has ? fmtPct(pctOf(r.score, max)) : '—',
      has ? pctOf(r.score, max) : null, // hidden helper for the % bar
    ];
  });

  autoTable(doc, {
    head: [['No', 'Names', 'Score', '%']],
    body: body.map(r => r.slice(0, 4)),
    startY: firstPageBottom + 18,
    margin: { left: M, right: M, top: 60, bottom: 46 },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10.5, cellPadding: { top: 7, bottom: 7, left: 10, right: 10 }, textColor: P.text, lineColor: P.border, lineWidth: 0.7, valign: 'middle' },
    headStyles: { fillColor: [194, 65, 12], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9.5, lineColor: [140, 48, 10], lineWidth: 0.7, cellPadding: { top: 9, bottom: 9, left: 10, right: 10 } },
    alternateRowStyles: { fillColor: P.rowAlt },
    bodyStyles: { fillColor: P.row },
    columnStyles: {
      0: { cellWidth: 42, halign: 'center', textColor: P.no, fontStyle: 'bold' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 92, halign: 'center' },
      3: { cellWidth: 118, halign: 'left' },
    },
    willDrawPage: ({ pageNumber }) => {
      paintPage();
      if (pageNumber === 1) { masthead(); stats(); }
      else {
        // slim running header on continuation pages
        doc.setFillColor(20, 10, 6);
        doc.rect(0, 0, W, 38, 'F');
        doc.setFillColor(194, 65, 12);
        doc.rect(0, 0, 7, 38, 'F');
        wordmark(M, 24, 13);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(255, 214, 178);
        doc.text(title, W - M, 24, { align: 'right', maxWidth: W - M * 2 - 90 });
      }
    },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      const raw = body[d.row.index];
      if (d.column.index === 3 && raw[4] !== null) {
        d.cell.styles.textColor = bandOf(raw[4]);
        d.cell.styles.fontStyle = 'bold';
      }
      if (d.column.index >= 2 && raw[4] === null) d.cell.styles.textColor = P.muted;
      if (d.column.index === 3) d.cell.styles.cellPadding = { top: 7, bottom: 7, left: 10, right: 10 };
    },
    // Thin coloured bar under each percentage.
    didDrawCell: (d) => {
      if (d.section !== 'body' || d.column.index !== 3) return;
      const raw = body[d.row.index];
      if (raw[4] === null) return;
      const bw = d.cell.width - 20;
      const bx = d.cell.x + 10;
      const by = d.cell.y + d.cell.height - 7;
      doc.setFillColor(...P.line);
      doc.roundedRect(bx, by, bw, 2.5, 1.25, 1.25, 'F');
      doc.setFillColor(...bandOf(raw[4]));
      doc.roundedRect(bx, by, Math.max(2.5, (bw * Math.min(raw[4], 100)) / 100), 2.5, 1.25, 1.25, 'F');
    },
  });

  // ── Signature line after the table (kept together with the last rows) ──
  let y = doc.lastAutoTable.finalY + 46;
  if (y > H - 80) { doc.addPage(); paintPage(); y = 90; }
  doc.setDrawColor(...P.muted);
  doc.setLineWidth(0.6);
  doc.line(W - M - 190, y, W - M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...P.muted);
  doc.text(teacherName ? `${teacherName} — Teacher's signature` : "Teacher's signature", W - M, y + 13, { align: 'right' });

  // ── Footer on every page ──
  const total = doc.internal.getNumberOfPages();
  for (let pg = 1; pg <= total; pg++) {
    doc.setPage(pg);
    doc.setDrawColor(...P.line);
    doc.setLineWidth(0.6);
    doc.line(M, H - 34, W - M, H - 34);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(194, 65, 12);
    doc.text('EDUPLA', M, H - 20);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...P.muted);
    doc.text('Mark sheet', M + 42, H - 20);
    doc.text(`Page ${pg} of ${total}`, W - M, H - 20, { align: 'right' });
  }

  const safe = String(title).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  doc.save(`${safe || 'Mark sheet'} - Mark sheet.pdf`);
}