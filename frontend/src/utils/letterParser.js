/**
 * letterParser.js — turns the plain text of an announcement into the parts of
 * a formal letter, so it can be laid out nicely without teachers having to
 * learn any markup.
 *
 * What it recognises (English, French and Kinyarwanda wording):
 *   - a salutation:             "Dear Students,"
 *   - sections:                 "📌 How to access the homework: …"   (emoji optional)
 *   - numbered steps:           sections whose heading says "how to / steps / instructions"
 *   - key facts:                "⏰ Submission deadline: 16/10/2026 at 11:59 PM"
 *   - notices:                  "⚠️ Important: …"
 *   - bullet / numbered lists:  lines starting with "-", "•", "*", "1."
 *   - a closing line:           "Thank you, and best of luck!"
 *   - everything else is a normal paragraph.
 *
 * Works whether the text has proper line breaks or has been squashed into a
 * single paragraph (emoji markers are used as break points in that case).
 * Output is plain data — the UI renders it as React text, never as HTML.
 */

const EMOJI_RUN = /^((?:\p{Extended_Pictographic}[\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]*)+)\s*/u;

const SALUTATION = /^\s*((?:dear|hello|hi|greetings|good\s+(?:morning|afternoon|evening)|cher|ch[eè]re|chers|ch[eè]res|bonjour|bonsoir|muraho|mwiriwe|bakundwa|banyeshuri)\b[^,\n!:]{0,70}[,!:]?)\s*/i;

const CLOSING = /^(thank you|thanks|many thanks|best of luck|good luck|best regards|kind regards|warm regards|regards|sincerely|yours|best wishes|merci|cordialement|bien [àa] vous|bonne chance|murakoze|mugire amahoro|amahirwe)/i;
const SIGNOFF_ENDING = /(regards|sincerely|yours|best wishes|cordialement|bien [àa] vous|murakoze)[\s,.!]*$/i;

const WARNING_EMOJI = /[⚠❗‼🚨⛔🚫]/u;
const WARNING_HEAD = /^(important|note|warning|attention|reminder|notice|nb|n\.b|remarque|rappel|icyitonderwa|ibuka)\b/i;
const FACT_EMOJI = /[⏰⏳📅🗓🕒🕐🕑🕓🕔🕕📆📍]/u;
const FACT_HEAD = /(deadline|due\s*date|due|date|time|venue|location|when|where|schedule|room|duration|[ée]ch[ée]ance|date limite|heure|lieu|salle|itariki|igihe|ahantu|isaha)/i;
const STEPS_HEAD = /(how to|steps?|instructions?|procedure|process|follow|guide|comment|[ée]tapes?|uko)/i;

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
  if (i > 0 && i <= 80) {
    const head = body.slice(0, i);
    if (!/[.!?]/.test(head)) return { heading: head.trim(), rest: body.slice(i + 1).trim() };
  }
  return { heading: null, rest: body.trim() };
}

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
  if (heading && rest) return { type: 'section', emoji, heading, text: rest };
  if (heading && !rest) return { type: 'section', emoji, heading, text: '' };
  return { type: 'paragraph', emoji, text: body };
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

  // Line by line: group bullet lists, split the rest at emoji markers.
  const blocks = [];
  let list = null;
  const flush = () => { if (list) { blocks.push(list); list = null; } };
  for (const line of text.split('\n')) {
    const l = line.trim();
    if (!l) { flush(); continue; }
    if (isBullet(l) || isNumbered(l)) {
      const ordered = isNumbered(l);
      if (!list || list.ordered !== ordered) { flush(); list = { type: 'list', ordered, items: [] }; }
      list.items.push(stripBullet(l));
      continue;
    }
    flush();
    // "…done. 📌 Next part" → break before the emoji marker (not for inline emoji).
    // An emoji also starts a new part when it is followed by a "Heading:" (even with no full stop before it).
    const pieces = l
      .replace(/([.!?:])\s+(?=\p{Extended_Pictographic})/gu, '$1\u0001')
      .replace(/\s+(?=(?:\p{Extended_Pictographic}[\uFE0F\u200D]*)+\s*[^.!?:\n]{1,80}:)/gu, '\u0001')
      .split('\u0001');
    for (const p of pieces) if (p.trim()) blocks.push(classify(p.trim()));
  }
  flush();

  // The closing: from the first "Thank you / Best regards …" sentence of the last block onwards.
  let closing = null;
  const last = blocks[blocks.length - 1];
  const textOf = (b) => (b.type === 'steps' || b.type === 'list') ? null : (b.type === 'fact' ? null : b.text);
  if (last && textOf(last) != null) {
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