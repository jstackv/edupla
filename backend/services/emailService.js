const nodemailer = require('nodemailer');

// ── Transporter ────────────────────────────────────────────────────────────
function createTransporter() {
  const required = { EMAIL_HOST: process.env.EMAIL_HOST, EMAIL_USER: process.env.EMAIL_USER, EMAIL_PASS: process.env.EMAIL_PASS };
  const missing = Object.keys(required).filter((k) => !required[k]);
  if (missing.length) {
    console.warn(`⚠️  Email not configured — missing ${missing.join(', ')} in .env. No welcome/assignment/assessment/announcement/account-status emails will be sent until ${missing.length > 1 ? 'these are' : 'this is'} set.`);
    return null;
  }
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    // Port 465 is implicit-TLS; everything else (587/25) starts plain and upgrades via STARTTLS.
    secure: process.env.EMAIL_SECURE === 'true' || port === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    // The API runs as a serverless function: a hung SMTP connection must fail fast
    // instead of holding the request (and the function) open until the platform kills it.
    connectionTimeout: 10000,
    greetingTimeout:   10000,
    socketTimeout:     20000,
  });
}

const FROM    = () => process.env.EMAIL_FROM   || '"EDUPLA" <no-reply@edupla.app>';
const APP_URL = () => process.env.APP_URL       || 'https://edupla.vercel.app';

// ── Brand palette — light "welcome card" theme ─────────────────────────────
// A white card on a soft grey-blue page, an orange logo header, an orange
// envelope hero (glow + sparkles), bold centred title, a solid orange CTA
// with a sweeping shine, and peach icon circles — the EDUPLA onboarding look.
// Animations are CSS keyframes: clients that support them (Apple Mail, iOS
// Mail, Samsung Mail, most webmail "view in browser") play them; everything
// else simply shows the finished, static design.
const BRAND = {
  pageBg:        '#ebeef3',
  cardBg:        '#fcfcfc',
  cardBorder:    '#e4e8ed',
  headerBorder:  '#eceef2',
  ticketBg:      '#f7f8fa',
  ticketBorder:  '#e4e8ed',
  rowDivider:    '#e9ecf0',
  dashDivider:   '#cfd4dc',
  chipBg:        '#f4f5f8',
  chipBorder:    '#dfe3e9',
  textPrimary:   '#111424',
  textSecondary: '#5d6475',
  textMuted:     '#8b91a1',
  accent:        '#ff5c1b',
  accentBright:  '#fd8d5c',
  accentDeep:    '#e8470f',
  peach:         '#ffe1d5',
  peachSoft:     '#fff1ea',
  amber:         '#b45309',
  onAccent:      '#ffffff',
  successText:   '#15803d', successBg: '#ecfdf3', successBorder: '#b7ebcb', successRing: 'rgba(22,163,74,0.20)',
  dangerText:    '#dc2626', dangerBg: '#fef2f2', dangerBorder: '#fecaca', dangerRing: 'rgba(239,68,68,0.20)',
  accentRing:    'rgba(255,92,27,0.22)',
};

const FONT = "'Poppins','Segoe UI',Helvetica,Arial,sans-serif";

const STATUS = {
  success: { solid: '#16a34a', soft: '#dcfce7', text: BRAND.successText, ring: BRAND.successRing, chip: BRAND.successBg, chipBorder: BRAND.successBorder, hero: 'orange' },
  danger:  { solid: '#ef4444', soft: '#fee2e2', text: BRAND.dangerText,  ring: BRAND.dangerRing,  chip: BRAND.dangerBg,  chipBorder: BRAND.dangerBorder,  hero: 'red' },
  accent:  { solid: BRAND.accent, soft: BRAND.peach, text: BRAND.accentDeep, ring: BRAND.accentRing, chip: BRAND.peachSoft, chipBorder: '#ffd2bf', hero: 'orange' },
};

// Envelope colours. Welcome / success / info mails use the brand orange;
// a deactivation uses red so the bad news is visible before it is read.
const HERO = {
  orange: { body: '#ff5c1b', light: '#ff8a57', flap: '#e8470f', glow: 'rgba(255,92,27,0.17)', shadow: 'rgba(232,71,15,0.50)', star: '#ff5c1b' },
  red:    { body: '#ef4444', light: '#f87171', flap: '#c92a2a', glow: 'rgba(239,68,68,0.15)', shadow: 'rgba(201,42,42,0.45)', star: '#ef4444' },
};

// Text glyphs (orange line-icon feel) instead of colour emoji. U+FE0E forces
// text presentation so the glyph takes the surrounding colour.
const GLYPH = { '📋': '✎', '📄': '❐', '📣': '✉', '📝': '✓', '🔑': '✱', '🎓': '✦' };
function glyph(g) {
  if (g == null) return '';
  const mapped = GLYPH[g] || g;
  const code = String(mapped).codePointAt(0);
  return code >= 0x2190 && code <= 0x2BFF ? mapped + '︎' : mapped;
}

