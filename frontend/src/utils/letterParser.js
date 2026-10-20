/**
 * letterParser.js — turns the plain text of an announcement into the parts of
 * a formal letter, so it can be laid out neatly without teachers having to
 * learn any markup.
 *
 * What it recognises (English, French and Kinyarwanda wording):
 *   - a salutation:            "Dear Students,"
 *   - a heading line:          "How to access the homework:"  (an emoji in front is optional)
 *       followed by its lines  →  numbered steps ("how to / steps / instructions")
 *                                 or a bullet list, or a single paragraph
 *   - key facts:               "Submission deadline: 16/10/2026 at 11:59 PM"
 *   - notices:                 "Important: …" / "Note: …"
 *   - bullet / numbered lists: lines starting with "-", "•", "*", "1."
 *   - a closing line:          "Thank you, and best of luck!"
 *   - everything else is a normal paragraph.
 *
 * Works whether the text has proper line breaks or has been squashed into one
 * paragraph (emoji markers are then used as break points).
 * Output is plain data — the UI renders it as React text, never as HTML.
 */

const EMOJI_RUN = /^((?:\p{Extended_Pictographic}[\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]*)+)\s*/u;

const SALUTATION = /^\s*((?:dear|hello|hi|greetings|good\s+(?:morning|afternoon|evening)|cher|ch[eè]re|chers|ch[eè]res|bonjour|bonsoir|muraho|mwiriwe|bakundwa|banyeshuri)\b[^,\n!:]{0,70}[,!:]?)\s*/i;

const CLOSING = /^(thank you|thanks|many thanks|best of luck|good luck|we wish|best regards|kind regards|warm regards|regards|sincerely|yours|best wishes|merci|cordialement|bien [àa] vous|bonne chance|nous vous souhaitons|murakoze|mugire amahoro|amahirwe|turabifuriza)/i;
const SIGNOFF_ENDING = /(regards|sincerely|yours|best wishes|cordialement|bien [àa] vous|murakoze|mugire amahoro)[\s,.!]*$/i;

const WARNING_EMOJI = /[⚠❗‼🚨⛔🚫]/u;
const WARNING_HEAD = /^(important|note|warning|attention|reminder|notice|nb|n\.b|remarque|rappel|icyitonderwa|ibuka)\b/i;
const FACT_EMOJI = /[⏰⏳📅🗓🕒🕐🕑🕓🕔🕕📆📍]/u;
const FACT_HEAD = /(deadline|due\s*date|due|date|time|venue|location|when|where|schedule|room|duration|period|[ée]ch[ée]ance|date limite|heure|lieu|salle|p[ée]riode|itariki|igihe|ahantu|isaha)/i;
const STEPS_HEAD = /(how to|steps?|instructions?|procedure|process|follow|guide|comment|consignes?|[ée]tapes?|uko|amabwiriza)/i;

const isBullet = (line) => /^\s*[-*•–]\s+/.test(line);
const isNumbered = (line) => /^\s*\d+[.)]\s+/.test(line);
const stripBullet = (line) => line.replace(/^\s*(?:[-*•–]|\d+[.)])\s+/, '').trim();

// Sentences, without lookbehind (older Safari) and without breaking "11:59 PM."
function sentences(text) {
  const m = text.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g);
  return (m || [text]).map(s => s.trim()).filter(Boolean);
}

function splitHeading(body) {
  const i = body.indexOf(':');
  // The colon must end a label: followed by a space (or the end) and not part of a time like "10:30".
  if (i > 0 && i <= 80 && (i === body.length - 1 || /\s/.test(body[i + 1]))) {
    const head = body.slice(0, i);
    if (!/[.!?]/.test(head) && !/\d$/.test(head)) return { heading: head.trim(), rest: body.slice(i + 1).trim() };
  }
  return { heading: null, rest: body.trim() };
}

// "📌 How to access the homework:"  → a heading with nothing after the colon.
function headingOnly(piece) {
  const em = piece.match(EMOJI_RUN);
  const body = (em ? piece.slice(em[0].length) : piece).trim();
  if (!body.endsWith(':')) return null;
  const head = body.slice(0, -1).trim();
  if (!head || head.length > 80 || /[.!?:]/.test(head)) return null;
  return { emoji: em ? em[1] : null, heading: head };
}

