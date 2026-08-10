const { Course, Assessment, Mark, Class, User, AssessmentSubmission, AssessmentQuestion, AssessmentAttempt } = require('../models/db');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { createInAppNotification, createDirectNotification, getStudentEmails, getTeacherEmail } = require('../services/notificationHelpers');
const { notifyAssessmentShared } = require('../services/emailService');

/* ─────────────────────────────────────────────────────────
   Assessment title is derived from the assessment type.
   This is the single source of truth.
───────────────────────────────────────────────────────── */
const TYPE_TITLES = {
  FA: 'Formative Assessment',
  IA: 'Integrated Assessment',
  CA: 'Comprehensive Assessment',
};

// Competency decision (Rwandan CBT convention, mirrors the admin report):
// Specific modules pass at 70%, everything else passes at 50%.
function passingLineForCategory(category) {
  return category === 'Specific modules' ? 70 : 50;
}
function computeDecision(pct, category) {
  if (pct == null || Number.isNaN(pct)) return null;
  // Compare against the RAW (unrounded) percentage — rounding first can flip
  // a genuine 69.6% up to a displayed 70% and wrongly award Competent.
  return pct >= passingLineForCategory(category) ? 'C' : 'NYC';
}
// Raw (unrounded) percentage, used for the C/NYC decision itself.
function rawPercentage(obtained, max) {
  if (obtained == null || !max) return null;
  return (obtained / max) * 100;
}
// Scale a score earned out of fromMax onto a different total (the module
// weight), e.g. 62/80 -> ~100.6/130. Null if nothing sensible to scale.
function scaleScore(obtained, fromMax, toMax) {
  if (obtained == null || !fromMax) return null;
  return Math.round((obtained / fromMax) * toMax * 100) / 100;
}

// Builds a safe, readable download filename in the "<module> - <label>
// marks.<ext>" shape (e.g. "WEB DEVELOPMENT USING PHP - Formative
// Assessment 1 marks.xlsx"). Strips characters that are invalid in
// filenames (/ \ : * ? " < > |) while keeping spaces and punctuation.
function buildMarksFilename(moduleName, label, ext) {
  const clean = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
  return `${clean(moduleName)} - ${clean(label)} marks.${ext}`;
}

// A student's effective attempt cap: the class-wide max_attempts, unless
// they have a per-student override (granted via "Add attempt" -> specific
// students) that goes higher — never lower, so an override can only ever
// give extra attempts, not take them away.
function effectiveMaxAttempts(assessment, studentId) {
  const base = assessment.max_attempts || 1;
  const overrides = assessment.attempt_overrides || [];
  const mine = overrides.find(o => o.student_id?.toString() === studentId?.toString());
  return mine ? Math.max(base, mine.max_attempts) : base;
}

/* ═══════════════════════ Shared PDF mark-sheet styling ═══════════════════
   Both the single-assessment and the "Overall" mark sheets render through
   these three helpers so they share one consistent, polished look: a
   gradient title banner, a row of stat chips, and a bordered/zebra-striped
   table that redraws its header on every new page. ═══════════════════════ */

// "Formative Assessment 2" -> "FA2"; "Comprehensive Assessment" -> "CA1"
// (untitled/first-in-series assessments default to 1, mirroring the same
// shorthand used in the Overall results UI).
function shorthandTitle(title) {
  if (!title) return '';
  const match = title.trim().match(/^(.*?)\s*(\d+)?$/);
  const base = (match?.[1] || title).trim();
  const num = match?.[2] || '1';
  const initials = base.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase();
  return `${initials}${num}`;
}

const PDF_THEME = {
  gradientFrom: '#0b4f49',
  gradientTo: '#082e2a',
  bannerDark: '#01140f',
  subtitleBand: '#062621',
  gold: '#d4af37',
  goldSoft: '#f4e4b8',
  headerBg: '#f0fdfa',
  headerBorder: '#0b4f49',
  headerText: '#0b4f49',
  rowBorder: '#475569',
  zebra: '#f8fafc',
  text: '#1e293b',
  textMuted: '#64748b',
  pass: '#10b981',
  passBg: '#d1fae5',
  fail: '#ef4444',
  failBg: '#fee2e2',
};

// Three-band title banner spanning the full page width — a gradient teal
// title band, a darker teal subtitle band, and a thin gold accent line
// closing it off. Pairs with pdfDrawFooter, which carries the EDUPLA
// wordmark and generation timestamp at the bottom of every page instead.
function pdfDrawBanner(doc, { title, subtitle }) {
  const pageWidth = doc.page.width;
  const titleH = 34;
  const subtitleH = subtitle ? 18 : 0;
  const accentH = 3;
  let y = 0;

  // ── Gradient title band ──
  const grad = doc.linearGradient(0, y, pageWidth, y);
  grad.stop(0, PDF_THEME.gradientFrom).stop(1, PDF_THEME.gradientTo);
  doc.rect(0, y, pageWidth, titleH).fill(grad);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(17)
    .text(title, 0, y + titleH / 2 - 8, { width: pageWidth, align: 'center' });
  y += titleH;

  // ── Subtitle band ──
  if (subtitle) {
    doc.rect(0, y, pageWidth, subtitleH).fill(PDF_THEME.subtitleBand);
    doc.font('Helvetica-Oblique').fontSize(9.5).fillColor('#e6fffa')
      .text(subtitle, 0, y + subtitleH / 2 - 5, { width: pageWidth, align: 'center' });
    y += subtitleH;
  }

  // ── Gold accent line ──
  const goldGrad = doc.linearGradient(0, y, pageWidth, y);
  goldGrad.stop(0, PDF_THEME.gold).stop(1, PDF_THEME.goldSoft);
  doc.rect(0, y, pageWidth, accentH).fill(goldGrad);
  y += accentH;

  doc.fillColor('#000000');
  doc.y = y + 14;
}

// Small centered footer stamped on every page — "Generated at <date> with
// EDUPLA - School Management Platform" — carrying the brand mark that used
// to live in the banner's top strip. Must be called ONCE, after all pages
// are drawn but before doc.end(), and the PDFDocument must have been
// created with { bufferPages: true } so every already-rendered page can be
// revisited (PDFKit streams pages out as they're finished otherwise).
function pdfDrawFooter(doc, { generatedAt }) {
  const range = doc.bufferedPageRange();
  const label = `Generated at ${generatedAt} with EDUPLA - School Management Platform`;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const pageWidth = doc.page.width;
    const bottomMargin = doc.page.margins.bottom;
    const y = doc.page.height - bottomMargin + 12;
    // Placing text below the normal bottom margin would otherwise make
    // PDFKit think the content overflowed and silently start a new page
    // — zeroing the margin for this one draw call is the standard trick
    // to write into that reserved footer strip without triggering that.
    doc.page.margins.bottom = 0;
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(PDF_THEME.textMuted)
      .text(label, 0, y, { width: pageWidth, align: 'center', lineBreak: false });
    doc.page.margins.bottom = bottomMargin;
  }
  doc.fillColor('#000000');
}

// A centered row of bordered stat cards (Students / Class average / Passed
// / Failed / …) — a lightly tinted body, a crisp colored outline, and a
// solid accent bar across the top, echoing the summary stat cards used in
// the teacher's mark-sheet UI.
function pdfDrawStatChips(doc, chips) {
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 12;
  const chipWidth = Math.min(140, (usableWidth - gap * (chips.length - 1)) / chips.length);
  const totalWidth = chipWidth * chips.length + gap * (chips.length - 1);
  const startX = doc.page.margins.left + (usableWidth - totalWidth) / 2;
  const chipHeight = 48;
  const radius = 10;
  const y = doc.y;

  // Small hand-drawn icon inside a solid color badge — check/cross/dot,
  // picked automatically from the chip's label so call sites don't need
  // to change (Helvetica's AFM font doesn't support ✓/✕ glyphs reliably,
  // so these are drawn as paths instead of text).
  const drawIcon = (cx, cy, r, color, kind) => {
    doc.circle(cx, cy, r).fill(color);
    doc.strokeColor('#ffffff').lineWidth(1.6).lineCap('round').lineJoin('round');
    if (kind === 'pass') {
      doc.moveTo(cx - r * 0.45, cy).lineTo(cx - r * 0.1, cy + r * 0.4).lineTo(cx + r * 0.5, cy - r * 0.4).stroke();
    } else if (kind === 'fail') {
      doc.moveTo(cx - r * 0.4, cy - r * 0.4).lineTo(cx + r * 0.4, cy + r * 0.4).stroke();
      doc.moveTo(cx + r * 0.4, cy - r * 0.4).lineTo(cx - r * 0.4, cy + r * 0.4).stroke();
    } else {
      doc.circle(cx, cy, r * 0.32).fill('#ffffff');
    }
    doc.strokeColor('#000000');
  };

  chips.forEach((chip, i) => {
    const x = startX + i * (chipWidth + gap);

    // Soft drop shadow behind the card
    doc.fillOpacity(0.08);
    doc.roundedRect(x + 1.2, y + 2.2, chipWidth, chipHeight, radius).fill('#0f172a');
    doc.fillOpacity(1);

    // Card body — white with a faint gradient wash of the chip's color
    const bodyGrad = doc.linearGradient(x, y, x, y + chipHeight);
    bodyGrad.stop(0, '#ffffff', 1).stop(1, chip.color, 0.07);
    doc.roundedRect(x, y, chipWidth, chipHeight, radius).fill(bodyGrad);

    // Crisp border
    doc.lineWidth(1).strokeColor(chip.color).strokeOpacity(0.4);
    doc.roundedRect(x, y, chipWidth, chipHeight, radius).stroke();
    doc.strokeOpacity(1);

    // Icon badge on the left
    const kind = /pass/i.test(chip.label) ? 'pass' : /fail/i.test(chip.label) ? 'fail' : 'dot';
    const iconR = 9;
    const iconCx = x + 17;
    const iconCy = y + chipHeight / 2;
    drawIcon(iconCx, iconCy, iconR, chip.color, kind);

    // Value + label, right of the icon
    const textX = iconCx + iconR + 8;
    const textW = x + chipWidth - textX - 8;
    doc.font('Helvetica-Bold').fontSize(15).fillColor(chip.color)
      .text(String(chip.value), textX, y + 9, { width: textW, align: 'left' });
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor(PDF_THEME.textMuted)
      .text(chip.label.toUpperCase(), textX, y + 28, { width: textW, align: 'left', characterSpacing: 0.5, ellipsis: true });
  });

  doc.fillColor('#000000').strokeColor('#000000');
  doc.y = y + chipHeight + 20;
}

/* Bordered, zebra-striped mark-sheet table with a repeating header on every
   new page. `cols` is [{ label, width, align }]; `rows` is an array of
   `{ cells: [...], colors: { colIndex: hex }, badges: { colIndex: hex } }`
   — `badges` draws that cell's text inside a small rounded pill instead of
   plain text (used for the Decision column). */
function pdfDrawTable(doc, { cols, rows, headerHeight = 24, rowHeight = 20 }) {
  const startX = doc.page.margins.left;
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  let y = doc.y;

  const colX = [];
  { let x = startX; cols.forEach(c => { colX.push(x); x += c.width; }); }

  // All fills happen first, all grid lines are stroked afterward in one pass
  // per page — interleaving fill-then-stroke-then-fill (as before) let a
  // row's zebra background occasionally paint back over the border line
  // directly above it, making that one boundary look thinner/thicker than
  // its neighbors. Drawing every line only after every fill on that page is
  // done removes that inconsistency entirely.
  let segment = null; // { top, headerBottom, bottom }
  let rowBottoms = [];

  const finishSegment = () => {
    if (!segment) return;
    doc.lineWidth(1.25).strokeColor(PDF_THEME.rowBorder);
    colX.forEach(x => doc.moveTo(x, segment.top).lineTo(x, segment.bottom).stroke());
    doc.moveTo(startX + tableWidth, segment.top).lineTo(startX + tableWidth, segment.bottom).stroke();
    rowBottoms.slice(0, -1).forEach(ry => {
      doc.moveTo(startX, ry).lineTo(startX + tableWidth, ry).stroke();
    });

    doc.lineWidth(1.5).strokeColor(PDF_THEME.headerBorder);
    doc.moveTo(startX, segment.top).lineTo(startX + tableWidth, segment.top).stroke();
    doc.moveTo(startX, segment.headerBottom).lineTo(startX + tableWidth, segment.headerBottom).stroke();
    doc.moveTo(startX, segment.bottom).lineTo(startX + tableWidth, segment.bottom).stroke();
    doc.moveTo(startX, segment.top).lineTo(startX, segment.bottom).stroke();
    doc.moveTo(startX + tableWidth, segment.top).lineTo(startX + tableWidth, segment.bottom).stroke();

    rowBottoms = [];
  };

  const drawHeader = () => {
    doc.rect(startX, y, tableWidth, headerHeight).fill(PDF_THEME.headerBg);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_THEME.headerText);
    cols.forEach((c, i) => {
      doc.text(c.label, colX[i] + 5, y + headerHeight / 2 - 4, { width: c.width - 8, align: c.align || 'left' });
    });
    doc.fillColor('#000000');
    const top = y;
    y += headerHeight;
    segment = { top, headerBottom: y, bottom: y };
  };

  drawHeader();

  rows.forEach((r, i) => {
    if (y + rowHeight > pageBottom) {
      segment.bottom = y;
      finishSegment();
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
    }
    if (i % 2 === 1) doc.rect(startX, y, tableWidth, rowHeight).fill(PDF_THEME.zebra);

    doc.font('Helvetica').fontSize(8.5);
    r.cells.forEach((val, ci) => {
      const c = cols[ci];
      const color = r.colors?.[ci] || PDF_THEME.text;
      const badgeColor = r.badges?.[ci];
      if (badgeColor && val !== '—' && val !== '') {
        const textW = doc.widthOfString(String(val));
        const pillW = Math.min(c.width - 10, textW + 14);
        const pillX = colX[ci] + (c.width - pillW) / 2;
        doc.fillOpacity(0.15).fillColor(badgeColor);
        doc.roundedRect(pillX, y + 3, pillW, rowHeight - 6, 6).fill();
        doc.fillOpacity(1);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(badgeColor)
          .text(String(val), pillX, y + rowHeight / 2 - 4, { width: pillW, align: 'center' });
        doc.font('Helvetica').fontSize(8.5);
      } else {
        doc.fillColor(color)
          .text(String(val ?? ''), colX[ci] + 5, y + rowHeight / 2 - 4.5, { width: c.width - 8, align: c.align || 'left', ellipsis: true });
      }
    });
    doc.fillColor('#000000');
    y += rowHeight;
    rowBottoms.push(y);
    segment.bottom = y;
  });

  finishSegment();
  doc.y = y + 10;
}

/* ═══════════════════════════════════════════════════════════════════
   Shared "advanced" Excel report theme — used by the mark-sheet exports
   (teacherDownloadOverallExcel / teacherDownloadAttemptsExcel). Mirrors
   the violet/indigo brand used in the PDF exports and the app UI, dressed
   up with a gradient hero banner, stat cards, a frozen zebra-striped
   table and colored decision/performance badges — built with ExcelJS
   (unlike the plain `xlsx` package, it supports real cell styling).
═══════════════════════════════════════════════════════════════════ */
const XL_THEME = {
  midnight: 'FF0B0B12',
  violet: 'FF4F46E5',
  indigo: 'FF7C3AED',
  indigoSoft: 'FF3730A3',
  gold: 'FFD4AF37',
  goldSoft: 'FFF4E4B8',
  headerBg: 'FFEEF2FF',
  headerText: 'FF3730A3',
  border: 'FFE2E8F0',
  textDark: 'FF1E293B',
  textMuted: 'FF64748B',
  stripe: 'FFF8FAFC',
  white: 'FFFFFFFF',
  pass: 'FF047857',
  passBg: 'FFD1FAE5',
  fail: 'FFB91C1C',
  failBg: 'FFFEE2E2',
  needs: 'FFB45309',
  needsBg: 'FFFEF3C7',
  muted: 'FF9CA3AF',
  mutedBg: 'FFF1F5F9',
};

// Same performance-color scale used by the frontend's `perfColor()`.
function xlPerfColor(pct) {
  if (pct == null) return XL_THEME.textMuted;
  if (pct >= 80) return 'FF059669';
  if (pct >= 60) return 'FF4F46E5';
  if (pct >= 40) return 'FFD97706';
  return 'FFDC2626';
}

// Splits `colCount` columns into `n` near-equal contiguous ranges, e.g.
// distributing stat cards evenly across however many columns the table
// ends up with (which varies with the number of assessments).
function xlDistributeRanges(colCount, n) {
  const base = Math.floor(colCount / n);
  const rem = colCount % n;
  const ranges = [];
  let start = 1;
  for (let i = 0; i < n; i++) {
    const size = Math.max(1, base + (i < rem ? 1 : 0));
    ranges.push([start, start + size - 1]);
    start += size;
  }
  return ranges;
}

// Draws the four-row brand banner (brand strip, gradient hero title,
// subtitle, gold accent line) spanning every column, and returns the
// next free row index.
function xlDrawBanner(ws, { title, subtitle }, colCount) {
  let row = 1;

  ws.mergeCells(row, 1, row, colCount);
  const brandCell = ws.getCell(row, 1);
  brandCell.value = {
    richText: [
      { font: { name: 'Calibri', size: 11, color: { argb: XL_THEME.gold } }, text: '  ◆  ' },
      { font: { name: 'Calibri', size: 12, bold: true, color: { argb: XL_THEME.gold } }, text: 'E D U P L A' },
      { font: { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFC9C9C9' } }, text: '   ·   School Management Platform' },
    ],
  };
  brandCell.alignment = { vertical: 'middle', horizontal: 'left' };
  brandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_THEME.midnight } };
  ws.getRow(row).height = 22;
  row++;

  ws.mergeCells(row, 1, row, colCount);
  const titleCell = ws.getCell(row, 1);
  titleCell.value = `  ${title}`;
  titleCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: XL_THEME.white } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'gradient', gradient: 'angle', degree: 0, stops: [{ position: 0, color: { argb: XL_THEME.violet } }, { position: 1, color: { argb: XL_THEME.indigo } }] };
  ws.getRow(row).height = 36;
  row++;

  ws.mergeCells(row, 1, row, colCount);
  const subtitleCell = ws.getCell(row, 1);
  subtitleCell.value = `  ${subtitle}`;
  subtitleCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: XL_THEME.white } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_THEME.indigoSoft } };
  ws.getRow(row).height = 22;
  row++;

  ws.mergeCells(row, 1, row, colCount);
  ws.getCell(row, 1).fill = { type: 'gradient', gradient: 'angle', degree: 0, stops: [{ position: 0, color: { argb: XL_THEME.gold } }, { position: 1, color: { argb: XL_THEME.goldSoft } }] };
  ws.getRow(row).height = 4;
  row++;

  ws.getRow(row).height = 10; // spacer
  row++;

  return row;
}

// Draws a row of colored "stat cards" (value + label) spread evenly
// across the sheet's columns, and returns the next free row index.
function xlDrawStatChips(ws, startRow, chips, colCount) {
  const ranges = xlDistributeRanges(colCount, chips.length);
  const valueRow = startRow;
  const labelRow = startRow + 1;

  chips.forEach((chip, i) => {
    const [from, to] = ranges[i];
    [valueRow, labelRow].forEach(r => { if (to > from) ws.mergeCells(r, from, r, to); });

    const vCell = ws.getCell(valueRow, from);
    vCell.value = chip.value;
    vCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: chip.color } };
    vCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: chip.bg } };
    vCell.border = { top: { style: 'thin', color: { argb: chip.bg } }, left: { style: 'thin', color: { argb: chip.bg } }, right: { style: 'thin', color: { argb: chip.bg } } };

    const lCell = ws.getCell(labelRow, from);
    lCell.value = chip.label;
    lCell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: XL_THEME.textMuted } };
    lCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: chip.bg } };
    lCell.border = { left: { style: 'thin', color: { argb: chip.bg } }, right: { style: 'thin', color: { argb: chip.bg } }, bottom: { style: 'thin', color: { argb: chip.bg } } };
  });

  ws.getRow(valueRow).height = 22;
  ws.getRow(labelRow).height = 15;
  ws.getRow(labelRow + 1).height = 10; // spacer
  return labelRow + 2;
}