// ── HTML shell ─────────────────────────────────────────────────────────────
function envelopeHero({ icon, status }) {
  const s = STATUS[status] || STATUS.accent;
  const h = HERO[s.hero];
  const star = (ch, size, delay, align, pad) =>
    `<div class="edu-star" style="font-size:${size}px;line-height:1;color:${h.star};text-align:${align};padding:${pad};animation-delay:${delay}s;">${ch}</div>`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 auto 4px;">
    <tr>
      <td width="25%" align="right" valign="top" style="padding-top:34px;">
        ${star('✦︎', 16, 0.2, 'right', '0 6px 34px 0')}
        ${star('✧︎', 11, 1.1, 'right', '0 30px 0 0')}
      </td>
      <td width="50%" align="center" valign="middle">
        <table class="edu-glow" role="presentation" width="190" height="190" cellpadding="0" cellspacing="0" style="margin:0 auto;border-radius:50%;background:radial-gradient(circle at 50% 50%, ${h.glow} 0%, ${h.glow} 38%, rgba(255,255,255,0) 70%);">
          <tr><td align="center" valign="middle">
            <table class="edu-env" role="presentation" width="128" cellpadding="0" cellspacing="0" bgcolor="${h.body}" style="margin:0 auto;border-radius:14px;background-color:${h.body};background-image:linear-gradient(165deg, ${h.light} 0%, ${h.body} 58%);box-shadow:0 20px 30px -14px ${h.shadow};">
              <tr><td style="padding:0;line-height:0;font-size:0;height:52px;">
                <div style="width:0;height:0;border-left:64px solid transparent;border-right:64px solid transparent;border-top:52px solid ${h.flap};line-height:0;font-size:0;border-radius:14px 14px 0 0;"></div>
              </td></tr>
              <tr><td align="center" style="padding:0 0 22px;height:44px;">
                <div style="margin:-27px auto 0;width:46px;height:46px;border-radius:50%;background:#ffffff;line-height:46px;font-size:21px;font-weight:800;color:${h.body};text-align:center;font-family:${FONT};box-shadow:0 8px 14px -6px rgba(17,20,36,0.35);">${glyph(icon)}</div>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td>
      <td width="25%" align="left" valign="bottom" style="padding-bottom:30px;">
        ${star('✧︎', 12, 0.6, 'left', '0 0 30px 26px')}
        ${star('✦︎', 18, 1.5, 'left', '0 0 0 8px')}
      </td>
    </tr>
  </table>`;
}

function wrapEmail({ title, preheader, body, badge, icon = '✓', status = 'accent' }) {
  const s = STATUS[status] || STATUS.accent;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="color-scheme" content="light only"/><meta name="supported-color-schemes" content="light only"/>
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  @keyframes eduFadeUp {
    0%   { opacity: 0; transform: translateY(18px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes eduPop {
    0%   { transform: scale(0.55) rotate(-6deg); opacity: 0; }
    60%  { transform: scale(1.08) rotate(2deg); opacity: 1; }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  @keyframes eduFloat {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-6px); }
  }
  @keyframes eduGlow {
    0%, 100% { transform: scale(1);    opacity: 1; }
    50%      { transform: scale(1.07); opacity: 0.75; }
  }
  @keyframes eduTwinkle {
    0%, 100% { opacity: 0.25; transform: scale(0.8) rotate(0deg); }
    50%      { opacity: 1;    transform: scale(1.2) rotate(18deg); }
  }
  @keyframes eduShine {
    0%        { background-position: 100% 0; }
    55%, 100% { background-position: 0% 0; }
  }
  @keyframes eduRow {
    0%   { opacity: 0; transform: translateX(-10px); }
    100% { opacity: 1; transform: translateX(0); }
  }
  .edu-card  { animation: eduFadeUp 0.7s cubic-bezier(.2,.8,.2,1) both; }
  .edu-glow  { animation: eduGlow 3.2s ease-in-out 0.8s infinite; }
  .edu-env   { animation: eduPop 0.8s cubic-bezier(.34,1.56,.64,1) 0.15s both, eduFloat 3s ease-in-out 1s infinite; }
  .edu-star  { animation: eduTwinkle 2.4s ease-in-out infinite; }
  .edu-cta   { animation: eduShine 3s ease-in-out 1.2s infinite; }
  .edu-row   { animation: eduRow 0.6s ease-out both; }
  .edu-row:nth-child(2) { animation-delay: 0.45s; }
  .edu-row:nth-child(3) { animation-delay: 0.6s; }
  .edu-row:nth-child(4) { animation-delay: 0.75s; }
  @media (prefers-reduced-motion: reduce) {
    .edu-card, .edu-glow, .edu-env, .edu-star, .edu-cta, .edu-row { animation: none !important; }
  }
  @media only screen and (max-width: 520px) {
    .edu-pad { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};font-family:${FONT};">
  <span style="display:none;max-height:0;overflow:hidden;color:${BRAND.pageBg};">${preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="${BRAND.pageBg}" style="background:${BRAND.pageBg};padding:40px 14px;font-family:${FONT};">
    <tr><td align="center">
      <table class="edu-card" width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">

        <tr>
          <td style="border-radius:18px;box-shadow:0 24px 60px -24px rgba(17,20,36,0.28);">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="${BRAND.cardBg}" style="background:${BRAND.cardBg};border:1px solid ${BRAND.cardBorder};border-radius:18px;">

              <!-- Header: logo + link -->
              <tr>
                <td class="edu-pad" style="padding:20px 32px;border-bottom:1px solid ${BRAND.headerBorder};">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
                    <td align="left" valign="middle">${brandLockup()}</td>
                    <td align="right" valign="middle"><a href="${APP_URL()}" style="color:${BRAND.accent};font-size:12.5px;font-weight:600;text-decoration:none;font-family:${FONT};">Open EDUPLA</a></td>
                  </tr></table>
                </td>
              </tr>

              <!-- Hero: envelope + title -->
              <tr>
                <td class="edu-pad" align="center" style="padding:30px 32px 6px;text-align:center;">
                  ${envelopeHero({ icon, status })}
                  <h1 style="margin:8px 0 0;font-size:27px;line-height:1.25;font-weight:800;color:${BRAND.textPrimary};letter-spacing:-0.01em;font-family:${FONT};">${title}</h1>
                  ${badge ? `<div style="margin-top:14px;">${badge}</div>` : ''}
                </td>
              </tr>

              <!-- Body -->
              <tr><td class="edu-pad" style="padding:20px 32px 38px;text-align:center;font-family:${FONT};">${body}</td></tr>

            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 12px 0;text-align:center;font-family:${FONT};">
            <p style="margin:0 0 4px;font-size:11px;color:${BRAND.textMuted};">You received this email because you have an account on EDUPLA.</p>
            <p style="margin:0;font-size:11px;"><a href="${APP_URL()}" style="color:${BRAND.accent};font-weight:600;text-decoration:none;">Open EDUPLA</a> <span style="color:${BRAND.textMuted};">· automated notification, please don't reply</span></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

function badgeChip(text, status = 'accent') {
  const s = STATUS[status] || STATUS.accent;
  return `<span style="display:inline-block;padding:6px 16px;background:${s.chip};border:1px solid ${s.chipBorder};border-radius:999px;font-size:10.5px;font-weight:700;color:${s.text};letter-spacing:0.07em;text-transform:uppercase;font-family:${FONT};">${text}</span>`;
}

// Primary call-to-action: solid orange, uppercase, with a glossy band that
// sweeps across it (the "CONFIRM E-MAIL" button in the design).
function ctaBtn(text, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:30px auto 0;">
    <tr><td class="edu-cta" bgcolor="${BRAND.accent}" style="border-radius:6px;background-color:${BRAND.accent};background-image:linear-gradient(115deg, ${BRAND.accent} 0%, ${BRAND.accent} 38%, #ffa27a 50%, ${BRAND.accent} 62%, ${BRAND.accent} 100%);background-size:260% 100%;background-position:100% 0;box-shadow:0 12px 24px -12px rgba(232,71,15,0.75);">
      <a href="${href}" style="display:block;padding:15px 46px;color:#ffffff;font-size:12.5px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;text-decoration:none;font-family:${FONT};">${text}</a>
    </td></tr>
  </table>`;
}

