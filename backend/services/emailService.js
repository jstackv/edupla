const nodemailer = require('nodemailer');

// ── Transporter ────────────────────────────────────────────────────────────
function createTransporter() {
  const required = { EMAIL_HOST: process.env.EMAIL_HOST, EMAIL_USER: process.env.EMAIL_USER, EMAIL_PASS: process.env.EMAIL_PASS };
  const missing = Object.keys(required).filter((k) => !required[k]);
  if (missing.length) {
    console.warn(`⚠️  Email not configured — missing ${missing.join(', ')} in .env. No welcome/assignment/assessment/announcement/account-status emails will be sent until ${missing.length > 1 ? 'these are' : 'this is'} set.`);
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

const FROM    = () => process.env.EMAIL_FROM   || '"EDUPLA" <no-reply@edupla.app>';
const APP_URL = () => process.env.APP_URL       || 'https://edupla.vercel.app';

// ── Brand palette — dark "ticket card" theme, matching the in-app dialogs:
// near-black canvas, a glowing colored status circle up top, and a darker
// ticket-style panel (avatar row + perforated divider + monospace rows)
// for anything credential/detail related. Orange remains the CTA accent. ──
const BRAND = {
  pageBg:        '#050505',
  cardBg:        '#111113',
  cardBorder:    'rgba(255,255,255,0.08)',
  headerBorder:  'rgba(255,255,255,0.07)',
  ticketBg:      '#17171b',
  ticketBorder:  'rgba(255,255,255,0.10)',
  rowDivider:    'rgba(255,255,255,0.07)',
  dashDivider:   'rgba(255,255,255,0.22)',
  chipBg:        'rgba(255,255,255,0.05)',
  chipBorder:    'rgba(255,255,255,0.13)',
  textPrimary:   '#f5f5f7',
  textSecondary: '#a3a3ad',
  textMuted:     '#75757f',
  accent:        '#ea580c',
  accentBright:  '#fb923c',
  accentDeep:    '#c2410c',
  amber:         '#f59e0b',
  // Fixed "white-gray" ink used on top of any dark-orange brand surface
  // (icon badge, avatar chip) so it never inherits a status color.
  onAccent:      '#f4f4f5',
  successText:   '#34d399', successBg: 'rgba(21,128,61,0.14)', successBorder: 'rgba(21,128,61,0.35)', successRing: 'rgba(21,128,61,0.30)',
  dangerText:    '#f87171', dangerBg: 'rgba(248,113,113,0.10)', dangerBorder: 'rgba(248,113,113,0.30)', dangerRing: 'rgba(248,113,113,0.28)',
  accentRing:    'rgba(251,146,60,0.28)',
};

const STATUS = {
  success: { solid: '#15803d', dark: '#052e16', text: BRAND.successText, ring: BRAND.successRing, chip: BRAND.successBg, chipBorder: BRAND.successBorder },
  danger:  { solid: '#ef4444', dark: '#5b1414', text: BRAND.dangerText,  ring: BRAND.dangerRing,  chip: BRAND.dangerBg,  chipBorder: BRAND.dangerBorder },
  accent:  { solid: '#fb923c', dark: '#7c2d12', text: BRAND.accentBright, ring: BRAND.accentRing, chip: 'rgba(251,146,60,0.10)', chipBorder: 'rgba(251,146,60,0.30)' },
};

// ── HTML shell ─────────────────────────────────────────────────────────────
function wrapEmail({ title, preheader, body, badge, icon = '🎓', status = 'accent' }) {
  const s = STATUS[status] || STATUS.accent;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><meta name="color-scheme" content="dark"/><title>${title}</title>
<style>
  @keyframes eduplaPop {
    0%   { transform: scale(0.4) rotate(-8deg); opacity: 0; }
    55%  { transform: scale(1.12) rotate(4deg); opacity: 1; }
    75%  { transform: scale(0.96) rotate(-2deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  @keyframes eduplaFloat {
    0%, 100% { transform: translateY(0px); }
    50%      { transform: translateY(-5px); }
  }
  @keyframes eduplaRing {
    0%   { box-shadow: 0 0 0 0 ${s.ring}, 0 0 0 8px ${s.ring}; }
    70%  { box-shadow: 0 0 0 8px ${s.ring}, 0 0 0 26px rgba(0,0,0,0); }
    100% { box-shadow: 0 0 0 8px ${s.ring}, 0 0 0 26px rgba(0,0,0,0); }
  }
  @keyframes eduplaShine {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .edupla-icon-badge {
    animation: eduplaPop 0.7s cubic-bezier(.34,1.56,.64,1) 0s 1 both,
               eduplaFloat 2.6s ease-in-out 0.7s infinite,
               eduplaRing 2.4s ease-out 0.7s infinite;
  }
  .edupla-cta a {
    background-size: 200% 100%;
    animation: eduplaShine 2.8s linear infinite;
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;color:${BRAND.pageBg};">${preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="${BRAND.pageBg}" style="background:${BRAND.pageBg};background-image:radial-gradient(circle at 50% -10%, ${s.ring} 0%, rgba(0,0,0,0) 55%);padding:44px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">

        <tr>
          <td style="border-radius:24px;overflow:hidden;box-shadow:0 24px 60px -20px rgba(0,0,0,0.7);">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="${BRAND.cardBg}" style="background:${BRAND.cardBg};border:1px solid ${BRAND.cardBorder};border-radius:24px;">

              <!-- Top accent bar -->
              <tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:linear-gradient(90deg,${s.dark},${s.solid},${s.dark});">&nbsp;</td></tr>

              <!-- Header -->
              <tr>
                <td style="padding:42px 36px 28px;text-align:center;border-bottom:1px solid ${BRAND.headerBorder};">
                  ${brandLockup()}
                  <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 20px;">
                    <tr><td class="edupla-icon-badge" style="width:70px;height:70px;border-radius:50%;background:radial-gradient(circle at 32% 26%, ${BRAND.accentBright} 0%, ${BRAND.accent} 45%, ${BRAND.accentDeep} 100%);text-align:center;vertical-align:middle;font-size:27px;color:${BRAND.onAccent};box-shadow:inset 0 1px 0 rgba(255,255,255,0.28), 0 12px 26px -8px ${s.ring};">${icon}</td></tr>
                  </table>
                  <h1 style="margin:0;font-size:22px;font-weight:800;color:${BRAND.textPrimary};letter-spacing:-0.01em;">${title}</h1>
                  ${badge ? `<div style="margin-top:16px;">${badge}</div>` : ''}
                </td>
              </tr>

              <!-- Body -->
              <tr><td style="padding:32px 36px 36px;">${body}</td></tr>

            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:26px 12px 0;text-align:center;">
            <p style="margin:0 0 5px;font-size:11.5px;color:${BRAND.textMuted};">Sent by <a href="${APP_URL()}" style="color:${BRAND.accentBright};font-weight:700;text-decoration:none;">EDUPLA</a> — empowering classrooms, one lesson at a time</p>
            <p style="margin:0;font-size:10.5px;color:#3f3f46;">This is an automated notification — please don't reply directly to this email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

function badgeChip(text, status = 'accent') {
  const s = STATUS[status] || STATUS.accent;
  return `<span style="display:inline-block;padding:6px 16px;background:${s.chip};border:1px solid ${s.chipBorder};border-radius:999px;font-size:10.5px;font-weight:800;color:${s.text};letter-spacing:0.06em;text-transform:uppercase;">${text}</span>`;
}

function ctaBtn(text, href) {
  return `<table cellpadding="0" cellspacing="0" role="presentation" align="right" class="edupla-cta" style="margin-top:26px;border-radius:12px;box-shadow:0 12px 26px -10px rgba(154,52,18,0.55);">
    <tr><td style="border-radius:12px;">
      <a href="${href}" style="display:inline-block;padding:14px 30px;color:#fff;font-size:13.5px;font-weight:800;text-decoration:none;letter-spacing:0.01em;border-radius:12px;background:linear-gradient(100deg,#7c2d12 0%,#9a3412 25%,#c2410c 50%,#9a3412 75%,#7c2d12 100%);background-size:200% 100%;">${text}</a>
    </td></tr>
  </table>
  <div style="clear:both;"></div>`;
}

function secondaryBtn(text, href) {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:26px;">
    <tr><td style="border-radius:12px;border:1px solid ${BRAND.chipBorder};background:${BRAND.chipBg};">
      <a href="${href}" style="display:inline-block;padding:13px 26px;color:${BRAND.textPrimary};font-size:13px;font-weight:700;text-decoration:none;">${text}</a>
    </td></tr>
  </table>`;
}

function sectionLabel(text, status = 'accent') {
  const s = STATUS[status] || STATUS.accent;
  return `<p style="margin:0 0 12px;font-size:10.5px;font-weight:800;color:${s.text};text-transform:uppercase;letter-spacing:0.11em;">${text}</p>`;
}

// ── Brand logo lockup ──────────────────────────────────────────────────────
// Mirrors the site nav: a rounded-square "E" mark in the dark-orange gradient
// (fixed white-gray ink) beside an italic serif "Edupla" wordmark. Used at
// the top of every email in place of a flat text label.
function brandLockup() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 22px;"><tr>
    <td style="padding-right:11px;" valign="middle">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg, ${BRAND.accentBright}, ${BRAND.accentDeep});text-align:center;vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:700;font-size:18px;color:${BRAND.onAccent};box-shadow:inset 0 1px 0 rgba(255,255,255,0.25);">E</td>
      </tr></table>
    </td>
    <td valign="middle">
      <span style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:600;font-size:22px;color:${BRAND.textPrimary};letter-spacing:0.01em;">Edupla</span>
    </td>
  </tr></table>`;
}

// Row of rounded-square section tiles (Classes / Assignments / Documents /
// Announcements, etc.) — the first tile is highlighted in brand orange,
// mirroring the active sidebar icon in the app screenshot.
function appPreviewStrip(items) {
  const cells = items.map((it, i) => `
    <td width="${Math.floor(100 / items.length)}%" align="center" style="padding:0 5px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
        <td style="width:44px;height:44px;border-radius:12px;background:${i === 0 ? `linear-gradient(135deg, ${BRAND.accentBright}, ${BRAND.accentDeep})` : BRAND.chipBg};border:1px solid ${i === 0 ? 'transparent' : BRAND.chipBorder};text-align:center;vertical-align:middle;font-size:18px;color:${i === 0 ? BRAND.onAccent : BRAND.textSecondary};">${it.icon}</td>
      </tr></table>
      <p style="margin:8px 0 0;font-size:10.5px;font-weight:700;color:${BRAND.textSecondary};">${it.label}</p>
    </td>`).join('');
  return `<table role="presentation" style="width:100%;" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>`;
}

// "Browser chrome" teaser card — traffic-light dots + address pill + a live
// badge, then a friendly greeting and a preview strip of what's inside the
// app. Dropped into onboarding-type emails to turn a plain credential drop
// into something that actually makes someone want to click through and log in.
function dashboardTeaserCard({ greetingName, items, liveLabel = 'live' }) {
  const dot = (color) => `<td style="width:9px;height:9px;border-radius:50%;background:${color};"></td><td width="6"></td>`;
  return `<table role="presentation" style="width:100%;background:#0c0c0e;border:1px solid ${BRAND.ticketBorder};border-radius:16px;overflow:hidden;" cellpadding="0" cellspacing="0">
    <tr><td style="padding:13px 18px;border-bottom:1px solid ${BRAND.headerBorder};">
      <table role="presentation" style="width:100%;" cellpadding="0" cellspacing="0"><tr>
        <td width="92"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${dot('#f87171')}${dot('#f59e0b')}${dot('#34d399')}</tr></table></td>
        <td align="center">
          <span style="display:inline-block;padding:5px 14px;background:${BRAND.chipBg};border:1px solid ${BRAND.chipBorder};border-radius:999px;font-size:10px;color:${BRAND.textMuted};">app.edupla.school</span>
        </td>
        <td width="92" align="right">
          <span style="display:inline-block;white-space:nowrap;padding:4px 10px;background:${BRAND.successBg};border:1px solid ${BRAND.successBorder};border-radius:999px;font-size:9px;font-weight:800;color:${BRAND.successText};text-transform:uppercase;letter-spacing:0.04em;">● ${liveLabel}</span>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:20px 20px 4px;">
      <p style="margin:0;font-size:14.5px;font-weight:800;color:${BRAND.textPrimary};">Good to see you${greetingName ? ', ' + greetingName : ''} 👋</p>
      <p style="margin:4px 0 0;font-size:11.5px;color:${BRAND.textMuted};">Here's what's waiting for you inside EDUPLA</p>
    </td></tr>
    <tr><td style="padding:14px 16px 22px;">${appPreviewStrip(items)}</td></tr>
  </table>`;
}

// Small decorative icon chip — mirrors the copy/eye icon buttons in the app's
// dark UI. Purely visual in email (no client-side interactivity is possible),
// but it keeps the credential rows visually consistent with the product.
function iconChip(glyph = '⧉', status = 'accent') {
  const s = STATUS[status] || STATUS.accent;
  return `<table cellpadding="0" cellspacing="0" role="presentation"><tr><td style="width:28px;height:28px;background:${STATUS.accent.chip};border:1px solid ${STATUS.accent.chipBorder};border-radius:8px;text-align:center;vertical-align:middle;font-size:12.5px;color:${s.text};">${glyph}</td></tr></table>`;
}

// ── Ticket card ──────────────────────────────────────────────────────────
// The dark, perforated "ticket stub" panel used across the app — an optional
// avatar/identity row, a dashed divider with cutout notches punched through
// to the card background behind it, then stacked label/value rows each
// separated by a hairline, with a small icon chip on the right of each row.
//
// NOTE: the identity avatar chip is always rendered in the brand's dark-orange
// gradient with fixed white-gray ink (BRAND.onAccent) — independent of
// `status` and of any legacy `avatarColor` — so every card reads as EDUPLA,
// not as a status color.
function ticketCard({ avatarText, name, subtitle, headIcon, rows = [], status = 'accent' }) {
  const s = STATUS[status] || STATUS.accent;
  const hasIdentity = !!name;
  const identityRow = hasIdentity ? `
    <tr><td style="padding:18px 20px 15px;">
      <table role="presentation" style="width:100%;" cellpadding="0" cellspacing="0">
        <tr>
          <td width="42" valign="middle">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:40px;height:40px;background:linear-gradient(135deg, ${BRAND.accentBright}, ${BRAND.accentDeep});border-radius:12px;text-align:center;vertical-align:middle;color:${BRAND.onAccent};font-weight:800;font-size:15px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.22);">${avatarText || (name ? name.trim().charAt(0).toUpperCase() : '•')}</td></tr></table>
          </td>
          <td style="padding-left:13px;" valign="middle">
            <p style="margin:0;font-size:14.5px;font-weight:800;color:${BRAND.textPrimary};">${name}</p>
            ${subtitle ? `<p style="margin:2px 0 0;font-size:11.5px;color:${BRAND.textMuted};">${subtitle}</p>` : ''}
          </td>
          ${headIcon ? `<td width="30" align="right" valign="middle" style="font-size:18px;">${headIcon}</td>` : ''}
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
          <p style="margin:0 0 4px;font-size:9.5px;font-weight:800;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.09em;">${r.label}</p>
          <p style="margin:0;font-size:14px;font-weight:700;color:${BRAND.textPrimary};${r.mono ? "font-family:Menlo,Consolas,monospace;" : ''}line-height:1.4;">${r.value}</p>
        </td>
        ${r.icon !== false ? `<td width="36" align="right" valign="middle">${iconChip(r.icon || '⧉', status)}</td>` : ''}
      </tr>
    </table>`).join('');

  return `<table role="presentation" style="width:100%;background:${BRAND.ticketBg};border:1px solid ${BRAND.ticketBorder};border-radius:16px;" cellpadding="0" cellspacing="0">
    ${identityRow}
    <tr><td style="padding:${hasIdentity ? '16' : '18'}px 20px 18px;">${rowsHtml}</td></tr>
  </table>`;
}

// Callout — soft tinted panel with a bold left accent bar, dark theme.
function calloutBox({ label, text, tone = 'accent' }) {
  const s = STATUS[tone] || STATUS.accent;
  return `<div style="background:${s.chip};border:1px solid ${s.chipBorder};border-left:3px solid ${s.solid};border-radius:12px;padding:16px 19px;">
    ${label ? `<p style="margin:0 0 5px;font-size:10px;font-weight:800;color:${s.text};text-transform:uppercase;letter-spacing:0.09em;">${label}</p>` : ''}
    <p style="margin:0;font-size:13.5px;font-weight:500;color:${BRAND.textSecondary};line-height:1.6;">${text}</p>
  </div>`;
}

// 3-step "getting started" strip — dark theme.
function stepsStrip(steps) {
  const cells = steps.map((s, i) => `
    <td width="${Math.floor(100 / steps.length)}%" valign="top" style="padding:0 10px;">
      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr><td style="width:30px;height:30px;background:${BRAND.chipBg};border:1px solid ${BRAND.chipBorder};border-radius:50%;text-align:center;vertical-align:middle;font-size:13px;font-weight:800;color:${BRAND.accentBright};">${i + 1}</td></tr>
      </table>
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        <tr><td style="padding-top:10px;font-size:12.5px;font-weight:700;color:${BRAND.textPrimary};line-height:1.4;">${s.title}</td></tr>
        <tr><td style="padding-top:3px;font-size:11.5px;color:${BRAND.textSecondary};line-height:1.55;">${s.desc}</td></tr>
      </table>
    </td>`).join('<td width="18"></td>');

  return `<table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin-top:28px;">
    <tr>${cells}</tr>
  </table>`;
}

function divider() {
  return `<div style="height:1px;background:linear-gradient(90deg,rgba(255,255,255,0) 0%,${BRAND.headerBorder} 50%,rgba(255,255,255,0) 100%);margin:28px 0;"></div>`;
}

// Countdown pill for deadlines, color-coded by urgency, dark theme.
function daysLeftPill(deadline) {
  if (!deadline) return '';
  const diffMs = new Date(deadline).getTime() - Date.now();
  const days = Math.ceil(diffMs / 86400000);
  let label, color, bg, border;
  if (days < 0)        { label = 'Deadline passed'; color = BRAND.textMuted;   bg = BRAND.chipBg; border = BRAND.chipBorder; }
  else if (days === 0) { label = 'Due today';        color = BRAND.dangerText; bg = BRAND.dangerBg; border = BRAND.dangerBorder; }
  else if (days === 1) { label = '1 day left';       color = BRAND.dangerText; bg = BRAND.dangerBg; border = BRAND.dangerBorder; }
  else if (days <= 3)  { label = `${days} days left`; color = BRAND.amber;     bg = 'rgba(245,158,11,0.10)'; border = 'rgba(245,158,11,0.30)'; }
  else                 { label = `${days} days left`; color = BRAND.successText; bg = BRAND.successBg; border = BRAND.successBorder; }
  return `<span style="display:inline-block;margin-top:14px;padding:5px 14px;border-radius:999px;font-size:11px;font-weight:800;background:${bg};border:1px solid ${border};color:${color};">⏳ ${label}</span>`;
}

// ── Safe send wrapper ──────────────────────────────────────────────────────
async function sendMail(opts) {
  const transporter = createTransporter();
  if (!transporter) return;
  try {
    await transporter.sendMail({ from: FROM(), ...opts });
  } catch (err) {
    console.error('📧 Email send error:', err.message);
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
  const previewItems = role === 'admin'
    ? [
        { icon: '👥', label: 'Teachers' },
        { icon: '🎓', label: 'Students' },
        { icon: '📚', label: 'Classes' },
        { icon: '📣', label: 'Announcements' },
      ]
    : role === 'teacher'
    ? [
        { icon: '📚', label: 'Classes' },
        { icon: '📋', label: 'Assignments' },
        { icon: '📄', label: 'Documents' },
        { icon: '📣', label: 'Announcements' },
      ]
    : [
        { icon: '📚', label: 'Classes' },
        { icon: '📋', label: 'Assignments' },
        { icon: '📝', label: 'Assessments' },
        { icon: '📣', label: 'Announcements' },
      ];
  const firstStepTitle = role === 'admin' ? 'Add your teachers & students' : role === 'teacher' ? 'Create your first class' : 'Explore your classes';
  const firstStepDesc  = role === 'admin' ? 'Invite staff and enroll students to get your school set up.' : role === 'teacher' ? 'Set up a class and invite students.' : 'Check assignments, docs and announcements.';

  const body = `
    <p style="margin:0 0 6px;font-size:15px;font-weight:800;color:${BRAND.textPrimary};">Hi ${firstName || name},</p>
    <p style="margin:0 0 20px;font-size:14px;color:${BRAND.textSecondary};line-height:1.65;">Welcome to <strong style="color:${BRAND.accentBright};">EDUPLA</strong> — one unified platform for documents, assignments, teacher &amp; student management, modules and assessments, competency-based TVET curriculum setup, and automated report generation — built for admins, teachers, and students alike.</p>
    <p style="margin:0 0 22px;font-size:14px;color:${BRAND.textSecondary};">Use these credentials to sign in.</p>

    ${ticketCard({
      name: name || to,
      subtitle: `${roleLabel} · EDUPLA${adminName ? ' · added by ' + adminName : ''}`,
      headIcon: '🎓',
      status: 'success',
      rows: [
        { label: 'Email', value: `<a href="mailto:${to}" style="color:${BRAND.textPrimary};text-decoration:none;">${to}</a>`, icon: '⧉' },
        { label: 'Default password', value: `<span style="letter-spacing:2px;">${defaultPassword}</span>`, mono: true, icon: '👁' },
      ],
    })}

    <div style="margin-top:20px;">
      ${calloutBox({ label: 'Security tip', text: '🔑 Please change this password after the first login.', tone: 'accent' })}
    </div>

    <div style="margin-top:20px;">
      ${dashboardTeaserCard({ greetingName: firstName, items: previewItems, liveLabel: 'ready for you' })}
    </div>

    ${ctaBtn('Log In to EDUPLA →', dashUrl)}

    ${divider()}

    ${sectionLabel('🚀 Get started in 3 steps')}
    ${stepsStrip([
      { title: 'Log in', desc: 'Use the credentials above to sign in for the first time.' },
      { title: 'Set up your account', desc: 'Change your password to something yuo know.' },
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
        { label: 'New password', value: `<span style="letter-spacing:2px;">${newPassword}</span>`, mono: true, icon: '👁' },
      ],
    })}
    <div style="margin-top:20px;">
      ${calloutBox({ label: 'Heads up', text: '🔒 Your old password no longer works — log in with the new one above, and consider changing it to something only you know.', tone: 'accent' })}
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
      ${calloutBox({ label: 'Reminder', text: '⏰ Submit your work before the deadline to avoid penalties.', tone: 'accent' })}
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
      ${calloutBox({ label: 'Before you start', text: '⏰ The assessment opens in full screen and submits automatically when time runs out or if you leave the exam screen. Make sure you\'re ready first.', tone: 'accent' })}
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