// One line (or one emoji-delimited piece of a squashed paragraph).
function classify(text) {
  const em = text.match(EMOJI_RUN);
  const emoji = em ? em[1] : null;
  const body = em ? text.slice(em[0].length) : text;
  const { heading, rest } = splitHeading(body);
  const sents = sentences(rest);

  const warning = (emoji && WARNING_EMOJI.test(emoji)) || (heading && WARNING_HEAD.test(heading));
  if (warning) return { type: 'warning', emoji, heading: heading || null, text: heading ? rest : body };

  const factish = heading && ((emoji && FACT_EMOJI.test(emoji)) || FACT_HEAD.test(heading));
  if (factish && sents.length <= 2 && rest.length > 0 && rest.length <= 120) {
    return { type: 'fact', emoji, label: heading, value: rest.replace(/[.\s]+$/, '') };
  }

  if (heading && STEPS_HEAD.test(heading) && sents.length >= 2) {
    return { type: 'steps', emoji, heading, items: sents };
  }
  // A "Heading: text" part only becomes a section when it was marked with an emoji;
  // otherwise "Choose your module: X" is just a sentence.
  if (heading && emoji) return { type: 'section', emoji, heading, text: rest };
  // "What to bring: pen and card." → a bold label followed by its text.
  if (heading && rest && heading.length <= 40) return { type: 'labelled', emoji, label: heading, text: rest };
  return { type: 'paragraph', emoji, text: body };
}

// A heading line plus the lines that followed it.
function finishGroup(g) {
  const { heading, emoji, lines } = g;
  if (WARNING_HEAD.test(heading)) return { type: 'warning', emoji, heading, text: lines.join(' ') };
  if (lines.length === 1 && FACT_HEAD.test(heading) && lines[0].length <= 120) {
    return { type: 'fact', emoji, label: heading, value: lines[0].replace(/[.\s]+$/, '') };
  }
  if (STEPS_HEAD.test(heading) && lines.length >= 1) return { type: 'steps', emoji, heading, items: lines };
  if (lines.length > 1) return { type: 'section', emoji, heading, items: lines, ordered: false };
  return { type: 'section', emoji, heading, text: lines[0] || '' };
}

export function parseLetter(raw) {
  let text = String(raw || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return { salutation: null, blocks: [], closing: null, hasSignoff: false };

  let salutation = null;
  const sm = text.match(SALUTATION);
  if (sm) {
    salutation = sm[1].trim();
    if (!/[,!:]$/.test(salutation)) salutation += ',';
    text = text.slice(sm[0].length);
  }

  const blocks = [];
  let list = null;      // bullet / numbered list being collected
  let group = null;     // heading line waiting for its lines
  const flushList = () => { if (list) { blocks.push(list); list = null; } };
  const flushGroup = () => { if (group) { blocks.push(finishGroup(group)); group = null; } };

  for (const line of text.split('\n')) {
    const l = line.trim();
    if (!l) { flushList(); flushGroup(); continue; }

    if (isBullet(l) || isNumbered(l)) {
      if (group) { group.lines.push(stripBullet(l)); continue; }
      const ordered = isNumbered(l);
      if (!list || list.ordered !== ordered) { flushList(); list = { type: 'list', ordered, items: [] }; }
      list.items.push(stripBullet(l));
      continue;
    }
    flushList();

    // "…done. 📌 Next part" → break before the emoji marker (not for an emoji inside a sentence).
    // An emoji also starts a new part when it is followed by a "Heading:".
    const pieces = l
      .replace(/([.!?:])\s+(?=\p{Extended_Pictographic})/gu, '$1\u0001')
      .replace(/\s+(?=(?:\p{Extended_Pictographic}[\uFE0F\u200D]*)+\s*[^.!?:\n]{1,80}:)/gu, '\u0001')
      .split('\u0001');

    pieces.forEach((piece, i) => {
      const p = piece.trim();
      if (!p) return;
      const startsWithEmoji = EMOJI_RUN.test(p);
      const head = headingOnly(p);
      // A plain line right under a heading belongs to that heading.
      if (group && i === 0 && !startsWithEmoji && !head) { group.lines.push(p); return; }
      flushGroup();
      if (head) { group = { ...head, lines: [] }; return; }
      blocks.push(classify(p));
    });
  }
  flushList();
  flushGroup();

  // The closing: from the first "Thank you / Best regards …" sentence of the last block onwards.
  let closing = null;
  const last = blocks[blocks.length - 1];
  if (last && (last.type === 'paragraph' || last.type === 'warning' || last.type === 'labelled' || (last.type === 'section' && last.text))) {
    const s = sentences(last.text);
    const k = s.findIndex(x => CLOSING.test(x));
    if (k === 0 && !last.heading) { closing = s.join(' '); blocks.pop(); }
    else if (k > 0) { closing = s.slice(k).join(' '); last.text = s.slice(0, k).join(' '); }
  }

  return { salutation, blocks, closing, hasSignoff: !!(closing && SIGNOFF_ENDING.test(closing)) };
}

// Plain-text version, used for short previews (notifications, search results).
export function letterSummary(raw, max = 140) {
  const flat = String(raw || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}