// Small outlined button (the "EXPLORE" / "JOIN A CLASS" buttons in the design).
function secondaryBtn(text, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;">
    <tr><td style="border-radius:4px;border:1px solid ${BRAND.dashDivider};background:#ffffff;">
      <a href="${href}" style="display:inline-block;padding:7px 14px;color:${BRAND.textPrimary};font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;text-decoration:none;font-family:${FONT};">${text}</a>
    </td></tr>
  </table>`;
}

function sectionLabel(text, status = 'accent') {
  const s = STATUS[status] || STATUS.accent;
  return `<p style="margin:0 0 12px;font-size:10.5px;font-weight:700;color:${s.text};text-transform:uppercase;letter-spacing:0.11em;">${text}</p>`;
}

// ── Brand logo lockup ──────────────────────────────────────────────────────
// Orange round mark (white ring) + bold lowercase "edupla" wordmark.
function brandLockup() {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="padding-right:9px;" valign="middle">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td align="center" valign="middle" style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg, ${BRAND.accentBright}, ${BRAND.accent});">
          <div style="width:11px;height:11px;margin:0 auto;border:3px solid #ffffff;border-radius:50%;line-height:0;font-size:0;">&nbsp;</div>
        </td>
      </tr></table>
    </td>
    <td valign="middle">
      <span style="font-family:${FONT};font-weight:700;font-size:21px;color:${BRAND.textPrimary};letter-spacing:-0.01em;">edupla</span>
    </td>
  </tr></table>`;
}

