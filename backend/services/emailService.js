const nodemailer = require('nodemailer');

// ── Transporter ────────────────────────────────────────────────────────────
function createTransporter() {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️  Email not configured. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS in .env');
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

// ── Brand palette — Dark Orange ─────────────────────────────────────────────
const BRAND = {
  deep:       '#7c2d12', // orange-900 — deepest text accent on tint bg
  dark:       '#9a3412', // orange-800 — gradient end
  main:       '#c2410c', // orange-700 — primary brand
  mid:        '#ea580c', // orange-600 — gradient start
  bright:     '#f97316', // orange-500 — highlights / icons
  amber:      '#f59e0b', // amber-500 — warning accent
  tintBg:     '#fff7ed', // orange-50  — soft card background
  tintBorder: '#fed7aa', // orange-200 — soft card border
  chipBg:     '#ffedd5', // orange-100 — chip background
};

// ── HTML shell ─────────────────────────────────────────────────────────────
function wrapEmail({ title, preheader, body, badge }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${title}</title></head>
<body style="margin:0;padding:0;background:#fdf6ef;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;color:#fdf6ef;">${preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fdf6ef;background-image:radial-gradient(circle at 15% 0%, rgba(249,115,22,0.10) 0%, rgba(249,115,22,0) 45%);padding:36px 16px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" role="presentation" style="max-width:620px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#f97316 0%,#ea580c 45%,#9a3412 100%);border-radius:22px 22px 0 0;padding:0;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:34px 32px 26px;text-align:center;">
                  <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 14px;">
                    <tr>
                      <td style="width:56px;height:56px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.35);border-radius:16px;text-align:center;vertical-align:middle;font-size:26px;box-shadow:0 6px 18px rgba(124,45,18,0.35);">🎓</td>
                    </tr>
                  </table>
                  <div style="font-size:23px;font-weight:800;color:#fff;letter-spacing:0.05em;">EDUPLA</div>
                  <p style="margin:10px 0 0;font-size:11px;font-weight:700;color:#ffedd5;text-transform:uppercase;letter-spacing:0.14em;">${title}</p>
                  ${badge ? `<div style="margin-top:14px;">${badge}</div>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:38px 40px 30px;border-left:1px solid #fde8d4;border-right:1px solid #fde8d4;box-shadow:0 24px 48px -24px rgba(154,52,18,0.18);">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fff7ed;border:1px solid #fde8d4;border-top:1px solid #fed7aa;border-radius:0 0 22px 22px;padding:22px 32px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:#c2703e;">
              Automated notification from <a href="${APP_URL()}" style="color:#c2410c;font-weight:700;text-decoration:none;">EDUPLA</a>
            </p>
            <p style="margin:0;font-size:11px;color:#d6a67c;">Empowering classrooms, one lesson at a time 🔥</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

function badgeChip(text) {
  return `<span style="display:inline-block;padding:5px 14px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.4);border-radius:999px;font-size:11px;font-weight:700;color:#fff;letter-spacing:0.04em;">${text}</span>`;
}

function ctaBtn(text, href) {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:26px;">
    <tr><td style="border-radius:12px;background:linear-gradient(135deg,#f97316,#c2410c);box-shadow:0 10px 24px -6px rgba(194,65,12,0.55);">
      <a href="${href}" style="display:inline-block;padding:14px 30px;color:#fff;font-size:14px;font-weight:800;text-decoration:none;letter-spacing:0.01em;">${text}</a>
    </td></tr>
  </table>`;
}

function infoRow(label, value) {
  return `<tr>
    <td style="padding:8px 0;font-size:13px;color:#9a5b32;width:130px;vertical-align:top;border-bottom:1px solid #fdeee0;">${label}</td>
    <td style="padding:8px 0;font-size:13px;color:#431407;font-weight:700;border-bottom:1px solid #fdeee0;">${value}</td>
  </tr>`;
}

function sectionLabel(text) {
  return `<p style="margin:0 0 4px;font-size:11px;font-weight:800;color:${BRAND.main};text-transform:uppercase;letter-spacing:0.1em;">${text}</p>`;
}

// A 3-step "getting started" strip — table-based so it renders in Outlook/Gmail.
function stepsStrip(steps) {
  const cells = steps.map((s, i) => `
    <td width="${Math.floor(100 / steps.length)}%" valign="top" style="padding:0 8px;">
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        <tr><td style="width:30px;height:30px;background:${BRAND.chipBg};border:1px solid ${BRAND.tintBorder};border-radius:50%;text-align:center;vertical-align:middle;font-size:13px;font-weight:800;color:${BRAND.main};">${i + 1}</td></tr>
        <tr><td style="padding-top:8px;font-size:12px;font-weight:700;color:#431407;line-height:1.4;">${s.title}</td></tr>
        <tr><td style="padding-top:2px;font-size:11.5px;color:#9a5b32;line-height:1.5;">${s.desc}</td></tr>
      </table>
    </td>`).join('<td width="16"></td>');

  return `<table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin-top:26px;">
    <tr>${cells}</tr>
  </table>`;
}

function divider() {
  return `<div style="height:1px;background:linear-gradient(90deg,rgba(194,65,12,0) 0%,#fed7aa 50%,rgba(194,65,12,0) 100%);margin:26px 0;"></div>`;
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
  const icon      = isActive ? '✅' : '⛔';
  const color     = isActive ? '#15803d' : '#dc2626';
  const bg        = isActive ? '#f0fdf4' : '#fef2f2';
  const border    = isActive ? '#bbf7d0' : '#fecaca';

  const body = `
    <h2 style="margin:0 0 6px;font-size:23px;font-weight:800;color:#1c0a02;">${icon} Account ${isActive ? 'Activated' : 'Deactivated'}</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#9a5b32;">Your EDUPLA account status has been updated.</p>
    <div style="background:${bg};border:1px solid ${border};border-radius:14px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:0.08em;">Status Update</p>
      <p style="margin:0;font-size:18px;font-weight:800;color:#1c0a02;">Your ${roleLabel} account has been <strong>${action}</strong>.</p>
    </div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${infoRow('Name', name)}
      ${infoRow('Role', roleLabel)}
      ${infoRow('Status', `<span style="color:${color};font-weight:800;">${isActive ? 'Active' : 'Inactive'}</span>`)}
    </table>
    ${isActive
      ? `<p style="margin:18px 0 0;font-size:13px;color:#9a5b32;">You can now log in to EDUPLA and access your workspace.</p>${ctaBtn('Go to EDUPLA →', APP_URL())}`
      : `<p style="margin:18px 0 0;font-size:13px;color:#9a5b32;">Your access has been suspended. Please contact your administrator if you believe this is a mistake.</p>`
    }`;

  await sendMail({
    to,
    subject: `${icon} EDUPLA Account ${isActive ? 'Activated' : 'Deactivated'} — ${name}`,
    html: wrapEmail({
      title: `Account ${action}`,
      preheader: `Your EDUPLA ${roleLabel} account has been ${action}.`,
      badge: badgeChip(roleLabel),
      body,
    }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  2. Welcome — new account created
// ═══════════════════════════════════════════════════════════════════════════
async function notifyWelcome({ to, name, role, defaultPassword, adminName }) {
  if (!to) return;
  const roleLabel = role === 'teacher' ? 'Teacher' : 'Student';
  const dashUrl   = role === 'teacher' ? `${APP_URL()}/teacher` : `${APP_URL()}/student`;

  const body = `
    <h2 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#1c0a02;">Welcome to EDUPLA! 🎓</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#9a5b32;">${name ? `Hi ${name}, y` : 'Y'}our ${roleLabel} account has been created. Here are your login details.</p>

    <div style="background:linear-gradient(135deg,${BRAND.tintBg},#ffffff);border:1px solid ${BRAND.tintBorder};border-radius:16px;padding:22px 24px;margin-bottom:24px;box-shadow:0 10px 26px -14px rgba(194,65,12,0.35);">
      ${sectionLabel('🔐 Your Credentials')}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-top:10px;">
        ${infoRow('Email', `<a href="mailto:${to}" style="color:#431407;text-decoration:none;">${to}</a>`)}
        ${infoRow('Password', `<span style="display:inline-block;background:${BRAND.chipBg};border:1px solid ${BRAND.tintBorder};color:${BRAND.deep};padding:3px 10px;border-radius:7px;font-size:13px;font-family:Menlo,Consolas,monospace;">${defaultPassword}</span>`)}
        ${infoRow('Role', `<span style="display:inline-block;background:${BRAND.main};color:#fff;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:800;">${roleLabel}</span>`)}
        ${adminName ? infoRow('Created by', adminName) : ''}
      </table>
    </div>

    <div style="padding:14px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;font-size:13px;color:#92400e;">
      🔑 <strong>Please change your password</strong> after your first login for security.
    </div>

    ${ctaBtn(`Log In to EDUPLA →`, dashUrl)}

    ${divider()}

    ${sectionLabel('🚀 Get started in 3 steps')}
    ${stepsStrip([
      { title: 'Log in', desc: 'Use the credentials above to sign in for the first time.' },
      { title: 'Set up your profile', desc: 'Add a photo and confirm your details.' },
      { title: role === 'teacher' ? 'Create your first class' : 'Explore your classes', desc: role === 'teacher' ? 'Set up a class and invite students.' : 'Check assignments, docs and announcements.' },
    ])}`;

  await sendMail({
    to,
    subject: `🎓 Welcome to EDUPLA — Your ${roleLabel} account is ready`,
    html: wrapEmail({
      title: 'Welcome to EDUPLA',
      preheader: `Your ${roleLabel} account has been created. Log in now.`,
      badge: badgeChip(`New ${roleLabel} Account`),
      body,
    }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  2b. Password reset — admin reset a teacher's or student's password
// ═══════════════════════════════════════════════════════════════════════════
async function notifyPasswordReset({ to, name, role, newPassword, adminName }) {
  if (!to) return;
  const roleLabel = role === 'teacher' ? 'Teacher' : 'Student';

  const body = `
    <h2 style="margin:0 0 6px;font-size:23px;font-weight:800;color:#1c0a02;">🔑 Your Password Was Reset</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#9a5b32;">${adminName ? `${adminName} (your school admin)` : 'Your school admin'} reset your EDUPLA password. Here's your new login.</p>
    <div style="background:${BRAND.tintBg};border:1px solid ${BRAND.tintBorder};border-radius:14px;padding:20px 24px;margin-bottom:24px;">
      ${sectionLabel('Your New Credentials')}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-top:8px;">
        ${infoRow('Email', to)}
        ${infoRow('New Password', `<span style="display:inline-block;background:${BRAND.chipBg};border:1px solid ${BRAND.tintBorder};color:${BRAND.deep};padding:3px 10px;border-radius:7px;font-size:13px;font-family:Menlo,Consolas,monospace;">${newPassword}</span>`)}
        ${infoRow('Role', roleLabel)}
      </table>
    </div>
    <div style="margin-top:4px;padding:14px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;font-size:13px;color:#92400e;">
      🔒 Your old password no longer works. Please log in with the new password above, and consider changing it to something only you know.
    </div>
    ${ctaBtn('Log In to EDUPLA →', APP_URL())}`;

  await sendMail({
    to,
    subject: `🔑 EDUPLA Password Reset — ${name}`,
    html: wrapEmail({
      title: 'Password Reset',
      preheader: `Your EDUPLA password was reset by an admin.`,
      badge: badgeChip(roleLabel),
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
    <h2 style="margin:0 0 6px;font-size:23px;font-weight:800;color:#1c0a02;">New Assignment Posted 📋</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#9a5b32;">Your teacher has posted a new assignment.</p>
    <div style="background:${BRAND.tintBg};border:1px solid ${BRAND.tintBorder};border-radius:14px;padding:20px 24px;margin-bottom:24px;">
      ${sectionLabel('Assignment')}
      <p style="margin:0;font-size:20px;font-weight:800;color:${BRAND.deep};">${assignmentTitle}</p>
    </div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${infoRow('Class', className || '—')}
      ${infoRow('Teacher', teacherName)}
      ${infoRow('Deadline', `<span style="color:#dc2626;font-weight:800;">${deadlineStr}</span>`)}
    </table>
    <div style="margin-top:20px;padding:14px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;font-size:13px;color:#92400e;">
      ⏰ Please submit your work before the deadline to avoid penalties.
    </div>
    ${ctaBtn('View Assignment →', `${APP_URL()}/student/assignments`)}`;

  await sendMail({
    to: studentEmails,
    ...(teacherEmail ? { bcc: teacherEmail } : {}),
    subject: `📋 New Assignment: ${assignmentTitle}${className ? ' — ' + className : ''}`,
    html: wrapEmail({ title: 'New Assignment', preheader: `${teacherName} posted: ${assignmentTitle}`, badge: badgeChip(className || 'Assignment'), body }),
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
    <h2 style="margin:0 0 6px;font-size:23px;font-weight:800;color:#1c0a02;">Assignment Submitted ✅</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#9a5b32;">A student has submitted their work for review.</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:800;color:#16a34a;text-transform:uppercase;letter-spacing:0.08em;">Submission Received</p>
      <p style="margin:0;font-size:20px;font-weight:800;color:#14532d;">${assignmentTitle}</p>
    </div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${infoRow('Student', studentName)}
      ${infoRow('Class', className || '—')}
      ${infoRow('Submitted at', submittedStr)}
    </table>
    ${ctaBtn('Review Submission →', `${APP_URL()}/teacher/assignments`)}`;

  await sendMail({
    to: teacherEmail,
    subject: `✅ Submission: ${studentName} — ${assignmentTitle}`,
    html: wrapEmail({ title: 'Assignment Submitted', preheader: `${studentName} submitted: ${assignmentTitle}`, badge: badgeChip('Teacher'), body }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  5. New document posted (notify students)
// ═══════════════════════════════════════════════════════════════════════════
async function notifyDocumentPosted({ studentEmails, teacherEmail, documentTitle, className, teacherName, description }) {
  if (!studentEmails?.length) return;

  const body = `
    <h2 style="margin:0 0 6px;font-size:23px;font-weight:800;color:#1c0a02;">New Document Posted 📄</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#9a5b32;">New study material is available for your class.</p>
    <div style="background:${BRAND.tintBg};border:1px solid ${BRAND.tintBorder};border-radius:14px;padding:20px 24px;margin-bottom:24px;">
      ${sectionLabel('Document')}
      <p style="margin:0;font-size:20px;font-weight:800;color:${BRAND.deep};">${documentTitle}</p>
      ${description ? `<p style="margin:8px 0 0;font-size:13px;color:#9a5b32;">${description}</p>` : ''}
    </div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${infoRow('Class', className || 'All classes')}
      ${infoRow('Shared by', teacherName)}
    </table>
    ${ctaBtn('View Document →', `${APP_URL()}/student/documents`)}`;

  await sendMail({
    to: studentEmails,
    ...(teacherEmail ? { bcc: teacherEmail } : {}),
    subject: `📄 New Document: ${documentTitle}${className ? ' — ' + className : ''}`,
    html: wrapEmail({ title: 'New Document', preheader: `${teacherName} shared: ${documentTitle}`, badge: badgeChip(className || 'Document'), body }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  6. New announcement (notify students)
// ═══════════════════════════════════════════════════════════════════════════
async function notifyAnnouncement({ studentEmails, teacherEmail, announcementTitle, content, className, teacherName }) {
  if (!studentEmails?.length) return;

  const body = `
    <h2 style="margin:0 0 6px;font-size:23px;font-weight:800;color:#1c0a02;">New Announcement 📣</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#9a5b32;">Your teacher has posted an announcement.</p>
    <div style="background:linear-gradient(135deg,#fff7ed,#ffedd5);border:1px solid #fdba74;border-radius:14px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:800;color:${BRAND.main};text-transform:uppercase;letter-spacing:0.08em;">${className || 'General'}</p>
      <p style="margin:0 0 10px;font-size:20px;font-weight:800;color:${BRAND.deep};">${announcementTitle}</p>
      <p style="margin:0;font-size:14px;color:#7c2d12;line-height:1.6;">${content}</p>
    </div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${infoRow('Posted by', teacherName)}
      ${className ? infoRow('Class', className) : ''}
    </table>
    ${ctaBtn('View Announcements →', `${APP_URL()}/student/announcements`)}`;

  await sendMail({
    to: studentEmails,
    ...(teacherEmail ? { bcc: teacherEmail } : {}),
    subject: `📣 Announcement: ${announcementTitle}`,
    html: wrapEmail({ title: 'New Announcement', preheader: `${teacherName}: ${announcementTitle}`, badge: badgeChip(className || 'Announcement'), body }),
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
  // Only mention a start time when it's actually in the future — no point
  // telling a student to wait for a window that already opened.
  const availableFromStr = availableFrom && new Date(availableFrom) > new Date()
    ? new Date(availableFrom).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;

  const body = `
    <h2 style="margin:0 0 6px;font-size:23px;font-weight:800;color:#1c0a02;">New Assessment to Attempt 📝</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#9a5b32;">Your teacher has shared an online assessment for you to complete.</p>
    <div style="background:${BRAND.tintBg};border:1px solid ${BRAND.tintBorder};border-radius:14px;padding:20px 24px;margin-bottom:24px;">
      ${sectionLabel(moduleName || 'Assessment')}
      <p style="margin:0;font-size:20px;font-weight:800;color:${BRAND.deep};">${assessmentTitle}</p>
    </div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${infoRow('Class', className || '—')}
      ${infoRow('Teacher', teacherName)}
      ${infoRow('Duration', durationMinutes ? `${durationMinutes} minutes` : 'No time limit')}
      ${infoRow('Attempts allowed', String(maxAttempts || 1))}
      ${availableFromStr ? infoRow('Starts', `<span style="color:${BRAND.amber};font-weight:800;">${availableFromStr}</span>`) : ''}
      ${infoRow('Available until', `<span style="color:#dc2626;font-weight:800;">${expiresStr}</span>`)}
    </table>
    <div style="margin-top:20px;padding:14px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;font-size:13px;color:#92400e;">
      ⏰ The assessment opens in full screen and submits automatically when time runs out or if you leave the exam screen. Make sure you're ready before you start.
    </div>
    ${ctaBtn('Go to Assessments →', `${APP_URL()}/student/assessments`)}`;

  await sendMail({
    to: studentEmails,
    ...(teacherEmail ? { bcc: teacherEmail } : {}),
    subject: `📝 New Assessment: ${assessmentTitle}${className ? ' — ' + className : ''}`,
    html: wrapEmail({ title: 'New Assessment', preheader: `${teacherName} shared: ${assessmentTitle}`, badge: badgeChip(className || 'Assessment'), body }),
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