// Styles a "Decision"/status cell as a small colored pill (fill + bold
// colored text), matching the badges used throughout the app UI.
function xlStyleBadgeCell(cell, { text, color, bg }) {
  cell.value = text;
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: color } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
}

/* ─────────────────────────────────────────────────────────
   Helper: normalise class_ids from the request body.
   Accepts:
     • class_ids: ['id1', 'id2']          (new multi-class UI)
     • class_id:  'id1'                   (legacy single-class)
     • class_ids: []  / class_id: ''      → empty array (no class)
   Always returns a plain array of non-empty strings.
───────────────────────────────────────────────────────── */
function resolveClassIds(body) {
  const { class_ids, class_id } = body;

  if (Array.isArray(class_ids) && class_ids.length > 0) {
    return class_ids.filter(Boolean);          // trust the new multi-class payload
  }

  if (class_id) return [class_id];             // legacy single value

  return [];                                   // nothing assigned
}

/* ═══════════════════════════════════════════════════
   ADMIN — COURSE MANAGEMENT
═══════════════════════════════════════════════════ */

exports.adminGetCourses = async (req, res) => {
  try {
    const courses = await Course.find({ created_by: req.user.id })
      /*
       * Populate both fields so the frontend can use whichever it finds:
       *   course.class_ids  → array of populated class objects  (new)
       *   course.class_id   → single populated class object     (legacy)
       */
      .populate('class_ids', 'name')
      .populate('class_id',  'name')
      .populate('teacher_id', 'name email')
      .sort({ created_at: -1 })
      .lean();

    res.json({ courses: courses.map(c => ({ ...c, id: c._id })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminCreateCourse = async (req, res) => {
  try {
    const { name, description, code, teacher_id, total_marks, category } = req.body;
    if (!name) return res.status(400).json({ message: 'Course name is required' });

    const classIds = resolveClassIds(req.body);

    const course = await Course.create({
      name:        name.trim(),
      code:        code?.trim()        || null,
      description: description?.trim() || null,
      total_marks: total_marks ? Number(total_marks) : 100,
      category:    category || 'Complementary modules',

      /* ── multi-class (new) ── */
      class_ids: classIds,

      /* ── legacy single-class: keep the first entry so old code still works ── */
      class_id: classIds[0] || null,

      teacher_id:  teacher_id || null,
      created_by:  req.user.id,
    });

    res.status(201).json({ message: 'Course created', id: course._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminUpdateCourse = async (req, res) => {
  try {
    const { name, code, description, teacher_id, total_marks, category } = req.body;
    const update = {};

    if (name        !== undefined) update.name        = name.trim();
    if (code        !== undefined) update.code        = code?.trim()        || null;
    if (description !== undefined) update.description = description?.trim() || null;
    if (total_marks !== undefined) update.total_marks = total_marks ? Number(total_marks) : 100;
    if (category    !== undefined) update.category    = category    || 'Complementary modules';
    if (teacher_id  !== undefined) update.teacher_id  = teacher_id  || null;

    /*
     * class_ids / class_id are only updated when the caller explicitly sends
     * at least one of them (so a PATCH that only changes the name won't
     * accidentally wipe the class assignment).
     */
    const hasClassPayload =
      Array.isArray(req.body.class_ids) || req.body.class_id !== undefined;

    if (hasClassPayload) {
      const classIds = resolveClassIds(req.body);
      update.class_ids = classIds;
      update.class_id  = classIds[0] || null;   // keep legacy field in sync
    }

    const course = await Course.findOneAndUpdate(
      { _id: req.params.id, created_by: req.user.id },
      update,
      { new: true }
    );

    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json({ message: 'Course updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminDeleteCourse = async (req, res) => {
  try {
    const course = await Course.findOneAndDelete({ _id: req.params.id, created_by: req.user.id });
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json({ message: 'Course deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════════════════════════════════
   ADMIN — REPORT VIEWING
═══════════════════════════════════════════════════ */

exports.adminStudentReport = async (req, res) => {
  try {
    const { term, year } = req.query;
    const studentId = new mongoose.Types.ObjectId(req.params.studentId);
    const student = await User.findById(studentId).select('name email level trade class_year').lean();
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const studentClass = await Class.findOne({ students: studentId })
      .select('name program_sector program_trade program_qualification_title program_rtqf_level students')
      .populate('students', '_id name')
      .lean();

    const assessmentFilter = {};
    if (studentClass) assessmentFilter.class_id = studentClass._id;
    if (term) assessmentFilter.term = term;
    if (year) assessmentFilter.academic_year = year;

    const assessments = await Assessment.find(assessmentFilter)
      .populate({ path: 'course_id', select: 'name code total_marks category' })
      .lean();

    const assessmentIds = assessments.map(a => a._id);

    /* ── All marks for all students in the class (for ranking) ── */
    const allClassStudentIds = (studentClass?.students || []).map(s => s._id);
    const allMarks = await Mark.find({
      assessment_id: { $in: assessmentIds },
      student_id: { $in: allClassStudentIds.length ? allClassStudentIds : [studentId] },
    }).lean();

    /* Build per-student mark totals for ranking within same filter */
    const studentTotalsMap = {};
    allMarks.forEach(m => {
      const sid = m.student_id.toString();
      if (!studentTotalsMap[sid]) studentTotalsMap[sid] = { obtained: 0, max: 0 };
      const a = assessments.find(x => x._id.toString() === m.assessment_id.toString());
      if (!a) return;
      if (m.approved_marks != null) {
        studentTotalsMap[sid].obtained += m.approved_marks;
        studentTotalsMap[sid].max      += a.max_marks;
      }
    });

    /* Rank: sort all students by percentage descending */
    const rankedStudents = Object.entries(studentTotalsMap)
      .map(([sid, { obtained, max }]) => ({
        sid,
        pct: max > 0 ? Math.round((obtained / max) * 100) : null,
      }))
      .filter(x => x.pct != null)
      .sort((a, b) => b.pct - a.pct);

    const myRankEntry = rankedStudents.find(x => x.sid === studentId.toString());
    const myRank = myRankEntry
      ? rankedStudents.findIndex(x => x.sid === studentId.toString()) + 1
      : null;

    /* Per-term ranks */
    const TERMS = ['Term 1', 'Term 2', 'Term 3'];
    const termRanks = {};
    for (const t of TERMS) {
      const termAssessments = assessments.filter(a => a.term === t);
      if (termAssessments.length === 0) continue;
      const termAssIds = termAssessments.map(a => a._id);

      const termMarks = allMarks.filter(m =>
        termAssIds.some(id => id.toString() === m.assessment_id.toString())
      );

      const termTotals = {};
      termMarks.forEach(m => {
        const sid = m.student_id.toString();
        if (!termTotals[sid]) termTotals[sid] = { obtained: 0, max: 0 };
        const a = termAssessments.find(x => x._id.toString() === m.assessment_id.toString());
        if (!a) return;
        if (m.approved_marks != null) {
          termTotals[sid].obtained += m.approved_marks;
          termTotals[sid].max      += a.max_marks;
        }
      });

      const ranked = Object.entries(termTotals)
        .map(([sid, { obtained, max }]) => ({ sid, pct: max > 0 ? Math.round((obtained / max) * 100) : null }))
        .filter(x => x.pct != null)
        .sort((a, b) => b.pct - a.pct);

      const myTermEntry = ranked.find(x => x.sid === studentId.toString());
      termRanks[t] = myTermEntry
        ? { rank: ranked.findIndex(x => x.sid === studentId.toString()) + 1, total: ranked.length }
        : null;
    }

    /* Marks for the requested student */
    const myMarks = await Mark.find({ student_id: studentId, assessment_id: { $in: assessmentIds } }).lean();
    const markMap = {};
    myMarks.forEach(m => { markMap[m.assessment_id.toString()] = m; });

    const reportData = assessments.map(a => ({
      assessment_id: a._id,
      title: a.title,
      course: a.course_id?.name || 'N/A',
      course_id: a.course_id?._id,
      course_code: a.course_id?.code || '',
      course_total_marks: a.course_id?.total_marks || 100,
      course_category: a.course_id?.category || 'Complementary modules',
      type: a.type,
      term: a.term,
      year: a.academic_year,
      max_marks: a.max_marks,
      marks_obtained: markMap[a._id.toString()]?.approved_marks ?? null,
    }));

    res.json({
      student: { ...student, id: student._id, class_name: studentClass?.name || student.class_year || null },
      report: reportData,
      rank: myRank,
      total_students: rankedStudents.length,
      term_ranks: termRanks,
      program: {
        sector: studentClass?.program_sector || null,
        trade: studentClass?.program_trade || null,
        qualificationTitle: studentClass?.program_qualification_title || null,
        rtqfLevel: studentClass?.program_rtqf_level || null,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminAssessmentReport = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.assessmentId)
      .populate('course_id', 'name code total_marks category')
      .populate('class_id', 'name')
      .populate('teacher_id', 'name')
      .lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const marks = await Mark.find({ assessment_id: req.params.assessmentId })
      .populate('student_id', 'name email level trade')
      .lean();

    const reportData = marks.map(m => ({
      student_id: m.student_id?._id,
      student_name: m.student_id?.name,
      student_email: m.student_id?.email,
      marks_obtained: m.marks,
      max_marks: assessment.max_marks,
      percentage: m.marks != null ? Math.round((m.marks / assessment.max_marks) * 100) : null,
      grade: m.marks != null ? getGrade(m.marks, assessment.max_marks) : 'N/A',
    }));

    const sorted = [...reportData].filter(s => s.percentage != null).sort((a, b) => b.percentage - a.percentage);
    reportData.forEach(s => {
      if (s.percentage != null) {
        s.rank = sorted.findIndex(x => x.student_id?.toString() === s.student_id?.toString()) + 1;
        s.rank_percent = sorted.length > 0 ? Math.round(((sorted.length - s.rank + 1) / sorted.length) * 100) : null;
      }
    });

    res.json({ assessment: { ...assessment, id: assessment._id }, students: reportData });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminClassReport = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.classId)
      .populate('students', 'name email level trade')
      .populate('teacher_id', 'name email')
      .lean();
    if (!cls) return res.status(404).json({ message: 'Class not found' });

    const { term, year, studentIds } = req.query;

    /*
     * Find courses assigned to this class.
     * Support both the legacy single class_id field AND the new class_ids array.
     */
    const courses = await Course.find({
      created_by: req.user.id,
      $or: [
        { class_id:  req.params.classId },
        { class_ids: req.params.classId },
      ],
    }).lean();

    const courseIds = courses.map(c => c._id);

    /*
     * Scope to assessments belonging to THIS class specifically — a module
     * shared with other classes may have its own separate assessments there,
     * which must not bleed into this class's report.
     */
    const assessmentFilter = { course_id: { $in: courseIds }, class_id: req.params.classId };
    if (term) assessmentFilter.term = term;
    if (year) assessmentFilter.academic_year = year;

    const assessments = await Assessment.find(assessmentFilter)
      .populate('course_id', 'name code total_marks category')
      .lean();

    const assessmentIds = assessments.map(a => a._id);

    /* All marks for all class students across all assessments in filter */
    const allMarks = await Mark.find({ assessment_id: { $in: assessmentIds } }).lean();
    const markIndex = {};
    allMarks.forEach(m => {
      const key = m.student_id.toString() + '_' + m.assessment_id.toString();
      markIndex[key] = m;
    });

    /* ── Per-term ranking across ALL class students ── */
    const TERMS_ALL = ['Term 1', 'Term 2', 'Term 3'];
    const termRankMap = {};

    for (const t of TERMS_ALL) {
      const termAssessments = assessments.filter(a => a.term === t);
      if (termAssessments.length === 0) continue;

      const termTotals = cls.students.map(s => {
        let obtained = 0;
        let max = 0;
        termAssessments.forEach(a => {
          const key = s._id.toString() + '_' + a._id.toString();
          const m = markIndex[key];
          if (m?.approved_marks != null) {
            obtained += m.approved_marks;
            max      += a.max_marks;
          }
        });
        return { sid: s._id.toString(), obtained, max, pct: max > 0 ? Math.round((obtained / max) * 100) : null };
      });

      const ranked = [...termTotals]
        .filter(x => x.pct != null)
        .sort((a, b) => b.pct - a.pct);

      ranked.forEach((entry, idx) => {
        if (!termRankMap[entry.sid]) termRankMap[entry.sid] = {};
        termRankMap[entry.sid][t] = { rank: idx + 1, total: ranked.length };
      });
    }

    /* ── Filter to target students for the response ── */
    let targetStudents = cls.students;
    if (studentIds) {
      const ids = studentIds.split(',').filter(Boolean);
      if (ids.length > 0) targetStudents = cls.students.filter(s => ids.includes(s._id.toString()));
    }

    const students = targetStudents.map(s => {
      const studentMarks = assessments.map(a => {
        const key = s._id.toString() + '_' + a._id.toString();
        const mark = markIndex[key];
        return {
          assessment_id: a._id,
          assessment_title: a.title,
          course: a.course_id?.name,
          course_code: a.course_id?.code,
          course_total_marks: a.course_id?.total_marks || 100,
          course_category: a.course_id?.category || 'Complementary modules',
          type: a.type,
          term: a.term,
          marks: mark?.approved_marks ?? null,
          max_marks: a.max_marks,
        };
      });
      const scored = studentMarks.filter(m => m.marks != null);
      const totalObtained = scored.reduce((s, m) => s + m.marks, 0);
      const totalMax      = scored.reduce((s, m) => s + m.max_marks, 0);
      const percentage    = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : null;
      return {
        student_id: s._id, name: s.name, email: s.email, level: s.level, trade: s.trade,
        marks: studentMarks, total_obtained: totalObtained, total_max: totalMax, percentage,
        grade: totalMax > 0 ? getGrade(totalObtained, totalMax) : 'N/A',
        term_ranks: termRankMap[s._id.toString()] || {},
      };
    });

    /* ── Annual rank across ALL class students ── */
    const allStudentTotals = cls.students.map(s => {
      const scored = assessments.map(a => {
        const key = s._id.toString() + '_' + a._id.toString();
        const m = markIndex[key];
        return m?.approved_marks != null ? { marks: m.approved_marks, max: a.max_marks } : null;
      }).filter(Boolean);
      const totalObt = scored.reduce((acc, x) => acc + x.marks, 0);
      const totalMx  = scored.reduce((acc, x) => acc + x.max, 0);
      return {
        sid: s._id.toString(),
        pct: totalMx > 0 ? Math.round((totalObt / totalMx) * 100) : null,
      };
    });

    const annualRanked = [...allStudentTotals]
      .filter(x => x.pct != null)
      .sort((a, b) => b.pct - a.pct);

    students.forEach(s => {
      const idx = annualRanked.findIndex(x => x.sid === s.student_id.toString());
      s.rank = idx >= 0 ? idx + 1 : null;
      s.rank_total = annualRanked.length;
    });

    /*
     * Display order: ascending rank (rank 1 first). When a single term was
     * requested, order by that term's rank; otherwise use the overall/annual
     * rank. Students with no rank (no marks yet) are pushed to the end.
     */
    students.sort((a, b) => {
      const rankOf = (s) => (term ? s.term_ranks?.[term]?.rank : s.rank) ?? Infinity;
      return rankOf(a) - rankOf(b);
    });

    res.json({
      class: {
        id: cls._id, name: cls.name,
        teacher: cls.teacher_id ? { name: cls.teacher_id.name, email: cls.teacher_id.email } : null,
        program: {
          sector: cls.program_sector || null,
          trade: cls.program_trade || null,
          qualificationTitle: cls.program_qualification_title || null,
          rtqfLevel: cls.program_rtqf_level || null,
        },
      },
      assessments, courses, students,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════════════════════════════════
   TEACHER — ASSESSMENT MANAGEMENT
═══════════════════════════════════════════════════ */

exports.teacherGetCourses = async (req, res) => {
  try {
    const courses = await Course.find({ teacher_id: req.user.id, is_active: true })
      .populate('class_ids', 'name')
      .populate('class_id',  'name')
      .sort({ created_at: -1 })
      .lean();
    res.json({ courses: courses.map(c => ({ ...c, id: c._id })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherGetAssessments = async (req, res) => {
  try {
    const { course_id, class_id, mode } = req.query;
    const filter = { teacher_id: req.user.id };
    if (course_id) filter.course_id = course_id;
    if (class_id) filter.class_id = class_id;
    // Marks Recording and the independent online-Assessments page each only
    // ever see their own records. "marks" isn't just an explicit value here —
    // assessments created before the online-quiz feature (and this `mode`
    // field) existed have no `mode` stored at all, and Mongo's query engine
    // (unlike Mongoose's in-memory schema default) does NOT treat a missing
    // field as equal to 'marks'. $ne: 'quiz' matches mode:'marks', mode:null,
    // AND a missing field alike, so those legacy records aren't silently
    // hidden — quiz is the only mode that ever needs to be excluded here.
    filter.mode = mode === 'quiz' ? 'quiz' : { $ne: 'quiz' };

    const assessments = await Assessment.find(filter)
      .populate('course_id', 'name code class_id class_ids total_marks category')
      .populate('class_id', 'name')
      .sort({ created_at: -1 })
      .lean();

    const assessmentIds = assessments.map(a => a._id);
    const submissions = await AssessmentSubmission.find({ assessment_id: { $in: assessmentIds } }).lean();
    const subMap = {};
    submissions.forEach(s => { subMap[s.assessment_id.toString()] = s; });

    // ── Student attempt/submission activity, for the "X/Y submissions" badge
    // and the recent-submitters hover preview on each quiz-mode card. Only
    // counts real student attempts (AssessmentAttempt), never the teacher's
    // own marks-review submission tracked above — that's a separate concept.
    // One student can submit more than once (re-attempts) — only their most
    // recent submission counts, so results are sorted newest-first and the
    // first occurrence per student is kept.
    const attempts = await AssessmentAttempt.find(
      { assessment_id: { $in: assessmentIds }, status: { $in: ['submitted', 'graded'] }, voided: { $ne: true } },
      'assessment_id student_id auto_submitted submitted_at'
    ).sort({ submitted_at: -1 }).lean();

    const submitterStudentIds = [...new Set(attempts.map(a => a.student_id.toString()))];
    const submitterNames = {};
    (await User.find({ _id: { $in: submitterStudentIds } }, 'name').lean())
      .forEach(u => { submitterNames[u._id.toString()] = u.name; });

    const submittersByAssessment = {};
    attempts.forEach(a => {
      const aid = a.assessment_id.toString();
      const sid = a.student_id.toString();
      const bucket = submittersByAssessment[aid] || (submittersByAssessment[aid] = new Map());
      if (!bucket.has(sid)) {
        bucket.set(sid, {
          student_name: submitterNames[sid] || 'A student',
          auto_submitted: a.auto_submitted,
          submitted_at: a.submitted_at,
        });
      }
    });

    const enriched = await Promise.all(assessments.map(async a => {
      /*
       * Student/marked counts are scoped to THIS assessment's own class —
       * not every class the module happens to be assigned to.
       */
      let studentCount = 0;
      let markedCount  = 0;

      const classId = a.class_id?._id || a.class_id;
      if (classId) {
        const cls = await Class.findById(classId, 'students').lean();
        studentCount = cls?.students?.length || 0;
        markedCount  = await Mark.countDocuments({ assessment_id: a._id, marks: { $ne: null } });
      }

      const sub = subMap[a._id.toString()];
      const submitters = Array.from(submittersByAssessment[a._id.toString()]?.values() || [])
        .sort((x, y) => new Date(y.submitted_at) - new Date(x.submitted_at));

      return {
        ...a, id: a._id, student_count: studentCount, marked_count: markedCount,
        submission_status: sub?.status || 'draft',
        review_note: sub?.review_note || null,
        submitted_count: submitters.length,
        expired: a.expires_at ? new Date() > new Date(a.expires_at) : false,
        recent_submitters: submitters.slice(0, 5).map(s => ({
          name: s.student_name, auto_submitted: s.auto_submitted, submitted_at: s.submitted_at,
        })),
      };
    }));

    res.json({ assessments: enriched });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherCreateAssessment = async (req, res) => {
  try {
    const { course_id, class_id, type, term, academic_year, mode, title } = req.body;
    const assessmentMode = mode === 'quiz' ? 'quiz' : 'marks';

    if (!course_id || !class_id || !type || !term || !academic_year) {
      return res.status(400).json({ message: 'Class, module, type, term, and year are required' });
    }

    if (!TYPE_TITLES[type]) {
      return res.status(400).json({ message: `Invalid assessment type "${type}". Must be FA, IA, or CA.` });
    }

    const baseTitle = TYPE_TITLES[type];

    const course = await Course.findOne({ _id: course_id, teacher_id: req.user.id });
    if (!course) return res.status(403).json({ message: 'Course not assigned to you' });

    /* ── The selected class must actually be one of the classes this module is assigned to ── */
    const courseClassIds = (
      Array.isArray(course.class_ids) && course.class_ids.length > 0
        ? course.class_ids
        : course.class_id ? [course.class_id] : []
    ).map(String);
    if (!courseClassIds.includes(String(class_id))) {
      return res.status(400).json({ message: 'This module is not assigned to the selected class.' });
    }

    const courseWeight = course.total_marks || 100;
    /* Quiz-mode assessments no longer take a manually entered maximum — the
       max is derived automatically once the teacher builds the question
       paper (sum of each question's marks), and is kept ≤ the module weight
       by teacherSaveQuestions. It starts at 0 here and is filled in later. */

    /* ── Titles: a module/class/term/year can now hold MULTIPLE assessments
       of the same type (e.g. 2+ Formative Assessments), so the duplicate
       guard is scoped by TITLE, not by type alone. If the teacher doesn't
       supply a custom title, one is auto-generated by appending an ordinal
       to the type's base title ("Formative Assessment 2", "…3", etc.) so
       it never collides with an assessment that already exists. ── */
    const siblingCount = await Assessment.countDocuments({
      course_id, class_id, teacher_id: req.user.id, type, term, academic_year, mode: assessmentMode,
    });

    let finalTitle = (title || '').toString().trim();
    if (!finalTitle) {
      finalTitle = siblingCount === 0 ? baseTitle : `${baseTitle} ${siblingCount + 1}`;
    }

    /* ── Server-side duplicate guard — scoped to THIS class, mode AND title.
       A module assigned to several classes can have its own independent set
       of assessments per class; an assessment created for one class is never
       treated as already created for another. The manual "Marks Recording"
       assessment and an independent online-quiz assessment for the same
       module/class/term/year are two separate records (they live on two
       separate teacher pages), so mode is part of the duplicate check too. ── */
    const existing = await Assessment.findOne({
      course_id,
      class_id,
      teacher_id: req.user.id,
      term,
      academic_year,
      mode: assessmentMode,
      title: finalTitle,
    });
    if (existing) {
      const cls = await Class.findById(class_id).select('name').lean();
      return res.status(409).json({
        message: `An assessment titled "${finalTitle}" already exists for this module in ${term} ${academic_year}${cls ? ` (${cls.name})` : ''}. Give this one a different title.`,
      });
    }

    const assessment = await Assessment.create({
      title: finalTitle,
      course_id,
      class_id,
      teacher_id: req.user.id,
      type,
      term,
      academic_year,
      max_marks: assessmentMode === 'quiz' ? 0 : courseWeight,
      created_by: req.user.id,
      mode: assessmentMode,
    });

    res.status(201).json({ message: 'Assessment created', id: assessment._id });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An assessment with this title already exists for this module, class, term and year.' });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.teacherUpdateAssessment = async (req, res) => {
  try {
    const { type, term, academic_year, class_id, title } = req.body;

    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'total_marks class_id class_ids');
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    /* Once an assessment has been shared with students, its core details
       (type/term/year/class/title) are locked — editing them after students
       may already be attempting it could silently invalidate their progress
       or results. Unshare it first (which stops new attempts, but keeps
       existing ones) if these details genuinely need to change. Sharing
       settings themselves (duration, expiry, attempts, instructions) are
       edited separately via the Share modal / "Add attempt" action, which
       remain available even while shared. */
    if (assessment.is_shared) {
      return res.status(400).json({
        message: 'This assessment has already been shared, so its type, term, year, class and title are locked. Unshare it first if you need to change these details.',
      });
    }

    const update = {};
    if (type) {
      if (!TYPE_TITLES[type]) {
        return res.status(400).json({ message: `Invalid assessment type "${type}". Must be FA, IA, or CA.` });
      }
      update.type = type;
      // Only fall back to the auto title if the teacher isn't also setting
      // a custom one in this same request.
      if (!title) update.title = TYPE_TITLES[type];
    }
    if (title && title.toString().trim()) update.title = title.toString().trim();
    if (term) update.term = term;
    if (academic_year) update.academic_year = academic_year;

    /* If the class is being changed, make sure it's still one of the classes
       this module is assigned to. */
    if (class_id) {
      const courseClassIds = (
        Array.isArray(assessment.course_id?.class_ids) && assessment.course_id.class_ids.length > 0
          ? assessment.course_id.class_ids
          : assessment.course_id?.class_id ? [assessment.course_id.class_id] : []
      ).map(String);
      if (!courseClassIds.includes(String(class_id))) {
        return res.status(400).json({ message: 'This module is not assigned to the selected class.' });
      }
      update.class_id = class_id;
    }

    /* Server-side duplicate guard for edits — scoped to the (possibly new)
       class AND title, since a module/class/term/year can now legitimately
       hold several assessments of the same type as long as titles differ. */
    const checkTerm  = term          || assessment.term;
    const checkYear  = academic_year || assessment.academic_year;
    const checkClass = class_id      || assessment.class_id;
    const checkTitle = update.title  || assessment.title;
    const duplicate = await Assessment.findOne({
      _id: { $ne: req.params.id },
      course_id: assessment.course_id?._id || assessment.course_id,
      class_id: checkClass,
      teacher_id: req.user.id,
      term: checkTerm,
      academic_year: checkYear,
      mode: assessment.mode,
      title: checkTitle,
    });
    if (duplicate) {
      return res.status(409).json({
        message: `An assessment titled "${checkTitle}" already exists for this module/class in ${checkTerm} ${checkYear}. Give it a different title.`,
      });
    }

    if (assessment.mode !== 'quiz') {
      update.max_marks = assessment.course_id?.total_marks || assessment.max_marks || 100;
    }

    const updated = await Assessment.findOneAndUpdate(
      { _id: req.params.id, teacher_id: req.user.id },
      update, { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Assessment not found' });
    res.json({ message: 'Assessment updated' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An assessment with this title already exists for this module, class, term and year.' });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.teacherDeleteAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id });
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    // A teacher owns this assessment and may remove it at their own
    // discretion — online quiz attempts/results are a separate concern from
    // the Marks Recording feature (the `Mark` model), so neither recorded
    // marks nor recorded attempts should block deletion here. Everything
    // tied to the assessment is cascade-deleted along with it.
    await Assessment.deleteOne({ _id: req.params.id });
    await Mark.deleteMany({ assessment_id: req.params.id });
    await AssessmentSubmission.deleteOne({ assessment_id: req.params.id });
    await AssessmentQuestion.deleteMany({ assessment_id: req.params.id });
    await AssessmentAttempt.deleteMany({ assessment_id: req.params.id });
    res.json({ message: 'Assessment deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherGetMarks = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'name code class_id class_ids total_marks category')
      .populate('class_id', 'name')
      .lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    /*
     * Students come from THIS assessment's own class only — not every class
     * the module happens to be assigned to.
     */
    let students = [];
    const classId = assessment.class_id?._id || assessment.class_id;
    if (classId) {
      const cls = await Class.findById(classId)
        .populate('students', 'name email level trade')
        .lean();
      students = cls?.students || [];
    }

    const marks = await Mark.find({ assessment_id: req.params.id }).lean();
    const markMap = {};
    marks.forEach(m => { markMap[m.student_id.toString()] = m; });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.id }).lean();
    const status = submission?.status || 'draft';

    /*
     * Default marking order: ascending by student name (A→Z). This is the
     * order teachers see both in the on-screen marks table and in the
     * downloadable Excel template, before any marks have been entered.
     * Once marks are uploaded via Excel, the frontend re-sorts the table by
     * performance (marks obtained) — see teacherUploadMarks below.
     */
    const result = students
      .map(s => ({
        student_id: s._id,
        name: s.name,
        email: s.email,
        marks: markMap[s._id.toString()]?.marks ?? null,
        mark_id: markMap[s._id.toString()]?._id ?? null,
      }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    res.json({
      assessment: { ...assessment, id: assessment._id },
      students: result,
      submission: {
        status,
        submitted_at: submission?.submitted_at ?? null,
        reviewed_at:  submission?.reviewed_at  ?? null,
        review_note:  submission?.review_note  ?? null,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherSaveMarks = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'total_marks');
    if (!assessment) return res.status(403).json({ message: 'Access denied' });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.id });
    if (submission && (submission.status === 'submitted' || submission.status === 'approved')) {
      return res.status(403).json({ message: 'Marks are locked. This assessment has already been submitted for review.' });
    }

    const { marks } = req.body;
    if (!Array.isArray(marks)) return res.status(400).json({ message: 'marks must be an array' });

    const maxAllowed = assessment.course_id?.total_marks || assessment.max_marks || 100;
    const overLimit  = marks.filter(m => m.marks != null && Number(m.marks) > maxAllowed);
    if (overLimit.length > 0) {
      return res.status(400).json({
        message: `One or more marks exceed the maximum allowed (${maxAllowed}). Please correct them before saving.`,
      });
    }

    const ops = marks.map(m => ({
      updateOne: {
        filter: { assessment_id: req.params.id, student_id: m.student_id },
        update: { $set: { marks: m.marks, entered_by: req.user.id } },
        upsert: true,
      },
    }));

    if (ops.length > 0) await Mark.bulkWrite(ops);

    await AssessmentSubmission.findOneAndUpdate(
      { assessment_id: req.params.id },
      { $setOnInsert: { assessment_id: req.params.id, status: 'draft' } },
      { upsert: true }
    );

    res.json({ message: 'Marks saved as draft', status: 'draft' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════════════════════════════════
   TEACHER — EXCEL TEMPLATE DOWNLOAD / MARKS UPLOAD
═══════════════════════════════════════════════════ */

/*
 * Loads the assessment (scoped to this teacher), its class roster
 * (ascending by name), and any existing marks. Shared by the template
 * download and the upload handler so both always agree on which students
 * belong to this assessment and what the current marks are.
 */
async function loadAssessmentForExcel(req) {
  const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
    .populate('course_id', 'name code total_marks')
    .populate('class_id', 'name')
    .lean();
  if (!assessment) return null;

  let students = [];
  const classId = assessment.class_id?._id || assessment.class_id;
  if (classId) {
    const cls = await Class.findById(classId).populate('students', 'name email').lean();
    students = cls?.students || [];
  }
  students = [...students].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const marks = await Mark.find({ assessment_id: req.params.id }).lean();
  const markMap = {};
  marks.forEach(m => { markMap[m.student_id.toString()] = m; });

  return { assessment, students, markMap };
}

/*
 * GET /teacher/assessments/:id/marks/template
 * Streams an .xlsx workbook back to the teacher: one row per student
 * (ascending by name), pre-filled with any marks already recorded, plus a
 * hidden Student ID column used to match rows back up on upload — even if
 * the teacher reorders or resorts the sheet in Excel.
 */
exports.teacherDownloadMarksTemplate = async (req, res) => {
  try {
    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.id }).lean();
    if (submission && (submission.status === 'submitted' || submission.status === 'approved')) {
      return res.status(403).json({ message: 'Marks are locked. This assessment has already been submitted for review.' });
    }

    const data = await loadAssessmentForExcel(req);
    if (!data) return res.status(404).json({ message: 'Assessment not found' });
    const { assessment, students, markMap } = data;

    if (students.length === 0) {
      return res.status(400).json({ message: 'This assessment has no students to build a template for.' });
    }

    const maxMarks = assessment.course_id?.total_marks || assessment.max_marks || 100;
    const marksHeader = `Marks (out of ${maxMarks})`;

    /*
     * Column layout (Email intentionally dropped — the teacher typing
     * marks only needs to see who they're marking, not contact info):
     *   A  Student ID   — hidden, used only to match rows back on upload
     *   B  No.
     *   C  Student Name
     *   D  Marks (out of N)
     */
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Edupla';
    wb.created = new Date();

    const ws = wb.addWorksheet('Marks', {
      pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' },
    });

    ws.columns = [
      { key: 'id', width: 26 },
      { key: 'no', width: 11 },
      { key: 'name', width: 48 },
      { key: 'marks', width: 32 },
    ];

    // ── Palette — deep jewel violet/indigo with a metallic-gold accent,
    // a step up from the plain violet-to-indigo used before but still
    // clearly the same Edupla family. ─────────────────────────────────
    const MIDNIGHT    = 'FF060606'; // true neutral near-black — brand strip
    const VIOLET       = 'FF1E1E1E'; // charcoal grey, gradient start
    const INDIGO       = 'FF0A0A0A'; // near-black grey, gradient end
    const INDIGO_SOFT  = 'FF141414'; // subtitle band — matching grey family
    const GOLD          = 'FFD4AF37'; // metallic gold accent
    const GOLD_SOFT      = 'FFF4E4B8'; // pale gold accent strip
    const SOFT_BG      = 'FFF7F7F7'; // neutral pale grey — instructions / footer
    const STRIPE       = 'FFFCFCFC'; // near-white zebra stripe
    const BORDER       = 'FFE5E5E5';
    const TEXT_DARK    = 'FF262626'; // neutral dark charcoal for body text
    const GREY_TEXT    = 'FF6B7280';
    const LAVENDER_TXT = 'FFC9C9C9'; // muted grey for brand-strip tagline
    const MARK_BG      = 'FFF2F2F2'; // highlighted marks column
    const MARK_BORDER  = 'FFD4AF37'; // gold border makes the editable cell pop
    const WHITE         = 'FFFFFFFF';

    const thinBorder   = { style: 'thin', color: { argb: BORDER } };
    const fullBorder   = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
    const markBorder   = { style: 'medium', color: { argb: MARK_BORDER } };
    const markBorderLt = { style: 'thin', color: { argb: GOLD_SOFT } };
    const bevelMarkBorder = { top: markBorder, left: markBorder, bottom: markBorderLt, right: markBorderLt };
    const heroGradient = {
      type: 'gradient', gradient: 'angle', degree: 0,
      stops: [{ position: 0, color: { argb: VIOLET } }, { position: 1, color: { argb: INDIGO } }],
    };

    // Zoom in slightly so the bigger type reads comfortably on open.
    ws.views = [{ showGridLines: false, zoomScale: 115 }];

    // ── Row 1: EDUPLA brand strip ───────────────────────────────────────
    ws.mergeCells('A1:D1');
    const brandCell = ws.getCell('A1');
    brandCell.value = {
      richText: [
        { font: { name: 'Calibri', size: 11, color: { argb: GOLD } }, text: '  ◆  ' },
        { font: { name: 'Calibri', size: 12, bold: true, color: { argb: GOLD } }, text: 'E D U P L A' },
        { font: { name: 'Calibri', size: 10, italic: true, color: { argb: LAVENDER_TXT } }, text: '   ·   School Management Platform' },
      ],
    };
    brandCell.alignment = { vertical: 'middle', horizontal: 'left' };
    brandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MIDNIGHT } };
    ws.getRow(1).height = 22;

    // ── Row 2: gradient hero banner — assessment title ─────────────────
    ws.mergeCells('A2:D2');
    const titleCell = ws.getCell('A2');
    titleCell.value = `  ${assessment.title || 'Assessment'}`;
    titleCell.font = { name: 'Calibri', size: 24, bold: true, color: { argb: WHITE } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    titleCell.fill = heroGradient;
    ws.getRow(2).height = 42;

    // ── Row 3: module / class / term subtitle, same banner family ─────
    ws.mergeCells('A3:D3');
    const subtitleCell = ws.getCell('A3');
    const subtitleParts = [assessment.course_id?.name, assessment.class_id?.name, `${assessment.term} · ${assessment.academic_year}`].filter(Boolean);
    subtitleCell.value = `  ${subtitleParts.join('   |   ')}`;
    subtitleCell.font = { name: 'Calibri', size: 13, color: { argb: WHITE }, italic: true };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_SOFT } };
    ws.getRow(3).height = 26;

    // ── Row 4: thin gold accent strip closing the banner ───────────────
    ws.mergeCells('A4:D4');
    ws.getCell('A4').fill = {
      type: 'gradient', gradient: 'angle', degree: 0,
      stops: [{ position: 0, color: { argb: GOLD } }, { position: 1, color: { argb: GOLD_SOFT } }],
    };
    ws.getRow(4).height = 5;

    // ── Row 5: breathing room before the instructions card ────────────
    ws.getRow(5).height = 14;

    // ── Rows 6-9: instructions card, bigger type + generous padding ───
    ws.mergeCells('A6:D6');
    const instrTitle = ws.getCell('A6');
    instrTitle.value = '  📋  HOW TO FILL THIS IN';
    instrTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: INDIGO } };
    instrTitle.alignment = { vertical: 'middle', horizontal: 'left' };
    instrTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT_BG } };
    instrTitle.border = { top: thinBorder, left: { style: 'medium', color: { argb: GOLD } }, right: thinBorder, bottom: { style: 'hair', color: { argb: GOLD_SOFT } } };
    ws.getRow(6).height = 26;

    ws.mergeCells('A7:D9');
    const instrCell = ws.getCell('A7');
    instrCell.value =
      `•  Type marks only in the "${marksHeader}" column, between 0 and ${maxMarks}.\n\n` +
      `•  Do not edit the Student Name or No. columns, add/remove rows, or reorder students — this breaks the upload.\n\n` +
      `•  Leave a cell blank for a student who has no mark yet.`;
    instrCell.font = { name: 'Calibri', size: 12, color: { argb: TEXT_DARK } };
    instrCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left', indent: 1 };
    instrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT_BG } };
    instrCell.border = { left: { style: 'medium', color: { argb: GOLD } }, right: thinBorder, bottom: thinBorder };
    ws.getRow(7).height = 24;
    ws.getRow(8).height = 24;
    ws.getRow(9).height = 24;

    // ── Row 10: spacer before the table ─────────────────────────────────
    ws.getRow(10).height = 16;

    // ── Row 11: table header — bold, roomy, gradient-filled ─────────────
    const headerRowIdx = 11;
    const headerRow = ws.getRow(headerRowIdx);
    headerRow.values = { id: 'Student ID', no: 'No.', name: 'Student Name', marks: marksHeader };
    headerRow.height = 32;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', bold: true, color: { argb: WHITE }, size: 13 };
      cell.fill = heroGradient;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: thinBorder, left: thinBorder, right: thinBorder, bottom: { style: 'double', color: { argb: GOLD } } };
    });

    // ── Student rows — bigger type, generous height, highlighted marks ─
    const firstDataRow = headerRowIdx + 1;
    students.forEach((s, i) => {
      const row = ws.getRow(firstDataRow + i);
      row.values = {
        id: String(s._id),
        no: i + 1,
        name: s.name || '',
        marks: markMap[s._id.toString()]?.marks ?? null,
      };
      row.height = 28;
      const isStripe = i % 2 === 1;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = fullBorder;
        if (isStripe) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE } };
        if (colNumber === 2) cell.alignment = { vertical: 'middle', horizontal: 'center' };
        else cell.alignment = { vertical: 'middle', horizontal: 'left', indent: colNumber === 3 ? 1 : 0 };
      });
      // No. — bold, colored, centered like a little badge.
      const noCell = row.getCell('no');
      noCell.font = { name: 'Calibri', bold: true, size: 12, color: { argb: INDIGO } };
      // Student name — larger, clearly readable.
      const nameCell = row.getCell('name');
      nameCell.font = { name: 'Calibri', size: 13, color: { argb: TEXT_DARK } };
      // Marks — the editable focal point: highlighted fill, thicker border, big bold number.
      const marksCell = row.getCell('marks');
      marksCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: INDIGO } };
      marksCell.alignment = { vertical: 'middle', horizontal: 'center' };
      marksCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MARK_BG } };
      marksCell.border = bevelMarkBorder;
      marksCell.numFmt = '0.##';
    });

    const lastDataRow = firstDataRow + students.length - 1;

    // ── A crisp gold outer frame around the whole table block, tying
    // header and data rows together as one designed unit ────────────
    const outerGold = { style: 'medium', color: { argb: GOLD } };
    for (let r = headerRowIdx; r <= lastDataRow; r++) {
      const leftCell = ws.getCell(`B${r}`);
      const rightCell = ws.getCell(`D${r}`);
      leftCell.border = { ...leftCell.border, left: outerGold };
      rightCell.border = { ...rightCell.border, right: outerGold };
    }
    ['B', 'C', 'D'].forEach((col) => {
      const cell = ws.getCell(`${col}${lastDataRow}`);
      cell.border = { ...cell.border, bottom: outerGold };
    });

    // ── Data validation: marks column only accepts 0–maxMarks ────────
    for (let r = firstDataRow; r <= lastDataRow; r++) {
      ws.getCell(`D${r}`).dataValidation = {
        type: 'decimal',
        operator: 'between',
        formulae: [0, maxMarks],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid mark',
        error: `Marks must be a number between 0 and ${maxMarks}.`,
        showInputMessage: true,
        promptTitle: 'Enter mark',
        prompt: `0–${maxMarks}`,
      };
      // Belt-and-braces visual warning if a value somehow ends up out of range.
      ws.addConditionalFormatting({
        ref: `D${r}`,
        rules: [{
          type: 'expression',
          formulae: [`D${r}>${maxMarks}`],
          style: { font: { color: { argb: 'FF991B1B' }, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } } },
        }],
      });
    }

    // ── Footer — quick summary strip beneath the table ─────────────────
    const spacerRowIdx = lastDataRow + 1;
    ws.getRow(spacerRowIdx).height = 10;

    const footerRowIdx = spacerRowIdx + 1;
    ws.mergeCells(`A${footerRowIdx}:D${footerRowIdx}`);
    const footerCell = ws.getCell(`A${footerRowIdx}`);
    footerCell.value = `  ${students.length} student${students.length === 1 ? '' : 's'}  ·  marks scored out of ${maxMarks}`;
    footerCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: GREY_TEXT } };
    footerCell.alignment = { vertical: 'middle', horizontal: 'left' };
    footerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT_BG } };
    ws.getRow(footerRowIdx).height = 22;

    // Hide the Student ID column — teachers don't need to see/touch it,
    // it's only there so the upload can match rows back to students.
    ws.getColumn('id').hidden = true;

    // Freeze header row area and keep it visible while scrolling.
    ws.views = [{ showGridLines: false, zoomScale: 115 }];

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `marks-template-${assessment.type}-${(assessment.class_id?.name || 'class').replace(/[^a-z0-9]+/gi, '-')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/*
 * POST /teacher/assessments/:id/marks/upload
 * Accepts a multipart 'file' field containing the filled-in Excel
 * template, parses it, validates marks against the module's max marks,
 * and upserts Mark records exactly like teacherSaveMarks (draft status,
 * same locking rules). Rows are matched to students by the hidden
 * Student ID column; unrecognised or malformed rows are reported back
 * instead of silently applied.
 */
exports.teacherUploadMarks = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'total_marks');
    if (!assessment) return res.status(403).json({ message: 'Access denied' });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.id });
    if (submission && (submission.status === 'submitted' || submission.status === 'approved')) {
      return res.status(403).json({ message: 'Marks are locked. This assessment has already been submitted for review.' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'No file uploaded. Please select an Excel (.xlsx) file.' });
    }

    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    } catch {
      return res.status(400).json({ message: 'Could not read this file. Please upload a valid .xlsx file.' });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return res.status(400).json({ message: 'The uploaded workbook has no sheets.' });

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Find the header row (contains 'Student ID') instead of assuming a
    // fixed row number, so minor edits (extra blank rows, etc.) still work.
    const headerRowIdx = rows.findIndex(r => r.some(cell => String(cell).trim().toLowerCase() === 'student id'));
    if (headerRowIdx === -1) {
      return res.status(400).json({ message: 'This does not look like the marks template — the "Student ID" column header was not found. Please use the downloaded template.' });
    }
    const headerRow = rows[headerRowIdx].map(c => String(c).trim());
    const idCol    = headerRow.findIndex(c => c.toLowerCase() === 'student id');
    const nameCol  = headerRow.findIndex(c => c.toLowerCase() === 'student name');
    const marksCol = headerRow.findIndex(c => c.toLowerCase().startsWith('marks'));
    if (idCol === -1 || marksCol === -1) {
      return res.status(400).json({ message: 'The template is missing required columns. Please use the downloaded template.' });
    }

    // A row only counts as real student data if it has a name — this
    // correctly skips the trailing summary/footer row, whose merged text
    // otherwise lands in this same column index as the hidden Student ID
    // and would be misread as a bogus student row.
    const dataRows = rows.slice(headerRowIdx + 1).filter(r => String(r[nameCol] ?? '').trim() !== '');

    // Roster for this assessment's class, so we only accept marks for
    // students who actually belong to it.
    let students = [];
    const classId = assessment.class_id?._id || assessment.class_id;
    if (classId) {
      const cls = await Class.findById(classId).populate('students', 'name email').lean();
      students = cls?.students || [];
    }
    const validStudentIds = new Set(students.map(s => String(s._id)));

    const maxAllowed = assessment.course_id?.total_marks || assessment.max_marks || 100;

    /*
     * All-or-nothing validation: a filled sheet is only ever applied in
     * full. If ANY row is out of range, non-numeric, or belongs to a
     * student outside this class, the whole upload is rejected and NOT a
     * single mark is written — partially applying a sheet that was filled
     * in wrong just hides the mistake instead of forcing the teacher to
     * fix it. Blank cells (no mark yet) are always fine and don't count
     * as an error.
     */
    const ops = [];
    const errors = [];
    dataRows.forEach((row, i) => {
      const rowNum = headerRowIdx + 2 + i; // 1-indexed, +1 for header row itself
      const studentId = String(row[idCol] ?? '').trim();
      const studentName = String(row[nameCol] ?? '').trim();
      const who = studentName ? `${studentName} (row ${rowNum})` : `row ${rowNum}`;
      const rawMarks  = row[marksCol];

      if (!studentId) return; // blank ID cell on an otherwise blank-ish row; skip quietly

      if (!validStudentIds.has(studentId)) {
        errors.push(`${who}: this student does not belong to this class/assessment.`);
        return;
      }

      if (rawMarks === '' || rawMarks == null) {
        ops.push({ student_id: studentId, marks: null });
        return;
      }

      const num = Number(rawMarks);
      if (Number.isNaN(num)) {
        errors.push(`${who}: "${rawMarks}" is not a valid number.`);
        return;
      }
      if (num < 0 || num > maxAllowed) {
        errors.push(`${who}: ${num} is above the maximum allowed mark of ${maxAllowed}.`);
        return;
      }

      ops.push({ student_id: studentId, marks: num });
    });

    if (errors.length > 0) {
      return res.status(400).json({
        message: `Marks upload failed — the Excel file was filled in incorrectly (${errors.length} student${errors.length === 1 ? '' : 's'} with an invalid mark). Nothing was saved. Please correct these entries and re-upload.`,
        errors,
      });
    }

    if (ops.length > 0) {
      await Mark.bulkWrite(ops.map(m => ({
        updateOne: {
          filter: { assessment_id: req.params.id, student_id: m.student_id },
          update: { $set: { marks: m.marks, entered_by: req.user.id } },
          upsert: true,
        },
      })));
    }

    await AssessmentSubmission.findOneAndUpdate(
      { assessment_id: req.params.id },
      { $setOnInsert: { assessment_id: req.params.id, status: 'draft' } },
      { upsert: true }
    );

    /* ── Return the refreshed roster, sorted by performance (marks
       obtained, highest first) so the frontend can immediately show
       students ranked by how they did on this upload. Students with no
       mark are pushed to the end. ── */
    const freshMarks = await Mark.find({ assessment_id: req.params.id }).lean();
    const freshMarkMap = {};
    freshMarks.forEach(m => { freshMarkMap[m.student_id.toString()] = m; });

    const resultStudents = students
      .map(s => ({
        student_id: s._id,
        name: s.name,
        email: s.email,
        marks: freshMarkMap[s._id.toString()]?.marks ?? null,
      }))
      .sort((a, b) => {
        if (a.marks == null && b.marks == null) return (a.name || '').localeCompare(b.name || '');
        if (a.marks == null) return 1;
        if (b.marks == null) return -1;
        return b.marks - a.marks;
      });

    res.json({
      message: errors.length > 0
        ? `Uploaded with ${errors.length} issue${errors.length === 1 ? '' : 's'} — see details.`
        : 'Marks uploaded successfully',
      updated: ops.length,
      errors,
      students: resultStudents,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherSubmitMarks = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'total_marks');
    if (!assessment) return res.status(403).json({ message: 'Access denied' });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.id });
    if (submission && (submission.status === 'submitted' || submission.status === 'approved')) {
      return res.status(403).json({ message: 'Marks have already been submitted.' });
    }

    const { marks } = req.body;
    const maxAllowed = assessment.course_id?.total_marks || assessment.max_marks || 100;

    if (Array.isArray(marks) && marks.length > 0) {
      const overLimit = marks.filter(m => m.marks != null && Number(m.marks) > maxAllowed);
      if (overLimit.length > 0) {
        return res.status(400).json({
          message: `One or more marks exceed the maximum allowed (${maxAllowed}). Please correct them before submitting.`,
        });
      }
      const ops = marks.map(m => ({
        updateOne: {
          filter: { assessment_id: req.params.id, student_id: m.student_id },
          update: { $set: { marks: m.marks, entered_by: req.user.id } },
          upsert: true,
        },
      }));
      await Mark.bulkWrite(ops);
    }

    /* ── Marks must be fully recorded before submission is allowed.
       Saving (draft) is always allowed even with no marks at all — this lets a
       teacher clear marks back out and delete the assessment if needed — but
       submitting for admin review requires every student to have a mark. ── */
    const cls = await Class.findOne({ _id: assessment.class_id }, 'students').lean();
    const totalStudents = cls?.students?.length || 0;

    if (totalStudents > 0) {
      const allMarks = await Mark.find({ assessment_id: req.params.id }).lean();
      const recordedCount = allMarks.filter(m => m.marks != null).length;
      if (recordedCount < totalStudents) {
        return res.status(400).json({
          message: `Cannot submit — ${totalStudents - recordedCount} of ${totalStudents} student(s) still need marks recorded before this assessment can be submitted for review.`,
        });
      }
    }

    await AssessmentSubmission.findOneAndUpdate(
      { assessment_id: req.params.id },
      {
        $set: {
          status: 'submitted',
          submitted_by: req.user.id,
          submitted_at: new Date(),
          reviewed_by:  null,
          reviewed_at:  null,
          review_note:  null,
        },
      },
      { upsert: true }
    );

    res.json({ message: 'Marks submitted for review', status: 'submitted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════════════════════════════════
   ADMIN — ASSESSMENT SUBMISSION REVIEW
═══════════════════════════════════════════════════ */

exports.adminListSubmissions = async (req, res) => {
  try {
    const { status } = req.query;
    const courses = await Course.find({ created_by: req.user.id }, '_id').lean();
    const courseIds = courses.map(c => c._id);

    // Only manual "Marks Recording" assessments ever go through the
    // submit-for-review workflow below — online quiz assessments
    // (mode: 'quiz') are shared to students and auto-graded instead, and
    // never get an AssessmentSubmission of their own.
    // $ne: 'quiz' (not mode: 'marks') is deliberate: assessments created
    // before the online-quiz feature existed have no `mode` stored at all,
    // and a straight `mode: 'marks'` filter would silently exclude those
    // legacy records too, since Mongo's query engine — unlike Mongoose's
    // in-memory schema default — doesn't treat a missing field as 'marks'.
    const assessments = await Assessment.find({ course_id: { $in: courseIds }, mode: { $ne: 'quiz' } })
      .populate('course_id', 'name code total_marks class_id class_ids category')
      .populate('class_id', 'name')
      .populate('teacher_id', 'name email')
      .sort({ created_at: -1 })
      .lean();

    const assessmentIds = assessments.map(a => a._id);
    const submissions = await AssessmentSubmission.find({ assessment_id: { $in: assessmentIds } }).lean();
    const subMap = {};
    submissions.forEach(s => { subMap[s.assessment_id.toString()] = s; });

    const allMarks = await Mark.find({ assessment_id: { $in: assessmentIds } }).lean();
    const markCount = {};
    allMarks.forEach(m => {
      if (m.marks != null) {
        const key = m.assessment_id.toString();
        markCount[key] = (markCount[key] || 0) + 1;
      }
    });

    let result = assessments.map(a => {
      const sub = subMap[a._id.toString()];
      return {
        ...a, id: a._id,
        submission_status: sub?.status || 'draft',
        submitted_at:  sub?.submitted_at  || null,
        reviewed_at:   sub?.reviewed_at   || null,
        review_note:   sub?.review_note   || null,
        marked_count:  markCount[a._id.toString()] || 0,
      };
    });

    if (status) result = result.filter(a => a.submission_status === status);
    res.json({ assessments: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminViewSubmission = async (req, res) => {
  try {
    const courses = await Course.find({ created_by: req.user.id }, '_id').lean();
    const courseIds = courses.map(c => c._id.toString());

    const assessment = await Assessment.findById(req.params.assessmentId)
      .populate('course_id', 'name code total_marks category')
      .populate('class_id', 'name')
      .populate('teacher_id', 'name email')
      .lean();
    if (!assessment || !courseIds.includes(assessment.course_id?._id?.toString()) || assessment.mode === 'quiz')
      return res.status(404).json({ message: 'Assessment not found' });

    /*
     * Students come from THIS assessment's own class only.
     */
    let students = [];
    const classId = assessment.class_id?._id || assessment.class_id;
    if (classId) {
      const cls = await Class.findById(classId)
        .populate('students', 'name email level trade')
        .lean();
      students = cls?.students || [];
    }

    const marks = await Mark.find({ assessment_id: req.params.assessmentId }).lean();
    const markMap = {};
    marks.forEach(m => { markMap[m.student_id.toString()] = m; });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.assessmentId }).lean();

    const result = students.map(s => {
      const m = markMap[s._id.toString()];
      const marksVal = m?.marks ?? null;
      const max = assessment.max_marks;
      return {
        student_id: s._id, name: s.name, email: s.email,
        marks: marksVal, approved_marks: m?.approved_marks ?? null, max_marks: max,
        percentage: marksVal != null ? Math.round((marksVal / max) * 100) : null,
        grade: marksVal != null ? getGrade(marksVal, max) : 'N/A',
      };
    });

    res.json({
      assessment: { ...assessment, id: assessment._id },
      students: result,
      submission: {
        status:       submission?.status       || 'draft',
        submitted_at: submission?.submitted_at || null,
        submitted_by: submission?.submitted_by || null,
        reviewed_at:  submission?.reviewed_at  || null,
        review_note:  submission?.review_note  || null,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminApproveSubmission = async (req, res) => {
  try {
    const courses = await Course.find({ created_by: req.user.id }, '_id').lean();
    const courseIds = courses.map(c => c._id.toString());

    const assessment = await Assessment.findById(req.params.assessmentId).populate('course_id', '_id').lean();
    if (!assessment || !courseIds.includes(assessment.course_id?._id?.toString()) || assessment.mode === 'quiz')
      return res.status(404).json({ message: 'Assessment not found' });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.assessmentId });
    if (!submission || submission.status !== 'submitted')
      return res.status(400).json({ message: 'This assessment has not been submitted for review.' });

    const marks = await Mark.find({ assessment_id: req.params.assessmentId });
    await Promise.all(marks.map(m => { m.approved_marks = m.marks; return m.save(); }));

    submission.status      = 'approved';
    submission.reviewed_by = req.user.id;
    submission.reviewed_at = new Date();
    submission.review_note = null;
    await submission.save();

    res.json({ message: 'Assessment approved. Reports now reflect these marks.', status: 'approved' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminRejectSubmission = async (req, res) => {
  try {
    const courses = await Course.find({ created_by: req.user.id }, '_id').lean();
    const courseIds = courses.map(c => c._id.toString());

    const assessment = await Assessment.findById(req.params.assessmentId).populate('course_id', '_id').lean();
    if (!assessment || !courseIds.includes(assessment.course_id?._id?.toString()) || assessment.mode === 'quiz')
      return res.status(404).json({ message: 'Assessment not found' });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.assessmentId });
    if (!submission || (submission.status !== 'submitted' && submission.status !== 'approved'))
      return res.status(400).json({ message: 'Only submitted or approved assessments can be rejected.' });

    const { note } = req.body;
    submission.status      = 'rejected';
    submission.reviewed_by = req.user.id;
    submission.reviewed_at = new Date();
    submission.review_note = note || null;
    await submission.save();

    res.json({ message: 'Assessment rejected. The teacher can now edit marks again.', status: 'rejected' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherAssessmentReport = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.assessmentId, teacher_id: req.user.id })
      .populate('course_id', 'name code class_id class_ids total_marks category')
      .populate('class_id', 'name')
      .lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found or not yours' });

    const marks = await Mark.find({ assessment_id: req.params.assessmentId })
      .populate('student_id', 'name email level trade')
      .lean();

    const reportData = marks.map(m => ({
      student_id: m.student_id?._id,
      student_name: m.student_id?.name,
      student_email: m.student_id?.email,
      marks_obtained: m.marks,
      max_marks: assessment.max_marks,
      percentage: m.marks != null ? Math.round((m.marks / assessment.max_marks) * 100) : null,
      grade: m.marks != null ? getGrade(m.marks, assessment.max_marks) : 'N/A',
    }));

    const sorted = [...reportData].filter(s => s.percentage != null).sort((a, b) => b.percentage - a.percentage);
    reportData.forEach(s => {
      if (s.percentage != null) {
        s.rank = sorted.findIndex(x => x.student_id?.toString() === s.student_id?.toString()) + 1;
      }
    });

    res.json({ assessment: { ...assessment, id: assessment._id }, students: reportData });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ─────────── Helpers ─────────── */
function getGrade(obtained, max) {
  const pct = Math.min((obtained / max) * 100, 100);
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

/* ─────────── Student: get all courses for their enrolled class ─────────── */
exports.studentGetCourses = async (req, res) => {
  try {
    const cls = await Class.findOne({ students: req.user.id }).lean();
    if (!cls) return res.json({ courses: [] });

    /*
     * Match courses assigned to this class via either field.
     */
    const courses = await Course.find({
      $or: [
        { class_id:  cls._id },
        { class_ids: cls._id },
      ],
    })
      .populate('teacher_id', 'name email')
      .populate('class_ids', 'name')
      .populate('class_id',  'name')
      .sort({ category: 1, name: 1 })
      .lean();

    res.json({ courses: courses.map(c => ({ ...c, id: c._id })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
/* ═══════════════════════════════════════════════════════════════════════
   ONLINE ASSESSMENT (QUIZ) FEATURE
   ───────────────────────────────────────────────────────────────────────
   Adds question-based, auto-graded assessments on top of the existing
   marks-entry Assessment model:
     1. Teacher builds a question paper for an assessment (MCQ, True/False,
        Fill-in-the-gap, Matching, Open) — teacherSaveQuestions.
     2. Teacher shares it with the class with a duration, expiry, optional
        start time (available_from), and attempt limit — teacherShareAssessment.
     3. Students see it under "Assessments" as soon as it's shared, read the
        instructions, and start it once available_from has passed (if set)
        — studentGetSharedAssessments / studentGetAssessmentInstructions /
        studentStartAttempt.
     4. The attempt runs full-screen client-side; the server enforces the
        time limit and accepts autosaves and the final submit/auto-submit.
     5. On submit, everything except open questions is auto-graded exactly
        against the teacher's expected answers. Open questions wait for the
        teacher (teacherGradeOpenAnswers). Once an attempt is fully graded
        its score feeds into the same Mark model the manual-entry flow uses,
        so the existing report/approval pipeline picks it up automatically.
   ═══════════════════════════════════════════════════════════════════════ */

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normStr(s) { return (s ?? '').toString().trim().toLowerCase(); }

/*
 * Auto-grade one answer against its question's expected answer.
 * Returns { auto_score, is_correct, needsManual }. `needsManual` is true
 * only for open questions, which always require a teacher score.
 */
function gradeAnswer(question, answer) {
  const marks = question.marks || 0;
  switch (question.type) {
    case 'mcq': {
      const correct = Array.isArray(question.correct_answer)
        ? question.correct_answer.map(normStr)
        : [normStr(question.correct_answer)];
      const given = Array.isArray(answer) ? answer.map(normStr) : (answer != null ? [normStr(answer)] : []);
      const isCorrect = correct.length > 0 && correct.length === given.length && correct.every(c => given.includes(c));
      return { auto_score: isCorrect ? marks : 0, is_correct: isCorrect, needsManual: false };
    }
    case 'true_false': {
      const isCorrect = normStr(answer) === normStr(question.correct_answer);
      return { auto_score: isCorrect ? marks : 0, is_correct: isCorrect, needsManual: false };
    }
    case 'fill_gap': {
      const accepted = Array.isArray(question.correct_answer)
        ? question.correct_answer.map(normStr)
        : [normStr(question.correct_answer)];
      const isCorrect = accepted.includes(normStr(answer));
      return { auto_score: isCorrect ? marks : 0, is_correct: isCorrect, needsManual: false };
    }
    case 'matching': {
      const pairs = question.pairs || [];
      if (!pairs.length) return { auto_score: 0, is_correct: false, needsManual: false };
      const given = answer && typeof answer === 'object' ? answer : {};
      let correctCount = 0;
      pairs.forEach(p => { if (normStr(given[p.left]) === normStr(p.right)) correctCount++; });
      const isCorrect = correctCount === pairs.length;
      const score = Math.round((marks * correctCount / pairs.length) * 100) / 100;
      return { auto_score: score, is_correct: isCorrect, needsManual: false };
    }
    case 'open':
    default:
      return { auto_score: null, is_correct: null, needsManual: true };
  }
}

/* Strip a question of anything that would give the answer away before
   sending it to a student who is about to attempt it. */
function stripQuestionForAttempt(q) {
  const base = { id: q._id, type: q.type, question_text: q.question_text, marks: q.marks };
  if (q.type === 'mcq') base.options = (q.options || []).map(o => ({ key: o.key, text: o.text }));
  if (q.type === 'matching') {
    base.left_items = (q.pairs || []).map(p => p.left);
    base.right_options = shuffleArray((q.pairs || []).map(p => p.right));
  }
  return base;
}

async function buildAttemptPayload(attempt, assessment, orderedQuestions) {
  let questions = orderedQuestions;
  if (!questions) {
    const found = await AssessmentQuestion.find({ _id: { $in: attempt.question_order } }).lean();
    const map = {};
    found.forEach(q => { map[q._id.toString()] = q; });
    questions = attempt.question_order.map(id => map[id.toString()]).filter(Boolean);
  }
  const answerMap = {};
  (attempt.answers || []).forEach(a => { answerMap[a.question_id.toString()] = a.answer; });

  return {
    attempt_id: attempt._id,
    assessment_id: assessment._id,
    assessment_title: assessment.title,
    module_name: assessment.course_id?.name,
    instructions: assessment.instructions,
    duration_minutes: assessment.duration_minutes,
    started_at: attempt.started_at,
    due_at: attempt.due_at,
    questions: questions.map(q => ({
      ...stripQuestionForAttempt(q),
      saved_answer: answerMap[q._id.toString()] ?? null,
    })),
  };
}

/* Recompute an attempt's total score from its (now fully-scored) answers,
   mark it graded, and — if it beats the student's best score so far — push
   it into the Mark model so it flows through the existing report/approval
   pipeline exactly like a manually entered mark. */
async function finalizeAttemptSubmission(attempt, { autoSubmitted = false, reason = null } = {}) {
  const questions = await AssessmentQuestion.find({ _id: { $in: attempt.question_order } }).lean();
  const qMap = {};
  questions.forEach(q => { qMap[q._id.toString()] = q; });

  let allGraded = true;
  attempt.answers.forEach(a => {
    const q = qMap[a.question_id.toString()];
    if (!q) return;
    if (a.auto_score == null && a.manual_score == null) {
      const g = gradeAnswer(q, a.answer);
      a.auto_score = g.auto_score;
      a.is_correct = g.is_correct;
    }
    if (a.auto_score == null && a.manual_score == null) allGraded = false;
  });

  attempt.status = allGraded ? 'graded' : 'submitted';
  attempt.needs_manual_grading = !allGraded;
  attempt.submitted_at = new Date();
  attempt.auto_submitted = autoSubmitted;
  attempt.auto_submit_reason = reason;

  if (allGraded) {
    const total = attempt.answers.reduce((s, a) => s + (a.auto_score != null ? a.auto_score : a.manual_score), 0);
    attempt.total_score = Math.round(total * 100) / 100;
    attempt.graded_at = new Date();
  }

  await attempt.save();

  if (allGraded) {
    const assessment = await Assessment.findById(attempt.assessment_id).lean();
    if (assessment) await recomputeAndUpsertMark(assessment, attempt.student_id);
  }
  return attempt;
}

/* Builds the "here's your result" payload shared by submit / auto-submit /
   resume-after-ended, so the student always sees their score on both the
   assessment's own scale AND the module weight scale, plus the C/NYC
   decision once grading is fully complete (open questions included). */
function buildResultPayload(assessment, attempt) {
  const maxMarks = assessment.max_marks || 0;
  const moduleWeight = assessment.course_id?.total_marks || 100;
  const category = assessment.course_id?.category || 'Complementary modules';
  const totalScore = attempt.total_score;
  const percentage = totalScore != null && maxMarks ? Math.round((totalScore / maxMarks) * 100) : null;
  return {
    status: attempt.status,
    total_score: totalScore,
    needs_manual_grading: attempt.needs_manual_grading,
    max_marks: maxMarks,
    module_weight: moduleWeight,
    marks_on_mw: scaleScore(totalScore, maxMarks, moduleWeight),
    percentage,
    decision: attempt.status === 'graded' ? computeDecision(percentage, category) : null,
  };
}

/* A student's Mark for a quiz-mode assessment is always their BEST fully
   graded attempt — matches the "however many attempts, best one counts"
   expectation and keeps a single source of truth for reports. */
async function recomputeAndUpsertMark(assessment, studentId) {
  const attempts = await AssessmentAttempt.find({
    assessment_id: assessment._id, student_id: studentId, status: 'graded', total_score: { $ne: null }, voided: { $ne: true },
  }).lean();
  if (!attempts.length) return;
  const best = attempts.reduce((a, b) => (b.total_score > a.total_score ? b : a));
  await Mark.findOneAndUpdate(
    { assessment_id: assessment._id, student_id: studentId },
    { marks: best.total_score, entered_by: assessment.teacher_id },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

/* ═══════════════════════ TEACHER: Question builder ═══════════════════ */

exports.teacherGetQuestions = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id }).lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const locked = await AssessmentAttempt.countDocuments({
      assessment_id: assessment._id, status: { $ne: 'in_progress' }, voided: { $ne: true },
    }) > 0;

    const questions = await AssessmentQuestion.find({ assessment_id: req.params.id }).sort({ order: 1 }).lean();
    res.json({
      questions: questions.map(q => ({ ...q, id: q._id })),
      locked,
      mode: assessment.mode,
      is_shared: assessment.is_shared,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherSaveQuestions = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'total_marks');
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const submittedAttempts = await AssessmentAttempt.countDocuments({
      assessment_id: assessment._id, status: { $ne: 'in_progress' }, voided: { $ne: true },
    });
    if (submittedAttempts > 0) {
      return res.status(400).json({ message: 'Questions are locked — students have already submitted attempts for this assessment.' });
    }

    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'Add at least one question.' });
    }

    const VALID_TYPES = ['mcq', 'true_false', 'fill_gap', 'matching', 'open'];
    for (const q of questions) {
      if (!q.question_text || !q.question_text.trim()) {
        return res.status(400).json({ message: 'Every question needs question text.' });
      }
      if (!VALID_TYPES.includes(q.type)) {
        return res.status(400).json({ message: `Invalid question type "${q.type}".` });
      }
      if (!q.marks || Number(q.marks) <= 0) {
        return res.status(400).json({ message: 'Every question needs marks greater than 0.' });
      }
      if (q.type === 'mcq' && (!Array.isArray(q.options) || q.options.length < 2)) {
        return res.status(400).json({ message: 'Multiple choice questions need at least 2 options.' });
      }
      if (q.type === 'mcq' && (!Array.isArray(q.correct_answer) || q.correct_answer.length === 0)) {
        return res.status(400).json({ message: 'Select the correct option(s) for every multiple choice question.' });
      }
      if (q.type === 'matching' && (!Array.isArray(q.pairs) || q.pairs.length < 2)) {
        return res.status(400).json({ message: 'Matching questions need at least 2 pairs.' });
      }
      if (q.type === 'true_false' && !['true', 'false'].includes(String(q.correct_answer))) {
        return res.status(400).json({ message: 'True/False questions need a correct answer of true or false.' });
      }
      if (q.type === 'fill_gap' && (!q.correct_answer || (Array.isArray(q.correct_answer) && q.correct_answer.length === 0))) {
        return res.status(400).json({ message: 'Fill-in-the-gap questions need at least one expected answer.' });
      }
    }

    /* The assessment's maximum is the sum of the question marks the teacher
       just built. It's no longer capped at the module weight — a teacher
       may deliberately build a paper worth more (or less) than the module
       weight; results scaling (scaleScore) already converts whatever ratio
       a student earns onto the module weight correctly regardless. */
    const quizMax = questions.reduce((s, q) => s + Number(q.marks), 0);

    await AssessmentQuestion.deleteMany({ assessment_id: assessment._id });
    const docs = questions.map((q, i) => ({
      assessment_id: assessment._id,
      type: q.type,
      question_text: q.question_text.trim(),
      options: q.type === 'mcq' ? q.options : [],
      pairs: q.type === 'matching' ? q.pairs : [],
      correct_answer: q.type === 'open' ? (q.correct_answer || null) : q.correct_answer,
      marks: Number(q.marks),
      order: i,
    }));
    await AssessmentQuestion.insertMany(docs);

    assessment.max_marks = quizMax;
    if (assessment.mode !== 'quiz') assessment.mode = 'quiz';
    await assessment.save();

    res.json({ message: 'Questions saved.', count: docs.length, max_marks: quizMax });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════ TEACHER: AI question generation ══════════════════
   Uses Google's Gemini API (free tier — no billing required) to draft a
   question set from a topic + optional references, at a chosen mix of
   types and a chosen difficulty. The result is handed back to the
   frontend as plain draft data — nothing is written to the database
   here. The teacher reviews/edits on the Manual Creation tab and only
   the existing teacherSaveQuestions endpoint ever persists questions,
   so this route can't be used to bypass validation or the lock check.

   Free-tier note: Gemini's free tier does not reliably include live
   web-search grounding without a billing account attached, so this
   draws on the model's own training knowledge plus whatever the
   teacher pastes into "references" rather than browsing the web. Set
   GEMINI_API_KEY (get one free, no card required, at
   https://aistudio.google.com/apikey) in backend/.env to enable this. */

const VALID_AI_TYPES = ['mcq', 'true_false', 'fill_gap', 'matching', 'open'];
const MAX_AI_QUESTIONS = 40;
// Google retires/renames free-tier model IDs fairly often, so we try a
// short list in priority order and fall back automatically if one has
// been deprecated (a 404 "no longer available" response), rather than
// hard-failing on a single hardcoded model string.
const GEMINI_MODEL_CANDIDATES = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
];

function buildGenerationPrompt({ topic, references, complexity, counts, moduleName }) {
  const mix = Object.entries(counts)
    .filter(([, n]) => Number(n) > 0)
    .map(([type, n]) => `${n} of type "${type}"`)
    .join(', ');

  return `You are helping a teacher build an assessment question bank for the module "${moduleName || topic}".

Topic to write questions about: ${topic}
${references ? `Reference material the teacher wants you to ground the questions in — treat this as the source of truth for facts: ${references}` : 'No specific references were given — use accurate, general subject knowledge on this topic.'}
Difficulty level: ${complexity}
Exact question mix required: ${mix}

Question type definitions and required JSON shape per type:
- "mcq": { "type": "mcq", "question_text": string, "marks": number, "options": [{ "key": "A", "text": string }, ...] (2-5 options), "correct_answer": [array of the correct option key(s), e.g. ["B"]] }
- "true_false": { "type": "true_false", "question_text": string, "marks": number, "correct_answer": "true" or "false" }
- "fill_gap": { "type": "fill_gap", "question_text": string (use ___ for the blank), "marks": number, "correct_answer": [array of one or more acceptable exact-match answers] }
- "matching": { "type": "matching", "question_text": string (brief instruction), "marks": number, "pairs": [{ "left": string, "right": string }, ...] (at least 2 pairs) }
- "open": { "type": "open", "question_text": string, "marks": number, "correct_answer": string (a model answer for the teacher's own reference — not shown to students) }

Rules:
- Produce exactly the requested count of each type, no more, no fewer.
- Set "marks" to 1 for every question unless the difficulty clearly warrants more (max 3).
- Keep wording precise, unambiguous, and appropriate for the "${complexity}" difficulty level.
- Don't invent facts — stick to well-established knowledge and the references given.
- Respond with ONLY a raw JSON object of the exact shape { "questions": [ ... ] } and nothing else — no markdown fences, no commentary before or after.`;
}

exports.teacherGenerateQuestions = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'name');
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const submittedAttempts = await AssessmentAttempt.countDocuments({
      assessment_id: assessment._id, status: { $ne: 'in_progress' }, voided: { $ne: true },
    });
    if (submittedAttempts > 0) {
      return res.status(400).json({ message: 'Questions are locked — students have already submitted attempts for this assessment.' });
    }

    const { topic, references, complexity, counts } = req.body;
    if (!topic || !topic.trim()) return res.status(400).json({ message: 'A topic is required.' });
    if (!['easy', 'medium', 'advanced'].includes(complexity)) {
      return res.status(400).json({ message: 'Complexity must be easy, medium, or advanced.' });
    }
    if (!counts || typeof counts !== 'object') return res.status(400).json({ message: 'Question counts are required.' });

    const cleanCounts = {};
    let total = 0;
    for (const type of VALID_AI_TYPES) {
      const n = Math.max(0, Math.floor(Number(counts[type]) || 0));
      cleanCounts[type] = n;
      total += n;
    }
    if (total === 0) return res.status(400).json({ message: 'Set at least one question count.' });
    if (total > MAX_AI_QUESTIONS) {
      return res.status(400).json({ message: `Generate at most ${MAX_AI_QUESTIONS} questions at a time.` });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ message: 'AI generation is not configured on this server — GEMINI_API_KEY is missing. Get a free key at https://aistudio.google.com/apikey' });
    }

    const prompt = buildGenerationPrompt({
      topic: topic.trim(),
      references: (references || '').trim(),
      complexity,
      counts: cleanCounts,
      moduleName: assessment.course_id?.name,
    });

    let apiRes, usedModel;
    for (const modelId of GEMINI_MODEL_CANDIDATES) {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
      apiRes = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.6,
            maxOutputTokens: 8000,
          },
        }),
      });
      usedModel = modelId;
      if (apiRes.ok) break;
      // Only retry the next candidate if this specific model was retired/unknown —
      // any other error (bad key, rate limit, etc.) applies regardless of model.
      const bodyText = await apiRes.clone().text();
      const isRetiredModel = apiRes.status === 404 || /no longer available|not found/i.test(bodyText);
      if (!isRetiredModel) break;
      console.warn(`Gemini model "${modelId}" unavailable, trying next candidate...`);
    }

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Gemini API error:', usedModel, apiRes.status, errText);
      const parsedErr = (() => { try { return JSON.parse(errText); } catch { return null; } })();
      const upstreamMessage = parsedErr?.error?.message || '';
      let message = 'The AI service failed to respond. Please try again.';
      if (apiRes.status === 429) message = 'Free-tier rate limit reached for the AI model — wait a minute (or a bit longer if you\'ve hit the daily quota) and try again.';
      else if (apiRes.status === 400 && /API key/i.test(upstreamMessage)) message = 'The Gemini API key is invalid — check GEMINI_API_KEY in backend/.env.';
      else if (/no longer available|not found/i.test(upstreamMessage)) message = 'All configured Gemini model IDs are unavailable — Google may have retired them again. Check https://ai.google.dev/gemini-api/docs/models for current free-tier model IDs and update GEMINI_MODEL_CANDIDATES in the backend.';
      else if (upstreamMessage) message = upstreamMessage;
      return res.status(502).json({ message });
    }

    const data = await apiRes.json();
    console.log(`Gemini generation succeeded using model "${usedModel}".`);
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
      console.error('Gemini generation blocked/incomplete:', finishReason, data.promptFeedback);
      return res.status(502).json({ message: `The AI could not complete this request (${finishReason}). Try a smaller batch or a different topic wording.` });
    }

    const textOut = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
    const jsonMatch = textOut.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ message: 'The AI response could not be parsed. Please try again.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(502).json({ message: 'The AI response was not valid JSON — try a smaller batch (large batches can get cut off on the free tier).' });
    }

    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions = rawQuestions
      .filter(q => q && VALID_AI_TYPES.includes(q.type) && q.question_text && q.question_text.trim())
      .map(q => ({
        type: q.type,
        question_text: String(q.question_text).trim(),
        marks: Number(q.marks) > 0 ? Number(q.marks) : 1,
        options: q.type === 'mcq' && Array.isArray(q.options)
          ? q.options.slice(0, 6).map((o, i) => ({ key: o.key || String.fromCharCode(65 + i), text: String(o.text || '').trim() }))
          : undefined,
        pairs: q.type === 'matching' && Array.isArray(q.pairs)
          ? q.pairs.map(p => ({ left: String(p.left || '').trim(), right: String(p.right || '').trim() }))
          : undefined,
        correct_answer: q.correct_answer,
      }));

    if (!questions.length) {
      return res.status(502).json({ message: 'The AI did not return any usable questions. Try adjusting the topic or mix and generate again.' });
    }

    res.json({ questions, generated_count: questions.length });
  } catch (err) {
    console.error('teacherGenerateQuestions error:', err);
    if (err.cause) console.error('  underlying cause:', err.cause);
    const causeCode = err.cause?.code;
    let message = err.message;
    if (message === 'fetch failed') {
      if (causeCode === 'ENOTFOUND') message = 'Could not resolve generativelanguage.googleapis.com — check the server\'s internet/DNS connection.';
      else if (causeCode === 'ECONNREFUSED') message = 'Connection to the Gemini API was refused — check firewall or proxy settings.';
      else if (causeCode === 'ETIMEDOUT' || causeCode === 'UND_ERR_CONNECT_TIMEOUT') message = 'Connection to the Gemini API timed out — check the server\'s internet connection or proxy.';
      else if (/certificate|SELF_SIGNED|CERT_/.test(causeCode || '')) message = 'A TLS/certificate error blocked the connection to the Gemini API — check antivirus/corporate proxy SSL inspection.';
      else message = `Could not reach the AI service (${causeCode || 'network error'}). Check this server's internet connection.`;
    }
    res.status(500).json({ message });
  }
};

/* ═══════════════════════ TEACHER: Share / unshare ═════════════════════ */

exports.teacherShareAssessment = async (req, res) => {
  try {
    const { duration_minutes, expires_at, available_from, max_attempts, instructions, shuffle_questions } = req.body;

    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'name')
      .populate('class_id', 'name students');
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const qCount = await AssessmentQuestion.countDocuments({ assessment_id: assessment._id });
    if (qCount === 0) {
      return res.status(400).json({ message: 'Add at least one question before sharing this assessment.' });
    }
    if (!duration_minutes || Number(duration_minutes) <= 0) {
      return res.status(400).json({ message: 'Set an assessment duration greater than 0 minutes.' });
    }
    if (expires_at && new Date(expires_at) <= new Date()) {
      return res.status(400).json({ message: 'Expiry date/time must be in the future.' });
    }
    // available_from is optional — leaving it unset means students can start
    // as soon as the share notification lands, same as before this field
    // existed. When set, it just has to make sense against the expiry: the
    // window it opens has to actually give students time to start.
    if (available_from && expires_at && new Date(available_from) >= new Date(expires_at)) {
      return res.status(400).json({ message: 'The start time must be before the expiry date/time.' });
    }
    if (!assessment.class_id) {
      return res.status(400).json({ message: 'This assessment has no class assigned.' });
    }

    const requestedMaxAttempts = Math.max(1, Number(max_attempts) || 1);

    /* Guard against silently locking students out: if some students have
       already used more attempts than the new value would allow, block it
       and point the teacher at the dedicated "Add attempt" action instead. */
    if (assessment.is_shared) {
      const mostUsed = await AssessmentAttempt.findOne({ assessment_id: assessment._id, voided: { $ne: true } })
        .sort({ attempt_number: -1 }).lean();
      if (mostUsed && requestedMaxAttempts < mostUsed.attempt_number) {
        return res.status(400).json({
          message: `Cannot set attempts to ${requestedMaxAttempts} — at least one student has already used ${mostUsed.attempt_number} attempt(s). Use "Add attempt" to increase it instead.`,
        });
      }
    }

    assessment.mode              = 'quiz';
    assessment.duration_minutes  = Number(duration_minutes);
    assessment.expires_at        = expires_at ? new Date(expires_at) : null;
    assessment.available_from    = available_from ? new Date(available_from) : null;
    assessment.max_attempts      = requestedMaxAttempts;
    assessment.attempt_overrides = [];
    assessment.instructions      = instructions ?? assessment.instructions;
    assessment.shuffle_questions = shuffle_questions !== false;
    assessment.is_shared         = true;
    assessment.shared_at         = new Date();
    await assessment.save();

    res.json({ message: 'Assessment shared with the class.' });

    // ── Notify students async (never block the response) ────────────────
    try {
      const teacher = await User.findById(req.user.id, 'name').lean();
      const studentEmails = await getStudentEmails(assessment.class_id._id);

      await createInAppNotification({
        title: `New Assessment: ${assessment.title}`,
        message: `${teacher?.name || 'Your teacher'} shared "${assessment.title}" (${assessment.course_id?.name || 'module'}) for you to attempt in ${assessment.class_id?.name || 'your class'}.`,
        type: 'info',
        classId: assessment.class_id._id,
        teacherId: req.user.id,
        linkType: 'assessment',
        linkId: assessment._id,
        courseId: assessment.course_id?._id || null,
      });

      if (studentEmails.length) {
        notifyAssessmentShared({
          studentEmails,
          teacherEmail: await getTeacherEmail(req.user.id),
          assessmentTitle: assessment.title,
          moduleName: assessment.course_id?.name,
          className: assessment.class_id?.name,
          teacherName: teacher?.name || 'Your teacher',
          durationMinutes: assessment.duration_minutes,
          maxAttempts: assessment.max_attempts,
          expiresAt: assessment.expires_at,
          availableFrom: assessment.available_from,
        }).catch(err => console.error('Email send error:', err.message));
      }
    } catch (err) {
      console.error('Notification error (assessment share):', err.message);
    }
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherUnshareAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id });
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    assessment.is_shared = false;
    assessment.attempt_overrides = [];
    await assessment.save();

    // Void every existing attempt — students' submissions are no longer
    // considered towards results/marks/attempt limits, and the question
    // paper is unlocked for editing. Attempts are kept (not deleted) purely
    // as an audit trail; every read path filters `voided: true` out.
    const voidResult = await AssessmentAttempt.updateMany(
      { assessment_id: assessment._id, voided: { $ne: true } },
      { voided: true, voided_at: new Date() }
    );
    // The Mark records for this assessment were auto-derived from those now-
    // voided attempts — clear them so no stale mark lingers until the
    // assessment is re-shared and graded again.
    await Mark.deleteMany({ assessment_id: assessment._id });

    res.json({
      message: voidResult.modifiedCount > 0
        ? `Assessment unshared. ${voidResult.modifiedCount} student submission(s) have been voided and won't count towards results. You can now edit the questions freely.`
        : 'Assessment unshared. Students can no longer start new attempts. You can now edit the questions freely.',
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* Give students one (or more) extra attempts on an assessment that's already
   shared — e.g. because a student needs another try to demonstrate they've
   understood the material. This is deliberately a lighter-weight action than
   full re-sharing: it doesn't require re-sending the "new assessment"
   notification email; students who are already looking at the assessment
   just see more attempts available.
   Optionally also updates duration_minutes / expires_at (e.g. giving the
   extra attempt a fresh window to be used in), without touching
   instructions or resetting anything else the way a full re-share would. */
exports.teacherAddAttempts = async (req, res) => {
  try {
    const additional = Math.max(1, Math.round(Number(req.body.additional_attempts) || 1));
    const { duration_minutes, expires_at, available_from } = req.body;
    // student_ids: when present (and non-empty), the extra attempt(s) are
    // granted ONLY to those students — everyone else keeps whatever cap
    // they already had. Omit (or leave empty) to apply to the whole class,
    // same as before this option existed.
    const studentIds = Array.isArray(req.body.student_ids)
      ? [...new Set(req.body.student_ids.filter(Boolean).map(String))]
      : [];

    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'name')
      .populate('class_id', 'name students');
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });
    if (!assessment.is_shared) {
      return res.status(400).json({ message: 'This assessment has not been shared yet — share it first.' });
    }

    if (studentIds.length) {
      const classStudentIds = new Set((assessment.class_id?.students || []).map(id => id.toString()));
      const invalid = studentIds.filter(id => !classStudentIds.has(id));
      if (invalid.length) {
        return res.status(400).json({ message: 'One or more selected students are not in this class.' });
      }
    }

    if (duration_minutes !== undefined && duration_minutes !== null && duration_minutes !== '') {
      if (Number(duration_minutes) <= 0) {
        return res.status(400).json({ message: 'Duration must be greater than 0 minutes.' });
      }
      assessment.duration_minutes = Number(duration_minutes);
    }
    if (expires_at !== undefined && expires_at !== null && expires_at !== '') {
      if (new Date(expires_at) <= new Date()) {
        return res.status(400).json({ message: 'Expiry date/time must be in the future.' });
      }
      assessment.expires_at = new Date(expires_at);
    }
    if (available_from !== undefined) {
      const newAvailableFrom = available_from ? new Date(available_from) : null;
      if (newAvailableFrom && assessment.expires_at && newAvailableFrom >= new Date(assessment.expires_at)) {
        return res.status(400).json({ message: 'The start time must be before the expiry date/time.' });
      }
      assessment.available_from = newAvailableFrom;
    }

    let newMaxForSelected = null;
    if (studentIds.length) {
      // Targeted grant: bump (or create) each selected student's own override,
      // built on top of whatever cap they effectively have right now —
      // the class-wide max_attempts, or a higher override from an earlier
      // targeted grant. The class-wide max_attempts itself is untouched, so
      // everyone else still can't attempt beyond it.
      const overrides = assessment.attempt_overrides || [];
      const byStudent = new Map(overrides.map(o => [o.student_id.toString(), o]));
      studentIds.forEach(id => {
        const current = byStudent.get(id)?.max_attempts ?? (assessment.max_attempts || 1);
        byStudent.set(id, { student_id: id, max_attempts: current + additional });
      });
      assessment.attempt_overrides = Array.from(byStudent.values());
      newMaxForSelected = Math.max(...studentIds.map(id => byStudent.get(id).max_attempts));
    } else {
      assessment.max_attempts = (assessment.max_attempts || 1) + additional;
    }
    await assessment.save();

    const targetDescription = studentIds.length
      ? `${studentIds.length} selected student${studentIds.length > 1 ? 's' : ''}`
      : 'the whole class';
    res.json({
      message: studentIds.length
        ? `Added ${additional} attempt${additional > 1 ? 's' : ''} for ${targetDescription}. They now get up to ${newMaxForSelected} attempt${newMaxForSelected > 1 ? 's' : ''}; everyone else is unchanged.`
        : `Added ${additional} attempt${additional > 1 ? 's' : ''}. Students now get up to ${assessment.max_attempts} attempt${assessment.max_attempts > 1 ? 's' : ''}.`,
      max_attempts: assessment.max_attempts,
      attempt_overrides: assessment.attempt_overrides,
      duration_minutes: assessment.duration_minutes,
      expires_at: assessment.expires_at,
      available_from: assessment.available_from,
    });

    // ── Notify students async — a quick heads-up, not a full re-share blast ──
    try {
      const teacher = await User.findById(req.user.id, 'name').lean();
      const notifyMax = studentIds.length ? newMaxForSelected : assessment.max_attempts;
      const message = `${teacher?.name || 'Your teacher'} gave you an extra attempt on "${assessment.title}" (${assessment.course_id?.name || 'module'}). You now have up to ${notifyMax} attempts.`;
      if (studentIds.length) {
        // Targeted grant — only the selected students should see this,
        // not the whole class (most of whom still can't attempt again).
        await Promise.all(studentIds.map(id => createDirectNotification({
          title: `Extra attempt: ${assessment.title}`,
          message,
          type: 'info',
          classId: assessment.class_id._id,
          teacherId: req.user.id,
          recipientId: id,
          linkType: 'assessment',
          linkId: assessment._id,
        })));
      } else {
        await createInAppNotification({
          title: `Extra attempt: ${assessment.title}`,
          message,
          type: 'info',
          classId: assessment.class_id._id,
          teacherId: req.user.id,
          linkType: 'assessment',
          linkId: assessment._id,
          courseId: assessment.course_id?._id || null,
        });
      }
    } catch (err) {
      console.error('Notification error (assessment add-attempts):', err.message);
    }
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════ TEACHER: Attempts / grading / mark sheet ═════ */

exports.teacherListAttempts = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('class_id', 'name students')
      .populate('course_id', 'name total_marks category')
      .lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const students = await User.find({ _id: { $in: assessment.class_id?.students || [] } }, 'name email')
      .sort({ name: 1 }).lean();
    const attempts = await AssessmentAttempt.find({ assessment_id: assessment._id, voided: { $ne: true } }).sort({ attempt_number: 1 }).lean();

    const byStudent = {};
    attempts.forEach(a => {
      const key = a.student_id.toString();
      (byStudent[key] = byStudent[key] || []).push(a);
    });

    const totalAgg = await AssessmentQuestion.aggregate([
      { $match: { assessment_id: assessment._id } },
      { $group: { _id: null, total: { $sum: '$marks' } } },
    ]);
    const maxMarks = totalAgg[0]?.total || 0;
    const moduleWeight = assessment.course_id?.total_marks || 100;
    const category = assessment.course_id?.category || 'Complementary modules';

    const rows = students.map(s => {
      const list = byStudent[s._id.toString()] || [];
      const graded = list.filter(a => a.status === 'graded');
      const best = [...graded].sort((a, b) => b.total_score - a.total_score)[0];
      const pendingGrading = list.some(a => a.needs_manual_grading && a.status === 'submitted');
      const bestScore = best ? best.total_score : null;
      const rawPct = rawPercentage(bestScore, maxMarks);
      const percentage = rawPct != null ? Math.round(rawPct) : null;
      const marksOnMw = scaleScore(bestScore, maxMarks, moduleWeight);
      return {
        student_id: s._id,
        student_name: s.name,
        student_email: s.email,
        max_attempts: effectiveMaxAttempts(assessment, s._id),
        attempts_used: list.length,
        best_score: bestScore,
        max_marks: maxMarks,
        module_weight: moduleWeight,
        marks_on_mw: marksOnMw,
        percentage,
        decision: computeDecision(rawPct, category),
        status: pendingGrading ? 'needs_grading' : (best ? 'graded' : (list.length ? 'submitted' : 'not_attempted')),
        attempts: list.map(a => ({
          id: a._id, attempt_number: a.attempt_number, status: a.status,
          total_score: a.total_score, needs_manual_grading: a.needs_manual_grading,
          auto_submitted: a.auto_submitted, auto_submit_reason: a.auto_submit_reason,
          submitted_at: a.submitted_at,
        })),
      };
    });

    res.json({ assessment: { ...assessment, id: assessment._id, max_marks_computed: maxMarks, module_weight: moduleWeight }, rows });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════ TEACHER: Overall (combined) results ══════════
   When a module/class/term/year holds MORE THAN ONE assessment of the
   same type (e.g. Formative Assessment 1 + Formative Assessment 2), the
   teacher can either look at any single one of them individually (same
   as before) or ask for the "Overall" view: every shared assessment in
   that type/term/year group is combined into one result per student —
   their best score on each assessment is summed, that sum is taken over
   the sum of each assessment's own max marks, and the combined fraction
   is finally scaled onto the module weight. This keeps the module weight
   from being counted more than once even though several assessments each
   independently cap at it. ═══════════════════════════════════════════ */
async function buildOverallResults(teacherId, { course_id, class_id, type, term, academic_year }) {
  const course = await Course.findOne({ _id: course_id, teacher_id: teacherId }, 'name total_marks category').lean();
  if (!course) return null;
  const cls = await Class.findById(class_id, 'name students').lean();
  if (!cls) return null;

  const assessments = await Assessment.find({
    teacher_id: teacherId, course_id, class_id, type, term, academic_year, mode: 'quiz', is_shared: true,
  }).sort({ created_at: 1 }).lean();

  const moduleWeight = course.total_marks || 100;
  const category = course.category || 'Complementary modules';

  const maxMarksByAssessment = {};
  for (const a of assessments) {
    const agg = await AssessmentQuestion.aggregate([
      { $match: { assessment_id: a._id } },
      { $group: { _id: null, total: { $sum: '$marks' } } },
    ]);
    maxMarksByAssessment[a._id.toString()] = agg[0]?.total || 0;
  }
  const combinedMax = assessments.reduce((s, a) => s + (maxMarksByAssessment[a._id.toString()] || 0), 0);

  const students = await User.find({ _id: { $in: cls.students || [] } }, 'name email').sort({ name: 1 }).lean();

  const attempts = assessments.length
    ? await AssessmentAttempt.find({ assessment_id: { $in: assessments.map(a => a._id) }, voided: { $ne: true } }).lean()
    : [];
  const byKey = {};
  attempts.forEach(at => {
    const k = `${at.assessment_id}_${at.student_id}`;
    (byKey[k] = byKey[k] || []).push(at);
  });

  const rows = students.map(s => {
    let totalObtained = 0;
    let anyAttempted = false;
    let anyPendingGrading = false;

    const perAssessment = assessments.map(a => {
      const list = byKey[`${a._id}_${s._id}`] || [];
      const graded = list.filter(x => x.status === 'graded');
      const best = [...graded].sort((x, y) => y.total_score - x.total_score)[0];
      const bestScore = best ? best.total_score : null;
      if (bestScore != null) { totalObtained += bestScore; anyAttempted = true; }
      if (list.some(x => x.needs_manual_grading && x.status === 'submitted')) anyPendingGrading = true;
      return {
        assessment_id: a._id, title: a.title,
        best_score: bestScore, max_marks: maxMarksByAssessment[a._id.toString()] || 0,
        attempts_used: list.length,
      };
    });

    const rawPct = anyAttempted ? rawPercentage(totalObtained, combinedMax) : null;
    const percentage = rawPct != null ? Math.round(rawPct) : null;

    return {
      student_id: s._id, student_name: s.name, student_email: s.email,
      per_assessment: perAssessment,
      total_obtained: anyAttempted ? Math.round(totalObtained * 100) / 100 : null,
      combined_max: combinedMax,
      percentage,
      module_weight: moduleWeight,
      marks_on_mw: anyAttempted ? scaleScore(totalObtained, combinedMax, moduleWeight) : null,
      decision: anyAttempted ? computeDecision(rawPct, category) : null,
      status: anyPendingGrading ? 'needs_grading' : (anyAttempted ? 'graded' : 'not_attempted'),
    };
  });

  return {
    course: { id: course._id, name: course.name },
    class: { id: cls._id, name: cls.name },
    type, term, academic_year,
    assessments: assessments.map(a => ({ id: a._id, title: a.title, max_marks: maxMarksByAssessment[a._id.toString()] || 0 })),
    combined_max: combinedMax,
    module_weight: moduleWeight,
    rows,
  };
}

/* ═══════════════════════ STUDENT: own results — single + overall (tabs) ══
   Powers the student-facing "View Result" modal: every SHARED assessment in
   the same series as the one the student opened (same course/class/type/
   term/academic_year — exactly the grouping teacherGetOverallResults uses)
   gets its own tab with that student's attempts, plus one combined
   "Overall" tab computed with the identical best-score/module-weight
   scaling logic buildOverallResults uses for the teacher's mark sheet — so
   a student's own "C"/"NYC" always matches what the teacher sees. Only
   this student's data is ever included; no classmates are exposed, aside
   from an optional, non-identifying class-average benchmark per
   assessment. ═══════════════════════════════════════════════════════════ */
async function buildStudentSeriesResult(assessmentId, studentId) {
  const anchor = await Assessment.findOne({ _id: assessmentId, mode: 'quiz', is_shared: true })
    .populate('course_id', 'name total_marks category')
    .lean();
  if (!anchor || !anchor.course_id) return null;

  const cls = await Class.findOne({ _id: anchor.class_id, students: studentId }, 'name').lean();
  if (!cls) return null; // this assessment isn't for this student's class

  const student = await User.findById(studentId, 'name email').lean();
  if (!student) return null;

  const assessments = await Assessment.find({
    course_id: anchor.course_id._id, class_id: anchor.class_id, type: anchor.type,
    term: anchor.term, academic_year: anchor.academic_year, mode: 'quiz', is_shared: true,
  }).populate('teacher_id', 'name').sort({ created_at: 1 }).lean();

  const moduleWeight = anchor.course_id.total_marks || 100;
  const category = anchor.course_id.category || 'Complementary modules';

  const maxMarksByAssessment = {};
  for (const a of assessments) {
    const agg = await AssessmentQuestion.aggregate([
      { $match: { assessment_id: a._id } },
      { $group: { _id: null, total: { $sum: '$marks' } } },
    ]);
    maxMarksByAssessment[a._id.toString()] = agg[0]?.total || 0;
  }
  const combinedMax = assessments.reduce((s, a) => s + (maxMarksByAssessment[a._id.toString()] || 0), 0);

  const assessmentIds = assessments.map(a => a._id);

  // This student's own attempts across every assessment in the series —
  // every attempt is shown per-tab (not just the best), oldest first.
  const myAttempts = assessmentIds.length
    ? await AssessmentAttempt.find({ assessment_id: { $in: assessmentIds }, student_id: studentId, voided: { $ne: true } })
      .sort({ attempt_number: 1 }).lean()
    : [];
  const myByAssessment = {};
  myAttempts.forEach(at => {
    const k = at.assessment_id.toString();
    (myByAssessment[k] = myByAssessment[k] || []).push(at);
  });

  const passingLine = passingLineForCategory(category);

  let totalObtained = 0;
  let anyAttempted = false;
  let anyPendingGrading = false;

  const perAssessment = assessments.map(a => {
    const key = a._id.toString();
    const list = myByAssessment[key] || [];
    const maxMarks = maxMarksByAssessment[key] || 0;
    const graded = list.filter(x => x.status === 'graded');
    const best = [...graded].sort((x, y) => y.total_score - x.total_score)[0];
    const bestScore = best ? best.total_score : null;
    if (bestScore != null) { totalObtained += bestScore; anyAttempted = true; }
    const pendingHere = list.some(x => x.needs_manual_grading && x.status === 'submitted');
    if (pendingHere) anyPendingGrading = true;

    const rawPct = rawPercentage(bestScore, maxMarks);
    const percentage = rawPct != null ? Math.round(rawPct) : null;
    // Personal-only signal (no classmate data): how far this best score
    // sits from the competency line, in both marks and percentage points —
    // powers a "X pts to Competent" / "X pts above the line" indicator.
    const marginPct = rawPct != null ? Math.round((rawPct - passingLine) * 10) / 10 : null;
    const marginMarks = bestScore != null && maxMarks
      ? Math.round((bestScore - (passingLine / 100) * maxMarks) * 10) / 10
      : null;

    return {
      assessment_id: a._id,
      title: a.title,
      teacher_name: a.teacher_id?.name || null,
      duration_minutes: a.duration_minutes,
      max_marks: maxMarks,
      max_attempts: effectiveMaxAttempts(a, studentId),
      attempts_used: list.length,
      best_score: bestScore,
      percentage,
      decision: bestScore != null ? computeDecision(rawPct, category) : null,
      status: pendingHere ? 'needs_grading' : (bestScore != null ? 'graded' : (list.length ? 'needs_grading' : 'not_attempted')),
      passing_line: passingLine,
      margin_percentage: marginPct,
      margin_marks: marginMarks,
      attempts: list.map(x => {
        const aRawPct = rawPercentage(x.total_score, maxMarks);
        return {
          id: x._id,
          attempt_number: x.attempt_number,
          status: x.status,
          total_score: x.total_score ?? null,
          percentage: aRawPct != null ? Math.round(aRawPct) : null,
          is_best: !!(best && x._id.toString() === best._id.toString()),
          needs_manual_grading: !!(x.needs_manual_grading && x.status === 'submitted'),
          auto_submitted: !!x.auto_submitted,
          submitted_at: x.submitted_at,
          started_at: x.started_at,
        };
      }),
    };
  });

  const rawOverallPct = anyAttempted ? rawPercentage(totalObtained, combinedMax) : null;
  const overallPercentage = rawOverallPct != null ? Math.round(rawOverallPct) : null;
  const overallMarginPct = rawOverallPct != null ? Math.round((rawOverallPct - passingLine) * 10) / 10 : null;

  return {
    course: { id: anchor.course_id._id, name: anchor.course_id.name },
    class: { id: cls._id, name: cls.name },
    student: { id: student._id, name: student.name },
    type: anchor.type,
    type_label: TYPE_TITLES[anchor.type] || anchor.type,
    term: anchor.term,
    academic_year: anchor.academic_year,
    anchor_assessment_id: anchor._id,
    module_weight: moduleWeight,
    combined_max: combinedMax,
    passing_line: passingLine,
    teachers: [...new Set(assessments.map(a => a.teacher_id?.name).filter(Boolean))],
    assessments: perAssessment,
    overall: {
      total_obtained: anyAttempted ? Math.round(totalObtained * 100) / 100 : null,
      combined_max: combinedMax,
      percentage: overallPercentage,
      marks_on_mw: anyAttempted ? scaleScore(totalObtained, combinedMax, moduleWeight) : null,
      module_weight: moduleWeight,
      decision: anyAttempted ? computeDecision(rawOverallPct, category) : null,
      status: anyPendingGrading ? 'needs_grading' : (anyAttempted ? 'graded' : 'not_attempted'),
      passing_line: passingLine,
      margin_percentage: overallMarginPct,
    },
  };
}

exports.studentGetAssessmentResult = async (req, res) => {
  try {
    const result = await buildStudentSeriesResult(req.params.id, req.user.id);
    if (!result) return res.status(404).json({ message: 'Assessment not found or not available to you.' });
    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherGetOverallResults = async (req, res) => {
  try {
    const { course_id, class_id, type, term, academic_year } = req.query;
    if (!course_id || !class_id || !type || !term || !academic_year) {
      return res.status(400).json({ message: 'course_id, class_id, type, term and academic_year are required' });
    }
    const result = await buildOverallResults(req.user.id, { course_id, class_id, type, term, academic_year });
    if (!result) return res.status(404).json({ message: 'Module or class not found' });
    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherDownloadOverallExcel = async (req, res) => {
  try {
    const { course_id, class_id, type, term, academic_year } = req.query;
    const result = await buildOverallResults(req.user.id, { course_id, class_id, type, term, academic_year });
    if (!result) return res.status(404).json({ message: 'Module or class not found' });

    const typeLabel = TYPE_TITLES[type] || type;
    const passedCount = result.rows.filter(r => r.decision === 'C').length;
    const failedCount = result.rows.filter(r => r.decision === 'NYC').length;
    const withPct = result.rows.filter(r => r.percentage != null);
    const avg = withPct.length ? Math.round(withPct.reduce((s, r) => s + r.percentage, 0) / withPct.length) : null;

    // Per-assessment columns use the same FA1/CA2-style shorthand (with its
    // max marks) as the app UI and the PDF export.
    const assessmentLabels = result.assessments.map(a => `${shorthandTitle(a.title)} /${a.max_marks}`);
    const headerLabels = ['No.', 'Name', ...assessmentLabels, `Total /${result.combined_max}`, '%', `MW /${result.module_weight}`, 'Decision'];
    const colCount = headerLabels.length;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Edupla';
    wb.created = new Date();
    const ws = wb.addWorksheet('Overall', { pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' } });
    ws.views = [{ showGridLines: false }];

    ws.columns = [
      { width: 6 },
      { width: 30 },
      ...result.assessments.map(() => ({ width: 13 })),
      { width: 13 },
      { width: 9 },
      { width: 12 },
      { width: 12 },
    ];

    let row = xlDrawBanner(ws, {
      title: `Overall — ${typeLabel}`,
      subtitle: `${result.course.name}   •   ${result.class.name}   •   ${term} ${academic_year}   •   Generated ${new Date().toLocaleDateString()}`,
    }, colCount);

    row = xlDrawStatChips(ws, row, [
      { label: 'STUDENTS', value: String(result.rows.length), color: XL_THEME.violet, bg: 'FFEEF2FF' },
      { label: 'CLASS AVERAGE', value: avg != null ? `${avg}%` : '—', color: xlPerfColor(avg), bg: 'FFEFF6FF' },
      { label: 'PASSED', value: String(passedCount), color: XL_THEME.pass, bg: XL_THEME.passBg },
      { label: 'FAILED', value: String(failedCount), color: XL_THEME.fail, bg: XL_THEME.failBg },
    ], colCount);

    const headerRowIdx = row;
    const headerRow = ws.getRow(headerRowIdx);
    headerLabels.forEach((label, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = label;
      cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: XL_THEME.headerText } };
      cell.alignment = { vertical: 'middle', horizontal: i === 1 ? 'left' : 'center', indent: i === 1 ? 1 : 0, wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_THEME.headerBg } };
      cell.border = { top: { style: 'thin', color: { argb: XL_THEME.border } }, bottom: { style: 'medium', color: { argb: XL_THEME.headerText } }, left: { style: 'thin', color: { argb: XL_THEME.border } }, right: { style: 'thin', color: { argb: XL_THEME.border } } };
    });
    headerRow.height = 30;

    result.rows.forEach((r, i) => {
      const dataRow = ws.getRow(headerRowIdx + 1 + i);
      const stripe = i % 2 === 1;
      const rowFill = stripe ? XL_THEME.stripe : XL_THEME.white;

      const setCell = (col, value, opts = {}) => {
        const cell = dataRow.getCell(col);
        cell.value = value;
        cell.font = { name: 'Calibri', size: 10.5, color: { argb: opts.color || XL_THEME.textDark }, bold: !!opts.bold };
        cell.alignment = { vertical: 'middle', horizontal: opts.align || 'center', indent: opts.indent || 0 };
        if (!opts.skipFill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg || rowFill } };
        cell.border = { top: { style: 'thin', color: { argb: XL_THEME.border } }, bottom: { style: 'thin', color: { argb: XL_THEME.border } }, left: { style: 'thin', color: { argb: XL_THEME.border } }, right: { style: 'thin', color: { argb: XL_THEME.border } } };
      };

      setCell(1, i + 1, { color: XL_THEME.textMuted });
      setCell(2, r.student_name, { align: 'left', indent: 1, bold: true });
      r.per_assessment.forEach((pa, pi) => {
        setCell(3 + pi, pa.best_score != null ? Math.round(pa.best_score) : '—', { color: pa.best_score != null ? XL_THEME.textDark : XL_THEME.muted });
      });
      const totalCol = 3 + r.per_assessment.length;
      setCell(totalCol, r.total_obtained != null ? Math.round(r.total_obtained) : '—', { bold: true });
      setCell(totalCol + 1, r.percentage != null ? `${r.percentage}%` : '—', { color: xlPerfColor(r.percentage), bold: true });
      setCell(totalCol + 2, r.marks_on_mw != null ? Math.round(r.marks_on_mw) : '—');

      const decisionCol = totalCol + 3;
      const dCell = dataRow.getCell(decisionCol);
      if (r.decision === 'C') {
        xlStyleBadgeCell(dCell, { text: 'C', color: XL_THEME.pass, bg: XL_THEME.passBg });
      } else if (r.decision === 'NYC') {
        xlStyleBadgeCell(dCell, { text: 'NYC', color: XL_THEME.fail, bg: XL_THEME.failBg });
      } else if (r.status === 'needs_grading') {
        xlStyleBadgeCell(dCell, { text: 'Needs grading', color: XL_THEME.needs, bg: XL_THEME.needsBg });
      } else {
        xlStyleBadgeCell(dCell, { text: 'Not attempted', color: XL_THEME.muted, bg: XL_THEME.mutedBg });
      }
      dCell.border = { top: { style: 'thin', color: { argb: XL_THEME.border } }, bottom: { style: 'thin', color: { argb: XL_THEME.border } }, left: { style: 'thin', color: { argb: XL_THEME.border } }, right: { style: 'thin', color: { argb: XL_THEME.border } } };

      dataRow.height = 20;
    });

    ws.autoFilter = { from: { row: headerRowIdx, column: 1 }, to: { row: headerRowIdx, column: colCount } };
    ws.views = [{ showGridLines: false, state: 'frozen', xSplit: 2, ySplit: headerRowIdx, topLeftCell: `C${headerRowIdx + 1}`, activeCell: `C${headerRowIdx + 1}` }];

    const filename = buildMarksFilename(result.course.name, `Overall ${typeLabel}s`, 'xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};

exports.teacherDownloadOverallPdf = async (req, res) => {
  try {
    const { course_id, class_id, type, term, academic_year } = req.query;
    const result = await buildOverallResults(req.user.id, { course_id, class_id, type, term, academic_year });
    if (!result) return res.status(404).json({ message: 'Module or class not found' });

    const typeLabel = TYPE_TITLES[type] || type;
    const filename = buildMarksFilename(result.course.name, `Overall ${typeLabel}s`, 'pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: result.assessments.length > 3 ? 'landscape' : 'portrait', bufferPages: true });
    doc.pipe(res);

    pdfDrawBanner(doc, {
      title: `EDUPLA - Overall — ${typeLabel}s`,
      subtitle: `${result.course.name}  •  ${result.class.name}  •  ${term} ${academic_year}`,
    });

    const passedCount = result.rows.filter(r => r.decision === 'C').length;
    const failedCount = result.rows.filter(r => r.decision === 'NYC').length;
    const withPct = result.rows.filter(r => r.percentage != null);
    const avg = withPct.length ? Math.round(withPct.reduce((s, r) => s + r.percentage, 0) / withPct.length) : null;
    pdfDrawStatChips(doc, [
      { label: 'Students', value: result.rows.length, color: '#0f766e' },
      { label: 'Class average', value: avg != null ? `${avg}%` : '—', color: '#0891b2' },
      { label: 'Passed', value: passedCount, color: PDF_THEME.pass },
      { label: 'Failed', value: failedCount, color: PDF_THEME.fail },
    ]);

    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const fixedWidth = 26 + 148 + 66 + 42 + 58 + 62; // No + Name + Total + % + MW + Decision
    const perAssessmentWidth = result.assessments.length
      ? Math.max(44, Math.floor((usableWidth - fixedWidth) / result.assessments.length))
      : 0;

    const cols = [
      { label: 'No.', width: 26, align: 'center' },
      { label: 'Name', width: 148 },
      ...result.assessments.map(a => ({ label: `${shorthandTitle(a.title)}${a.max_marks ? ` /${a.max_marks}` : ''}`, width: perAssessmentWidth, align: 'center' })),
      { label: `Total /${result.combined_max}`, width: 66, align: 'center' },
      { label: '%', width: 42, align: 'center' },
      { label: `MW /${result.module_weight}`, width: 58, align: 'center' },
      { label: 'Decision', width: 62, align: 'center' },
    ];

    const rows = result.rows.map((r, i) => {
      const decisionColIndex = cols.length - 1;
      const decisionColor = r.decision === 'C' ? PDF_THEME.pass : (r.decision === 'NYC' ? PDF_THEME.fail : undefined);
      return {
        cells: [
          i + 1, r.student_name,
          ...r.per_assessment.map(pa => pa.best_score != null ? Math.round(pa.best_score) : '—'),
          r.total_obtained != null ? Math.round(r.total_obtained) : '—',
          r.percentage != null ? `${Math.round(r.percentage)}%` : '—',
          r.marks_on_mw != null ? Math.round(r.marks_on_mw) : '—',
          r.decision || (r.status === 'not_attempted' ? 'Not attempted' : '—'),
        ],
        badges: decisionColor ? { [decisionColIndex]: decisionColor } : undefined,
      };
    });

    pdfDrawTable(doc, { cols, rows });
    pdfDrawFooter(doc, { generatedAt: new Date().toLocaleDateString() });
    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};

exports.teacherGetAttemptForGrading = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findById(req.params.attemptId)
      .populate('student_id', 'name email').lean();
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

    const assessment = await Assessment.findOne({ _id: attempt.assessment_id, teacher_id: req.user.id }).lean();
    if (!assessment) return res.status(403).json({ message: 'Access denied' });

    const questions = await AssessmentQuestion.find({ _id: { $in: attempt.question_order } }).lean();
    const qMap = {};
    questions.forEach(q => { qMap[q._id.toString()] = q; });

    const answers = attempt.question_order.map(qid => {
      const q = qMap[qid.toString()];
      const a = attempt.answers.find(x => x.question_id.toString() === qid.toString());
      return {
        question_id: qid, type: q?.type, question_text: q?.question_text, marks: q?.marks,
        options: q?.options, pairs: q?.pairs, correct_answer: q?.correct_answer,
        student_answer: a?.answer ?? null,
        auto_score: a?.auto_score ?? null,
        manual_score: a?.manual_score ?? null,
        is_correct: a?.is_correct ?? null,
      };
    });

    res.json({
      attempt: {
        id: attempt._id, status: attempt.status, total_score: attempt.total_score,
        student: attempt.student_id, submitted_at: attempt.submitted_at,
        auto_submitted: attempt.auto_submitted, auto_submit_reason: attempt.auto_submit_reason,
      },
      assessment: { id: assessment._id, title: assessment.title },
      answers,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherGradeOpenAnswers = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findById(req.params.attemptId);
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    if (attempt.voided) {
      return res.status(400).json({ message: 'This attempt was voided when the assessment was unshared and can no longer be graded.' });
    }

    const assessment = await Assessment.findOne({ _id: attempt.assessment_id, teacher_id: req.user.id }).lean();
    if (!assessment) return res.status(403).json({ message: 'Access denied' });

    const { grades } = req.body;
    if (!Array.isArray(grades)) return res.status(400).json({ message: 'Grades payload is required.' });

    const questions = await AssessmentQuestion.find({ _id: { $in: grades.map(g => g.question_id) } }).lean();
    const qMap = {};
    questions.forEach(q => { qMap[q._id.toString()] = q; });

    grades.forEach(({ question_id, manual_score }) => {
      const q = qMap[String(question_id)];
      if (!q || q.type !== 'open') return;
      const entry = attempt.answers.find(a => a.question_id.toString() === String(question_id));
      if (!entry) return;
      const clamped = Math.max(0, Math.min(Number(manual_score) || 0, q.marks));
      entry.manual_score = clamped;
      entry.is_correct = clamped > 0;
    });

    const allGraded = attempt.answers.every(a => a.auto_score != null || a.manual_score != null);
    attempt.needs_manual_grading = !allGraded;
    if (allGraded) {
      const total = attempt.answers.reduce((s, a) => s + (a.auto_score != null ? a.auto_score : a.manual_score), 0);
      attempt.total_score = Math.round(total * 100) / 100;
      attempt.status = 'graded';
      attempt.graded_by = req.user.id;
      attempt.graded_at = new Date();
    }
    await attempt.save();

    if (allGraded) {
      await recomputeAndUpsertMark(assessment, attempt.student_id);
    }

    res.json({
      message: allGraded ? 'Grading complete.' : 'Scores saved. Some open questions still need grading.',
      status: attempt.status,
      total_score: attempt.total_score,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════ TEACHER: Mark sheet exports ══════════════════ */

exports.teacherDownloadAttemptsExcel = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('class_id', 'name students').populate('course_id', 'name total_marks category').lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const students = await User.find({ _id: { $in: assessment.class_id?.students || [] } }, 'name email')
      .sort({ name: 1 }).lean();
    const attempts = await AssessmentAttempt.find({ assessment_id: assessment._id, voided: { $ne: true } }).lean();
    const byStudent = {};
    attempts.forEach(a => { const k = a.student_id.toString(); (byStudent[k] = byStudent[k] || []).push(a); });

    const totalAgg = await AssessmentQuestion.aggregate([
      { $match: { assessment_id: assessment._id } },
      { $group: { _id: null, total: { $sum: '$marks' } } },
    ]);
    const maxMarks = totalAgg[0]?.total || 0;
    const moduleWeight = assessment.course_id?.total_marks || 100;
    const category = assessment.course_id?.category || 'Complementary modules';

    const shorthand = shorthandTitle(assessment.title);
    const scoreLabel = `${shorthand} /${maxMarks}`;

    const rows = students.map((s, i) => {
      const list = byStudent[s._id.toString()] || [];
      const graded = list.filter(a => a.status === 'graded');
      const best = [...graded].sort((a, b) => b.total_score - a.total_score)[0];
      const bestScore = best ? best.total_score : null;
      const rawPct = rawPercentage(bestScore, maxMarks);
      const percentage = rawPct != null ? Math.round(rawPct) : null;
      const marksOnMw = scaleScore(bestScore, maxMarks, moduleWeight);
      const decision = best ? computeDecision(rawPct, category) : null;
      const needsGrading = list.some(a => a.needs_manual_grading && a.status === 'submitted');
      return {
        student_name: s.name || '', bestScore, percentage, marksOnMw, decision,
        status: needsGrading ? 'needs_grading' : (list.length ? 'graded' : 'not_attempted'),
      };
    });

    const passedCount = rows.filter(r => r.decision === 'C').length;
    const failedCount = rows.filter(r => r.decision === 'NYC').length;
    const withPct = rows.filter(r => r.percentage != null);
    const avg = withPct.length ? Math.round(withPct.reduce((s, r) => s + r.percentage, 0) / withPct.length) : null;

    const headerLabels = ['No.', 'Name', scoreLabel, '%', `MW /${moduleWeight}`, 'Decision'];
    const colCount = headerLabels.length;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Edupla';
    wb.created = new Date();
    const ws = wb.addWorksheet('Mark Sheet', { pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'portrait' } });
    ws.views = [{ showGridLines: false }];
    ws.columns = [{ width: 6 }, { width: 32 }, { width: 13 }, { width: 9 }, { width: 12 }, { width: 14 }];

    let row = xlDrawBanner(ws, {
      title: assessment.title || 'Assessment',
      subtitle: `${assessment.course_id?.name || ''}   •   ${assessment.class_id?.name || ''}   •   Generated ${new Date().toLocaleDateString()}`,
    }, colCount);

    row = xlDrawStatChips(ws, row, [
      { label: 'STUDENTS', value: String(students.length), color: XL_THEME.violet, bg: 'FFEEF2FF' },
      { label: 'CLASS AVERAGE', value: avg != null ? `${avg}%` : '—', color: xlPerfColor(avg), bg: 'FFEFF6FF' },
      { label: 'PASSED', value: String(passedCount), color: XL_THEME.pass, bg: XL_THEME.passBg },
      { label: 'FAILED', value: String(failedCount), color: XL_THEME.fail, bg: XL_THEME.failBg },
    ], colCount);

    const headerRowIdx = row;
    const headerRow = ws.getRow(headerRowIdx);
    headerLabels.forEach((label, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = label;
      cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: XL_THEME.headerText } };
      cell.alignment = { vertical: 'middle', horizontal: i === 1 ? 'left' : 'center', indent: i === 1 ? 1 : 0, wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_THEME.headerBg } };
      cell.border = { top: { style: 'thin', color: { argb: XL_THEME.border } }, bottom: { style: 'medium', color: { argb: XL_THEME.headerText } }, left: { style: 'thin', color: { argb: XL_THEME.border } }, right: { style: 'thin', color: { argb: XL_THEME.border } } };
    });
    headerRow.height = 30;

    rows.forEach((r, i) => {
      const dataRow = ws.getRow(headerRowIdx + 1 + i);
      const stripe = i % 2 === 1;
      const rowFill = stripe ? XL_THEME.stripe : XL_THEME.white;

      const setCell = (col, value, opts = {}) => {
        const cell = dataRow.getCell(col);
        cell.value = value;
        cell.font = { name: 'Calibri', size: 10.5, color: { argb: opts.color || XL_THEME.textDark }, bold: !!opts.bold };
        cell.alignment = { vertical: 'middle', horizontal: opts.align || 'center', indent: opts.indent || 0 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill } };
        cell.border = { top: { style: 'thin', color: { argb: XL_THEME.border } }, bottom: { style: 'thin', color: { argb: XL_THEME.border } }, left: { style: 'thin', color: { argb: XL_THEME.border } }, right: { style: 'thin', color: { argb: XL_THEME.border } } };
      };

      setCell(1, i + 1, { color: XL_THEME.textMuted });
      setCell(2, r.student_name, { align: 'left', indent: 1, bold: true });
      setCell(3, r.bestScore != null ? Math.round(r.bestScore) : '—', { bold: true, color: r.bestScore != null ? XL_THEME.textDark : XL_THEME.muted });
      setCell(4, r.percentage != null ? `${r.percentage}%` : '—', { color: xlPerfColor(r.percentage), bold: true });
      setCell(5, r.marksOnMw != null ? Math.round(r.marksOnMw) : '—');

      const dCell = dataRow.getCell(6);
      if (r.decision === 'C') {
        xlStyleBadgeCell(dCell, { text: 'C', color: XL_THEME.pass, bg: XL_THEME.passBg });
      } else if (r.decision === 'NYC') {
        xlStyleBadgeCell(dCell, { text: 'NYC', color: XL_THEME.fail, bg: XL_THEME.failBg });
      } else if (r.status === 'needs_grading') {
        xlStyleBadgeCell(dCell, { text: 'Needs grading', color: XL_THEME.needs, bg: XL_THEME.needsBg });
      } else {
        xlStyleBadgeCell(dCell, { text: 'Not attempted', color: XL_THEME.muted, bg: XL_THEME.mutedBg });
      }
      dCell.border = { top: { style: 'thin', color: { argb: XL_THEME.border } }, bottom: { style: 'thin', color: { argb: XL_THEME.border } }, left: { style: 'thin', color: { argb: XL_THEME.border } }, right: { style: 'thin', color: { argb: XL_THEME.border } } };

      dataRow.height = 20;
    });

    ws.autoFilter = { from: { row: headerRowIdx, column: 1 }, to: { row: headerRowIdx, column: colCount } };
    ws.views = [{ showGridLines: false, state: 'frozen', xSplit: 2, ySplit: headerRowIdx, topLeftCell: `C${headerRowIdx + 1}`, activeCell: `C${headerRowIdx + 1}` }];

    const filename = buildMarksFilename(assessment.course_id?.name, assessment.title || 'Assessment', 'xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};

exports.teacherDownloadAttemptsPdf = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('class_id', 'name students').populate('course_id', 'name total_marks category').lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const students = await User.find({ _id: { $in: assessment.class_id?.students || [] } }, 'name email')
      .sort({ name: 1 }).lean();
    const attempts = await AssessmentAttempt.find({ assessment_id: assessment._id, voided: { $ne: true } }).lean();
    const byStudent = {};
    attempts.forEach(a => { const k = a.student_id.toString(); (byStudent[k] = byStudent[k] || []).push(a); });

    const totalAgg = await AssessmentQuestion.aggregate([
      { $match: { assessment_id: assessment._id } },
      { $group: { _id: null, total: { $sum: '$marks' } } },
    ]);
    const maxMarks = totalAgg[0]?.total || 0;
    const moduleWeight = assessment.course_id?.total_marks || 100;
    const category = assessment.course_id?.category || 'Complementary modules';

    const filename = buildMarksFilename(assessment.course_id?.name, assessment.title || 'Assessment', 'pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    doc.pipe(res);

    pdfDrawBanner(doc, {
      title: `EDUPLA - ${assessment.title}`,
      subtitle: `${assessment.course_id?.name || ''}  •  ${assessment.class_id?.name || ''}`,
    });

    // Compute each student's best graded attempt once, up front, so the
    // pass/fail chips and the table rows are always derived from the same
    // numbers (and we're not re-sorting attempts twice per student).
    const bestByStudent = students.map(s => {
      const list = byStudent[s._id.toString()] || [];
      const graded = list.filter(a => a.status === 'graded');
      const best = [...graded].sort((a, b) => b.total_score - a.total_score)[0];
      const bestScore = best ? best.total_score : null;
      const rawPct = rawPercentage(bestScore, maxMarks);
      const decision = best ? computeDecision(rawPct, category) : null;
      return {
        student: s,
        attempted: list.length > 0,
        bestScore,
        percentage: rawPct != null ? Math.round(rawPct) : null,
        marksOnMw: scaleScore(bestScore, maxMarks, moduleWeight),
        decision,
      };
    });
    const passedCount = bestByStudent.filter(b => b.decision === 'C').length;
    const failedCount = bestByStudent.filter(b => b.decision === 'NYC').length;
    const withPct = bestByStudent.filter(b => b.percentage != null);
    const avg = withPct.length ? Math.round(withPct.reduce((s, b) => s + b.percentage, 0) / withPct.length) : null;

    pdfDrawStatChips(doc, [
      { label: 'Students', value: students.length, color: '#0f766e' },
      { label: 'Class average', value: avg != null ? `${avg}%` : '—', color: '#0891b2' },
      { label: 'Passed', value: passedCount, color: PDF_THEME.pass },
      { label: 'Failed', value: failedCount, color: PDF_THEME.fail },
    ]);

    const cols = [
      { label: 'No.', width: 28, align: 'center' },
      { label: 'Name', width: 210 },
      { label: `Score /${maxMarks}`, width: 80, align: 'center' },
      { label: '%', width: 55, align: 'center' },
      { label: `MW /${moduleWeight}`, width: 80, align: 'center' },
      { label: 'Decision', width: 68, align: 'center' },
    ];

    const rows = bestByStudent.map((b, i) => ({
      cells: [
        i + 1, b.student.name || '',
        b.bestScore != null ? Math.round(b.bestScore) : '—',
        b.percentage != null ? `${b.percentage}%` : '—',
        b.marksOnMw != null ? Math.round(b.marksOnMw) : '—',
        b.decision || (b.attempted ? '—' : 'Not attempted'),
      ],
      badges: b.decision ? { 5: b.decision === 'C' ? PDF_THEME.pass : PDF_THEME.fail } : undefined,
    }));

    pdfDrawTable(doc, { cols, rows });
    pdfDrawFooter(doc, { generatedAt: new Date().toLocaleDateString() });
    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};

/* ═══════════════════════ STUDENT: Browse / instructions ═══════════════ */

exports.studentGetSharedAssessments = async (req, res) => {
  try {
    const cls = await Class.findOne({ students: req.user.id }).lean();
    if (!cls) return res.json({ assessments: [] });

    const assessments = await Assessment.find({ class_id: cls._id, mode: 'quiz', is_shared: true })
      .populate('course_id', 'name code total_marks category')
      .populate('teacher_id', 'name')
      .sort({ shared_at: -1 })
      .lean();

    const enriched = await Promise.all(assessments.map(async a => {
      const attempts = await AssessmentAttempt.find({ assessment_id: a._id, student_id: req.user.id, voided: { $ne: true } }).lean();
      const graded = attempts.filter(x => x.status === 'graded');
      const best = [...graded].sort((x, y) => y.total_score - x.total_score)[0];
      const inProgress = attempts.find(x => x.status === 'in_progress');
      const expired = a.expires_at ? new Date() > new Date(a.expires_at) : false;
      // Shared and visible, but the teacher-set start time hasn't arrived
      // yet — students can see it and read the instructions, they just
      // can't start an attempt until then.
      const notYetAvailable = a.available_from ? new Date() < new Date(a.available_from) : false;
      const attemptsUsed = attempts.length;
      const bestScore = best ? best.total_score : null;
      const moduleWeight = a.course_id?.total_marks || 100;
      const rawPct = rawPercentage(bestScore, a.max_marks);
      const percentage = rawPct != null ? Math.round(rawPct) : null;
      const myMaxAttempts = effectiveMaxAttempts(a, req.user.id);
      return {
        ...a, id: a._id,
        module_name: a.course_id?.name,
        teacher_name: a.teacher_id?.name,
        max_attempts: myMaxAttempts,
        attempts_used: attemptsUsed,
        attempts_left: Math.max(myMaxAttempts - attemptsUsed, 0),
        expired,
        not_yet_available: notYetAvailable,
        // A resumed in-progress attempt is always allowed through, regardless
        // of available_from — that gate only applies to STARTING a new one.
        can_start: !expired && !notYetAvailable && myMaxAttempts - attemptsUsed > 0,
        in_progress_attempt_id: inProgress ? inProgress._id : null,
        best_score: bestScore,
        module_weight: moduleWeight,
        marks_on_mw: scaleScore(bestScore, a.max_marks, moduleWeight),
        percentage,
        decision: best ? computeDecision(rawPct, a.course_id?.category || 'Complementary modules') : null,
        has_pending_grading: attempts.some(x => x.needs_manual_grading),
      };
    }));

    res.json({ assessments: enriched });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.studentGetAssessmentInstructions = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, mode: 'quiz', is_shared: true })
      .populate('course_id', 'name')
      .populate('teacher_id', 'name')
      .lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found or not shared.' });

    const cls = await Class.findOne({ _id: assessment.class_id, students: req.user.id }).lean();
    if (!cls) return res.status(403).json({ message: 'This assessment is not available to you.' });

    const questions = await AssessmentQuestion.find({ assessment_id: assessment._id }).lean();
    const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);
    const attemptsUsed = await AssessmentAttempt.countDocuments({ assessment_id: assessment._id, student_id: req.user.id, voided: { $ne: true } });
    const inProgress = await AssessmentAttempt.findOne({
      assessment_id: assessment._id, student_id: req.user.id, status: 'in_progress', voided: { $ne: true },
    }).lean();

    const myMaxAttempts = effectiveMaxAttempts(assessment, req.user.id);
    res.json({
      id: assessment._id,
      title: assessment.title,
      module_name: assessment.course_id?.name,
      teacher_name: assessment.teacher_id?.name,
      instructions: assessment.instructions,
      duration_minutes: assessment.duration_minutes,
      max_attempts: myMaxAttempts,
      attempts_used: attemptsUsed,
      attempts_left: Math.max(myMaxAttempts - attemptsUsed, 0),
      available_from: assessment.available_from,
      not_yet_available: assessment.available_from ? new Date() < new Date(assessment.available_from) : false,
      expires_at: assessment.expires_at,
      expired: assessment.expires_at ? new Date() > new Date(assessment.expires_at) : false,
      question_count: questions.length,
      total_marks: totalMarks,
      in_progress_attempt_id: inProgress ? inProgress._id : null,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════ STUDENT: Attempt lifecycle ═══════════════════ */

exports.studentStartAttempt = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, mode: 'quiz', is_shared: true })
      .populate('course_id', 'name');
    if (!assessment) return res.status(404).json({ message: 'Assessment not found or not shared.' });

    const cls = await Class.findOne({ _id: assessment.class_id, students: req.user.id }).lean();
    if (!cls) return res.status(403).json({ message: 'This assessment is not available to you.' });

    if (assessment.expires_at && new Date() > new Date(assessment.expires_at)) {
      return res.status(400).json({ message: 'This assessment has expired.' });
    }

    // Resume an in-progress attempt still within its time window instead of
    // burning a fresh attempt on every page load/refresh. This is allowed
    // even before available_from would otherwise permit a fresh start — an
    // attempt already under way must keep respecting only its own due_at.
    const existing = await AssessmentAttempt.findOne({
      assessment_id: assessment._id, student_id: req.user.id, status: 'in_progress', voided: { $ne: true },
    });
    if (existing) {
      if (new Date() < new Date(existing.due_at)) {
        return res.json(await buildAttemptPayload(existing, assessment));
      }
      // Time ran out but the client never called auto-submit (e.g. the tab
      // was closed) — finalize it now before deciding on a new attempt.
      await finalizeAttemptSubmission(existing, { autoSubmitted: true, reason: 'timeout' });
    }

    // The assessment is shared and visible, but the teacher-set start time
    // hasn't arrived yet — block a fresh attempt until then. This is
    // enforced server-side (not just hidden in the UI) since a student could
    // otherwise hit this endpoint directly.
    if (assessment.available_from && new Date() < new Date(assessment.available_from)) {
      return res.status(400).json({
        message: `This assessment isn't open yet. It becomes available on ${new Date(assessment.available_from).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.`,
      });
    }

    // Attempts still count towards the assessment's max_attempts (only real,
    // non-voided ones), but the attempt_number itself must stay unique
    // against EVERY attempt ever created for this student — including ones
    // voided by a prior unshare — since attempt_number is part of a unique
    // index and old attempt numbers are never reused.
    const myMaxAttempts = effectiveMaxAttempts(assessment, req.user.id);
    const attemptsUsed = await AssessmentAttempt.countDocuments({ assessment_id: assessment._id, student_id: req.user.id, voided: { $ne: true } });
    if (attemptsUsed >= myMaxAttempts) {
      return res.status(400).json({ message: 'You have used all your attempts for this assessment.' });
    }
    const totalAttemptsEver = await AssessmentAttempt.countDocuments({ assessment_id: assessment._id, student_id: req.user.id });

    const questions = await AssessmentQuestion.find({ assessment_id: assessment._id }).sort({ order: 1 }).lean();
    if (!questions.length) return res.status(400).json({ message: 'This assessment has no questions yet.' });

    // Shuffle only matters (and only needs to differ per attempt) when more
    // than one attempt is allowed.
    const ordered = myMaxAttempts > 1 ? shuffleArray(questions) : questions;

    const now = new Date();
    const dueAt = new Date(now.getTime() + (assessment.duration_minutes || 30) * 60000);

    const attempt = await AssessmentAttempt.create({
      assessment_id: assessment._id,
      student_id: req.user.id,
      attempt_number: totalAttemptsEver + 1,
      question_order: ordered.map(q => q._id),
      answers: ordered.map(q => ({ question_id: q._id, answer: null })),
      started_at: now,
      due_at: dueAt,
      status: 'in_progress',
    });

    res.status(201).json(await buildAttemptPayload(attempt, assessment, ordered));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.studentGetAttempt = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findOne({ _id: req.params.attemptId, student_id: req.user.id });
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

    const assessment = await Assessment.findById(attempt.assessment_id).populate('course_id', 'name total_marks category').lean();

    if (attempt.status !== 'in_progress') {
      return res.json({ ended: true, ...buildResultPayload(assessment, attempt) });
    }
    if (new Date() >= new Date(attempt.due_at)) {
      await finalizeAttemptSubmission(attempt, { autoSubmitted: true, reason: 'timeout' });
      return res.json({ ended: true, auto_submitted: true, ...buildResultPayload(assessment, attempt) });
    }
    res.json(await buildAttemptPayload(attempt, assessment));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.studentSaveAnswer = async (req, res) => {
  try {
    const { question_id, answer } = req.body;
    const attempt = await AssessmentAttempt.findOne({ _id: req.params.attemptId, student_id: req.user.id });
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    if (attempt.status !== 'in_progress') return res.status(400).json({ message: 'This attempt has already ended.' });
    if (new Date() >= new Date(attempt.due_at)) return res.status(400).json({ message: 'Time is up.' });

    const entry = attempt.answers.find(a => a.question_id.toString() === String(question_id));
    if (!entry) return res.status(400).json({ message: 'Question not part of this attempt.' });
    entry.answer = answer;
    await attempt.save();
    res.json({ saved: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.studentSubmitAttempt = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findOne({ _id: req.params.attemptId, student_id: req.user.id });
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ message: 'This attempt has already been submitted.' });
    }

    const incoming = Array.isArray(req.body.answers) ? req.body.answers : [];
    incoming.forEach(({ question_id, answer }) => {
      const entry = attempt.answers.find(a => a.question_id.toString() === String(question_id));
      if (entry) entry.answer = answer;
    });

    await finalizeAttemptSubmission(attempt, { autoSubmitted: false });
    const assessment = await Assessment.findById(attempt.assessment_id).populate('course_id', 'name total_marks category').lean();
    res.json({ message: 'Assessment submitted.', ...buildResultPayload(assessment, attempt) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* Called by the client automatically when the timer hits zero, or when the
   student leaves the full-screen exam window (blur / visibility change /
   exits full screen). Idempotent — a second call just reports the result. */
exports.studentAutoSubmitAttempt = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findOne({ _id: req.params.attemptId, student_id: req.user.id });
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    if (attempt.status !== 'in_progress') {
      const assessment = await Assessment.findById(attempt.assessment_id).populate('course_id', 'name total_marks category').lean();
      return res.json({ message: 'Already submitted.', ...buildResultPayload(assessment, attempt) });
    }

    const reason = req.body.reason === 'left_screen' ? 'left_screen' : 'timeout';
    const incoming = Array.isArray(req.body.answers) ? req.body.answers : [];
    incoming.forEach(({ question_id, answer }) => {
      const entry = attempt.answers.find(a => a.question_id.toString() === String(question_id));
      if (entry) entry.answer = answer;
    });

    await finalizeAttemptSubmission(attempt, { autoSubmitted: true, reason });
    const assessment = await Assessment.findById(attempt.assessment_id).populate('course_id', 'name total_marks category').lean();
    res.json({
      message: reason === 'left_screen'
        ? 'You left the assessment screen, so it was submitted automatically.'
        : 'Time was up, so the assessment was submitted automatically.',
      reason,
      ...buildResultPayload(assessment, attempt),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};