// Peach circle holding an orange glyph — the icon bubble used all over the design.
function peachCircle(g, size = 46) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
    <td align="center" valign="middle" style="width:${size}px;height:${size}px;border-radius:50%;background:${BRAND.peach};font-size:${Math.round(size * 0.44)}px;line-height:${size}px;font-weight:700;color:${BRAND.accent};font-family:${FONT};">${glyph(g)}</td>
  </tr></table>`;
}

// Row of peach icon bubbles with labels underneath (Mentors / Quizzes / Community).
function appPreviewStrip(items) {
  const cells = items.map((it) => `
    <td width="${Math.floor(100 / items.length)}%" align="center" valign="top" style="padding:0 4px;">
      ${peachCircle(it.icon, 44)}
      <p style="margin:9px 0 0;font-size:11.5px;font-weight:500;color:${BRAND.textPrimary};font-family:${FONT};">${it.label}</p>
    </td>`).join('');
  return `<table role="presentation" style="width:100%;" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>`;
}

// Feature rows — title, grey description, small outlined button on the left,
// peach icon circle on the right, hairline between rows (the "Interactive
// courses / Live classes / Certificates" list in the design).
function featureRows(rows) {
  const trs = rows.map((r, i) => `
    <tr class="edu-row">
      <td valign="middle" style="padding:20px 8px 20px 4px;${i < rows.length - 1 ? `border-bottom:1px solid ${BRAND.rowDivider};` : ''}text-align:left;">
        <p style="margin:0;font-size:16px;font-weight:700;color:${BRAND.textPrimary};font-family:${FONT};">${r.title}</p>
        <p style="margin:4px 0 0;font-size:12px;line-height:1.55;color:${BRAND.textSecondary};max-width:260px;font-family:${FONT};">${r.desc}</p>
        ${r.cta ? secondaryBtn(r.cta, r.href || APP_URL()) : ''}
      </td>
      <td width="66" align="right" valign="middle" style="padding:20px 4px 20px 0;${i < rows.length - 1 ? `border-bottom:1px solid ${BRAND.rowDivider};` : ''}">${peachCircle(r.icon, 48)}</td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="text-align:left;border-top:1px solid ${BRAND.rowDivider};">${trs}</table>`;
}

// Kept for API compatibility with older callers: feature rows + icon strip.
function dashboardTeaserCard({ rows = [], items = [] }) {
  return `${rows.length ? featureRows(rows) : ''}${items.length ? `<div style="margin-top:24px;">${appPreviewStrip(items)}</div>` : ''}`;
}

// Small decorative icon chip on the right of ticket rows.
function iconChip(g = '⧉', status = 'accent') {
  const s = STATUS[status] || STATUS.accent;
  return `<table cellpadding="0" cellspacing="0" role="presentation"><tr><td style="width:28px;height:28px;background:${s.chip};border:1px solid ${s.chipBorder};border-radius:50%;text-align:center;vertical-align:middle;font-size:12.5px;color:${s.text};">${glyph(g)}</td></tr></table>`;
}

// ── Ticket card ──────────────────────────────────────────────────────────
// Light "ticket stub": optional identity row (orange avatar + name), a dashed
// perforation with punched-out notches, then label/value rows separated by
// hairlines. The avatar is always the brand orange so every card reads as EDUPLA.
function ticketCard({ avatarText, name, subtitle, headIcon, rows = [], status = 'accent' }) {
  const s = STATUS[status] || STATUS.accent;
  const hasIdentity = !!name;
  const avatar = avatarText ? glyph(avatarText) : (name ? name.trim().charAt(0).toUpperCase() : '•');
  const identityRow = hasIdentity ? `
    <tr><td style="padding:18px 20px 15px;">
      <table role="presentation" style="width:100%;" cellpadding="0" cellspacing="0">
        <tr>
          <td width="44" valign="middle">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:42px;height:42px;background:linear-gradient(135deg, ${BRAND.accentBright}, ${BRAND.accent});border-radius:50%;text-align:center;vertical-align:middle;color:${BRAND.onAccent};font-weight:700;font-size:16px;font-family:${FONT};">${avatar}</td></tr></table>
          </td>
          <td style="padding-left:13px;" valign="middle">
            <p style="margin:0;font-size:14.5px;font-weight:700;color:${BRAND.textPrimary};">${name}</p>
            ${subtitle ? `<p style="margin:2px 0 0;font-size:11.5px;color:${BRAND.textMuted};">${subtitle}</p>` : ''}
          </td>
          ${headIcon ? `<td width="30" align="right" valign="middle" style="font-size:18px;color:${BRAND.accent};">${glyph(headIcon)}</td>` : ''}
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 20px;">
      <div style="position:relative;height:1px;border-top:1.5px dashed ${BRAND.dashDivider};">
        <div style="position:absolute;left:-30px;top:-11px;width:22px;height:22px;border-radius:50%;background:${BRAND.cardBg};"></div>
        <div style="position:absolute;right:-30px;top:-11px;width:22px;height:22px;border-radius:50%;background:${BRAND.cardBg};"></div>
      </div>
    </td></tr>` : '';

  const rowsHtml = rows.filter(Boolean).map((r, i) => `
    <table role="presentation" style="width:100%;${i > 0 ? `margin-top:15px;padding-top:15px;border-top:1px solid ${BRAND.rowDivider};` : ''}" cellpadding="0" cellspacing="0">
      <tr>
        <td valign="middle">
          <p style="margin:0 0 4px;font-size:9.5px;font-weight:700;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.09em;">${r.label}</p>
          <p style="margin:0;font-size:14px;font-weight:600;color:${BRAND.textPrimary};${r.mono ? "font-family:Menlo,Consolas,monospace;" : ''}line-height:1.4;">${r.value}</p>
        </td>
        ${r.icon !== false ? `<td width="36" align="right" valign="middle">${iconChip(r.icon || '⧉', status)}</td>` : ''}
      </tr>
    </table>`).join('');

  return `<table role="presentation" style="width:100%;background:${BRAND.ticketBg};border:1px solid ${BRAND.ticketBorder};border-radius:16px;text-align:left;" cellpadding="0" cellspacing="0">
    ${identityRow}
    <tr><td style="padding:${hasIdentity ? '16' : '18'}px 20px 18px;">${rowsHtml}</td></tr>
  </table>`;
}

// Callout — soft tinted panel with a bold left accent bar.
function calloutBox({ label, text, tone = 'accent' }) {
  const s = STATUS[tone] || STATUS.accent;
  return `<div style="background:${s.chip};border:1px solid ${s.chipBorder};border-left:3px solid ${s.solid};border-radius:12px;padding:15px 18px;text-align:left;">
    ${label ? `<p style="margin:0 0 5px;font-size:10px;font-weight:700;color:${s.text};text-transform:uppercase;letter-spacing:0.09em;">${label}</p>` : ''}
    <p style="margin:0;font-size:13px;font-weight:500;color:${BRAND.textSecondary};line-height:1.6;">${text}</p>
  </div>`;
}

// 3-step "getting started" strip.
function stepsStrip(steps) {
  const cells = steps.map((s, i) => `
    <td width="${Math.floor(100 / steps.length)}%" valign="top" style="padding:0 8px;text-align:center;">
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
        <tr><td style="width:32px;height:32px;background:${BRAND.peach};border-radius:50%;text-align:center;vertical-align:middle;font-size:13px;font-weight:700;color:${BRAND.accent};">${i + 1}</td></tr>
      </table>
      <p style="margin:10px 0 0;font-size:12.5px;font-weight:700;color:${BRAND.textPrimary};line-height:1.4;">${s.title}</p>
      <p style="margin:3px 0 0;font-size:11.5px;color:${BRAND.textSecondary};line-height:1.55;">${s.desc}</p>
    </td>`).join('');

  return `<table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin-top:20px;">
    <tr>${cells}</tr>
  </table>`;
}

function divider() {
  return `<div style="height:1px;background:${BRAND.rowDivider};margin:30px 0;"></div>`;
}

// Countdown pill for deadlines, colour-coded by urgency.
function daysLeftPill(deadline) {
  if (!deadline) return '';
  const diffMs = new Date(deadline).getTime() - Date.now();
  const days = Math.ceil(diffMs / 86400000);
  let label, color, bg, border;
  if (days < 0)        { label = 'Deadline passed'; color = BRAND.textMuted;   bg = BRAND.chipBg; border = BRAND.chipBorder; }
  else if (days === 0) { label = 'Due today';        color = BRAND.dangerText; bg = BRAND.dangerBg; border = BRAND.dangerBorder; }
  else if (days === 1) { label = '1 day left';       color = BRAND.dangerText; bg = BRAND.dangerBg; border = BRAND.dangerBorder; }
  else if (days <= 3)  { label = `${days} days left`; color = BRAND.amber;     bg = '#fffbeb'; border = '#fde68a'; }
  else                 { label = `${days} days left`; color = BRAND.successText; bg = BRAND.successBg; border = BRAND.successBorder; }
  return `<span style="display:inline-block;margin-top:14px;padding:5px 14px;border-radius:999px;font-size:11px;font-weight:700;background:${bg};border:1px solid ${border};color:${color};">⏳ ${label}</span>`;
}

// ── Safe send wrapper ──────────────────────────────────────────────────────
// Never throws. IMPORTANT: callers must `await` the notify*() functions BEFORE
// sending the HTTP response. On Vercel (serverless) the function is frozen the
// moment the response ends, so a fire-and-forget send started after res.json()
// is killed mid-SMTP and the email is never delivered.
async function sendMail(opts) {
  const transporter = createTransporter();
  if (!transporter) return;
  try {
    const info = await transporter.sendMail({ from: FROM(), ...opts });
    console.log(`📧 Email sent: "${opts.subject}" → ${[].concat(opts.to).join(', ')} (${info.messageId})`);
  } catch (err) {
    console.error(`📧 Email send error ("${opts.subject}"):`, err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  1. Account activated / deactivated  (admin, teacher, or student)
// ═══════════════════════════════════════════════════════════════════════════
async function notifyAccountStatus({ to, name, role, isActive }) {
  if (!to) return;
  const action    = isActive ? 'activated' : 'deactivated';
  const roleLabel = role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : 'Student';
  const status    = isActive ? 'success' : 'danger';

  const body = `
    <p style="margin:0 0 22px;font-size:14px;color:${BRAND.textSecondary};">Your EDUPLA account status has been updated.</p>
    ${calloutBox({ label: 'Status update', text: `Your ${roleLabel} account has been <strong style="color:${isActive ? BRAND.successText : BRAND.dangerText};">${action}</strong>.`, tone: status })}
    <div style="margin-top:20px;">
      ${ticketCard({
        name,
        subtitle: `${roleLabel} · EDUPLA account`,
        status,
        rows: [
          { label: 'Role', value: roleLabel, icon: false },
          { label: 'Status', value: `<span style="color:${isActive ? BRAND.successText : BRAND.dangerText};">${isActive ? 'Active' : 'Inactive'}</span>`, icon: false },
        ],
      })}
    </div>
    ${isActive
      ? ctaBtn('Go to EDUPLA →', APP_URL())
      : `<p style="margin:22px 0 0;font-size:13px;color:${BRAND.textSecondary};">Your access has been suspended. Contact your administrator if you believe this is a mistake.</p>`
    }`;

  await sendMail({
    to,
    subject: `${isActive ? '✅' : '⛔'} EDUPLA Account ${isActive ? 'Activated' : 'Deactivated'} — ${name}`,
    html: wrapEmail({
      title: `Account ${isActive ? 'Activated' : 'Deactivated'}`,
      preheader: `Your EDUPLA ${roleLabel} account has been ${action}.`,
      badge: badgeChip(roleLabel, status),
      icon: isActive ? '✓' : '✕',
      status,
      body,
    }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  2. Welcome — new account created
// ═══════════════════════════════════════════════════════════════════════════
async function notifyWelcome({ to, name, role, defaultPassword, adminName }) {
  if (!to) return;
  const roleLabel = role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : 'Student';
  const dashUrl   = role === 'admin' ? `${APP_URL()}/admin` : role === 'teacher' ? `${APP_URL()}/teacher` : `${APP_URL()}/student`;
  const firstName = (name || '').trim().split(' ')[0];
  const base = APP_URL();
  const featureList = role === 'admin'
    ? [
        { title: 'Teachers & students', desc: 'Create accounts and manage everyone at your school.', cta: 'Manage people', href: dashUrl, icon: '☺' },
        { title: 'Classes', desc: 'Build levels, trades and classes in minutes.',            cta: 'Open classes',    href: dashUrl, icon: '▤' },
        { title: 'Announcements', desc: 'Keep every class informed in one place.',            cta: 'Post an update',  href: dashUrl, icon: '✉' },
      ]
    : role === 'teacher'
    ? [
        { title: 'Classes',     desc: 'See your classes and the students in them.',           cta: 'Open classes',    href: dashUrl, icon: '▤' },
        { title: 'Assignments', desc: 'Post work, set deadlines and track submissions.',      cta: 'New assignment',  href: `${base}/teacher/assignments`, icon: '✎' },
        { title: 'Documents',   desc: 'Share notes and study material with your students.',   cta: 'Share a document', href: dashUrl, icon: '❐' },
      ]
    : [
        { title: 'Classes',     desc: 'Everything for your classes, in one place.',           cta: 'Open classes',    href: dashUrl, icon: '▤' },
        { title: 'Assignments', desc: 'See what is due and hand your work in on time.',       cta: 'View assignments', href: `${base}/student/assignments`, icon: '✎' },
        { title: 'Assessments', desc: 'Take online quizzes and check your marks.',            cta: 'Go to assessments', href: `${base}/student/assessments`, icon: '✓' },
      ];
  const firstStepTitle = role === 'admin' ? 'Add your teachers & students' : role === 'teacher' ? 'Create your first class' : 'Explore your classes';
  const firstStepDesc  = role === 'admin' ? 'Invite staff and enroll students to get your school set up.' : role === 'teacher' ? 'Set up a class and invite students.' : 'Check assignments, docs and announcements.';

  const body = `
    <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:${BRAND.textPrimary};">Hi ${firstName || name},</p>
    <p style="margin:0 0 20px;font-size:14px;color:${BRAND.textSecondary};line-height:1.65;">Welcome to <strong style="color:${BRAND.accent};">EDUPLA</strong> — one unified platform for documents, assignments, teacher &amp; student management, modules and assessments, competency-based TVET curriculum setup, and automated report generation — built for admins, teachers, and students alike.</p>
    <p style="margin:0 0 22px;font-size:14px;color:${BRAND.textSecondary};">Use these credentials to sign in.</p>

    ${ticketCard({
      name: name || to,
      subtitle: `${roleLabel} · EDUPLA${adminName ? ' · added by ' + adminName : ''}`,
      headIcon: '🎓',
      status: 'success',
      rows: [
        { label: 'Email', value: `<a href="mailto:${to}" style="color:${BRAND.textPrimary};text-decoration:none;">${to}</a>`, icon: '⧉' },
        { label: 'Default password', value: `<span style="letter-spacing:2px;">${defaultPassword}</span>`, mono: true, icon: '◉' },
      ],
    })}

    <div style="margin-top:20px;">
      ${calloutBox({ label: 'Security tip', text: 'Please change this password after your first login.', tone: 'accent' })}
    </div>

    <div style="margin-top:20px;">
      ${featureRows(featureList)}
    </div>

    ${ctaBtn('Log In to EDUPLA →', dashUrl)}

    ${divider()}

    ${sectionLabel('Get started in 3 steps')}
    ${stepsStrip([
      { title: 'Log in', desc: 'Use the credentials above to sign in for the first time.' },
      { title: 'Set up your account', desc: 'Change your password to something you know.' },
      { title: firstStepTitle, desc: firstStepDesc },
    ])}`;

  await sendMail({
    to,
    subject: `🎓 Welcome to EDUPLA — Your ${roleLabel} account is ready`,
    html: wrapEmail({
      title: 'Welcome to EDUPLA',
      preheader: `Your ${roleLabel} account has been created. Log in now.`,
      badge: badgeChip(`New ${roleLabel} account created successfully !!`, 'success'),
      icon: '✓',
      status: 'success',
      body,
    }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  2b. Password reset — admin reset a teacher's or student's password
// ═══════════════════════════════════════════════════════════════════════════
async function notifyPasswordReset({ to, name, role, newPassword, adminName }) {
  if (!to) return;
  const roleLabel = role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : 'Student';
  const dashUrl   = role === 'admin' ? `${APP_URL()}/admin` : role === 'teacher' ? `${APP_URL()}/teacher` : `${APP_URL()}/student`;

  const body = `
    <p style="margin:0 0 22px;font-size:14px;color:${BRAND.textSecondary};">${adminName ? `${adminName} (your school admin)` : 'Your school admin'} reset your EDUPLA password. Here's your new login.</p>
    ${ticketCard({
      name: name || to,
      subtitle: `${roleLabel} · password reset`,
      headIcon: '🔑',
      rows: [
        { label: 'Email', value: to, icon: '⧉' },
        { label: 'New password', value: `<span style="letter-spacing:2px;">${newPassword}</span>`, mono: true, icon: '◉' },
      ],
    })}
    <div style="margin-top:20px;">
      ${calloutBox({ label: 'Heads up', text: 'Your old password no longer works — log in with the new one above, and consider changing it to something only you know.', tone: 'accent' })}
    </div>
    ${ctaBtn('Log In to EDUPLA →', dashUrl)}`;

  await sendMail({
    to,
    subject: `🔑 EDUPLA Password Reset — ${name}`,
    html: wrapEmail({
      title: 'Password Reset',
      preheader: 'Your EDUPLA password was reset by an admin.',
      badge: badgeChip(roleLabel, 'accent'),
      icon: '🔑',
      status: 'accent',
      body,
    }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  3. New assignment posted (notify students)
// ═══════════════════════════════════════════════════════════════════════════
async function notifyAssignmentPosted({ studentEmails, teacherEmail, assignmentTitle, className, deadline, teacherName }) {
  if (!studentEmails?.length) return;
  const deadlineStr = new Date(deadline).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const body = `
    <p style="margin:0 0 20px;font-size:14px;color:${BRAND.textSecondary};">Your teacher has posted a new assignment.</p>
    ${ticketCard({
      name: assignmentTitle,
      subtitle: className || 'Assignment',
      avatarText: '📋',
      rows: [
        { label: 'Teacher', value: teacherName, icon: false },
        { label: 'Deadline', value: `<span style="color:${BRAND.dangerText};">${deadlineStr}</span>`, icon: false },
      ],
    })}
    <div style="margin:6px 0 0;">${daysLeftPill(deadline)}</div>
    <div style="margin-top:18px;">
      ${calloutBox({ label: 'Reminder', text: 'Submit your work before the deadline to avoid penalties.', tone: 'accent' })}
    </div>
    ${ctaBtn('View Assignment →', `${APP_URL()}/student/assignments`)}`;

  await sendMail({
    to: studentEmails,
    ...(teacherEmail ? { bcc: teacherEmail } : {}),
    subject: `📋 New Assignment: ${assignmentTitle}${className ? ' — ' + className : ''}`,
    html: wrapEmail({ title: 'New Assignment', preheader: `${teacherName} posted: ${assignmentTitle}`, badge: badgeChip(className || 'Assignment', 'accent'), icon: '📋', status: 'accent', body }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  4. Assignment submitted (notify teacher)
// ═══════════════════════════════════════════════════════════════════════════
async function notifyAssignmentSubmitted({ teacherEmail, studentName, assignmentTitle, className, submittedAt }) {
  if (!teacherEmail) return;
  const submittedStr = new Date(submittedAt || Date.now()).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const body = `
    <p style="margin:0 0 20px;font-size:14px;color:${BRAND.textSecondary};">A student has submitted their work for review.</p>
    ${ticketCard({
      name: studentName,
      subtitle: `Submitted ${assignmentTitle}`,
      status: 'success',
      rows: [
        { label: 'Class', value: className || '—', icon: false },
        { label: 'Submitted at', value: submittedStr, icon: false },
      ],
    })}
    ${ctaBtn('Review Submission →', `${APP_URL()}/teacher/assignments`)}`;

  await sendMail({
    to: teacherEmail,
    subject: `✅ Submission: ${studentName} — ${assignmentTitle}`,
    html: wrapEmail({ title: 'Assignment Submitted', preheader: `${studentName} submitted: ${assignmentTitle}`, badge: badgeChip('Teacher', 'success'), icon: '✓', status: 'success', body }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  5. New document posted (notify students)
// ═══════════════════════════════════════════════════════════════════════════
async function notifyDocumentPosted({ studentEmails, teacherEmail, documentTitle, className, teacherName, description }) {
  if (!studentEmails?.length) return;

  const body = `
    <p style="margin:0 0 20px;font-size:14px;color:${BRAND.textSecondary};">New study material is available for your class.</p>
    ${ticketCard({
      name: documentTitle,
      subtitle: description || (className || 'All classes'),
      avatarText: '📄',
      rows: [
        { label: 'Class', value: className || 'All classes', icon: false },
        { label: 'Shared by', value: teacherName, icon: false },
      ],
    })}
    ${ctaBtn('View Document →', `${APP_URL()}/student/documents`)}`;

  await sendMail({
    to: studentEmails,
    ...(teacherEmail ? { bcc: teacherEmail } : {}),
    subject: `📄 New Document: ${documentTitle}${className ? ' — ' + className : ''}`,
    html: wrapEmail({ title: 'New Document', preheader: `${teacherName} shared: ${documentTitle}`, badge: badgeChip(className || 'Document', 'accent'), icon: '📄', status: 'accent', body }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  6. New announcement (notify students)
// ═══════════════════════════════════════════════════════════════════════════
async function notifyAnnouncement({ studentEmails, teacherEmail, announcementTitle, content, className, teacherName }) {
  if (!studentEmails?.length) return;

  const body = `
    <p style="margin:0 0 20px;font-size:14px;color:${BRAND.textSecondary};">Your teacher has posted an announcement.</p>
    ${ticketCard({
      name: announcementTitle,
      subtitle: className || 'General',
      avatarText: '📣',
      rows: [
        { label: 'Message', value: `<span style="font-weight:500;color:${BRAND.textSecondary};font-family:inherit;">${content}</span>`, icon: false },
        { label: 'Posted by', value: teacherName, icon: false },
      ],
    })}
    ${ctaBtn('View Announcements →', `${APP_URL()}/student/announcements`)}`;

  await sendMail({
    to: studentEmails,
    ...(teacherEmail ? { bcc: teacherEmail } : {}),
    subject: `📣 Announcement: ${announcementTitle}`,
    html: wrapEmail({ title: 'New Announcement', preheader: `${teacherName}: ${announcementTitle}`, badge: badgeChip(className || 'Announcement', 'accent'), icon: '📣', status: 'accent', body }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  7. Online assessment shared (notify students)
// ═══════════════════════════════════════════════════════════════════════════
async function notifyAssessmentShared({ studentEmails, teacherEmail, assessmentTitle, moduleName, className, teacherName, durationMinutes, maxAttempts, expiresAt, availableFrom }) {
  if (!studentEmails?.length) return;
  const expiresStr = expiresAt
    ? new Date(expiresAt).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : 'No expiry set';
  const availableFromStr = availableFrom && new Date(availableFrom) > new Date()
    ? new Date(availableFrom).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;

  const body = `
    <p style="margin:0 0 20px;font-size:14px;color:${BRAND.textSecondary};">Your teacher has shared an online assessment for you to complete.</p>
    ${ticketCard({
      name: assessmentTitle,
      subtitle: moduleName || 'Assessment',
      avatarText: '📝',
      rows: [
        { label: 'Class', value: className || '—', icon: false },
        { label: 'Teacher', value: teacherName, icon: false },
        { label: 'Duration', value: durationMinutes ? `${durationMinutes} minutes` : 'No time limit', icon: false },
        { label: 'Attempts allowed', value: String(maxAttempts || 1), icon: false },
        availableFromStr ? { label: 'Starts', value: `<span style="color:${BRAND.amber};">${availableFromStr}</span>`, icon: false } : null,
        { label: 'Available until', value: `<span style="color:${BRAND.dangerText};">${expiresStr}</span>`, icon: false },
      ],
    })}
    ${expiresAt ? `<div style="margin:6px 0 0;">${daysLeftPill(expiresAt)}</div>` : ''}
    <div style="margin-top:18px;">
      ${calloutBox({ label: 'Before you start', text: 'The assessment opens in full screen and submits automatically when time runs out or if you leave the exam screen. Make sure you\'re ready first.', tone: 'accent' })}
    </div>
    ${ctaBtn('Go to Assessments →', `${APP_URL()}/student/assessments`)}`;

  await sendMail({
    to: studentEmails,
    ...(teacherEmail ? { bcc: teacherEmail } : {}),
    subject: `📝 New Assessment: ${assessmentTitle}${className ? ' — ' + className : ''}`,
    html: wrapEmail({ title: 'New Assessment', preheader: `${teacherName} shared: ${assessmentTitle}`, badge: badgeChip(className || 'Assessment', 'accent'), icon: '📝', status: 'accent', body }),
  });
}

module.exports = {
  notifyAccountStatus,
  notifyWelcome,
  notifyPasswordReset,
  notifyAssessmentShared,
  notifyAssignmentPosted,
  notifyAssignmentSubmitted,
  notifyDocumentPosted,
  notifyAnnouncement,
};