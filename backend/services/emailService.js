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

// ── HTML shell ─────────────────────────────────────────────────────────────
function wrapEmail({ title, preheader, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;color:#f4f5f7;">${preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
            <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:0.04em;">🎓 EDUPLA</span>
            <p style="margin:8px 0 0;font-size:11px;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:0.1em;">${title}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:36px 40px 28px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:18px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Automated notification from <a href="${APP_URL()}" style="color:#6366f1;text-decoration:none;">EDUPLA</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function ctaBtn(text, href) {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:13px 28px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px;box-shadow:0 4px 14px rgba(99,102,241,0.4);">${text}</a>`;
}
function infoRow(label, value) {
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:#6b7280;width:130px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;">${value}</td>
  </tr>`;
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
  const action   = isActive ? 'activated' : 'deactivated';
  const roleLabel = role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : 'Student';
  const icon      = isActive ? '✅' : '⛔';
  const color     = isActive ? '#10b981' : '#ef4444';
  const bg        = isActive ? '#f0fdf4' : '#fef2f2';
  const border    = isActive ? '#bbf7d0' : '#fecaca';

  const body = `
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#111827;">${icon} Account ${isActive ? 'Activated' : 'Deactivated'}</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Your EDUPLA account status has been updated.</p>
    <div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.08em;">Status Update</p>
      <p style="margin:0;font-size:18px;font-weight:800;color:#111827;">Your ${roleLabel} account has been <strong>${action}</strong>.</p>
    </div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${infoRow('Name', name)}
      ${infoRow('Role', roleLabel)}
      ${infoRow('Status', `<span style="color:${color};font-weight:700;">${isActive ? 'Active' : 'Inactive'}</span>`)}
    </table>
    ${isActive
      ? `<p style="margin:18px 0 0;font-size:13px;color:#6b7280;">You can now log in to EDUPLA and access your workspace.</p>${ctaBtn('Go to EDUPLA →', APP_URL())}`
      : `<p style="margin:18px 0 0;font-size:13px;color:#6b7280;">Your access has been suspended. Please contact your administrator if you believe this is a mistake.</p>`
    }`;

  await sendMail({
    to,
    subject: `${icon} EDUPLA Account ${isActive ? 'Activated' : 'Deactivated'} — ${name}`,
    html: wrapEmail({ title: `Account ${action}`, preheader: `Your EDUPLA ${roleLabel} account has been ${action}.`, body }),
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
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#111827;">Welcome to EDUPLA! 🎓</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Your ${roleLabel} account has been created. Here are your login details.</p>
    <div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.08em;">Your Credentials</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-top:8px;">
        ${infoRow('Email', to)}
        ${infoRow('Password', `<code style="background:#f1f5f9;padding:2px 8px;border-radius:6px;font-size:13px;">${defaultPassword}</code>`)}
        ${infoRow('Role', roleLabel)}
        ${adminName ? infoRow('Created by', adminName) : ''}
      </table>
    </div>
    <div style="margin-top:4px;padding:14px 18px;background:#fef3c7;border:1px solid #fde68a;border-radius:10px;font-size:13px;color:#92400e;">
      🔑 Please change your password after your first login for security.
    </div>
    ${ctaBtn('Log In to EDUPLA →', APP_URL())}`;

  await sendMail({
    to,
    subject: `🎓 Welcome to EDUPLA — Your ${roleLabel} account is ready`,
    html: wrapEmail({ title: 'Welcome to EDUPLA', preheader: `Your ${roleLabel} account has been created. Log in now.`, body }),
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
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#111827;">New Assignment Posted 📋</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Your teacher has posted a new assignment.</p>
    <div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.08em;">Assignment</p>
      <p style="margin:0;font-size:20px;font-weight:800;color:#1e1b4b;">${assignmentTitle}</p>
    </div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${infoRow('Class', className || '—')}
      ${infoRow('Teacher', teacherName)}
      ${infoRow('Deadline', `<span style="color:#ef4444;">${deadlineStr}</span>`)}
    </table>
    <div style="margin-top:20px;padding:14px 18px;background:#fef3c7;border:1px solid #fde68a;border-radius:10px;font-size:13px;color:#92400e;">
      ⏰ Please submit your work before the deadline to avoid penalties.
    </div>
    ${ctaBtn('View Assignment →', `${APP_URL()}/student/assignments`)}`;

  await sendMail({
    to: studentEmails,
    ...(teacherEmail ? { bcc: teacherEmail } : {}),
    subject: `📋 New Assignment: ${assignmentTitle}${className ? ' — ' + className : ''}`,
    html: wrapEmail({ title: 'New Assignment', preheader: `${teacherName} posted: ${assignmentTitle}`, body }),
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
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#111827;">Assignment Submitted ✅</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">A student has submitted their work for review.</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.08em;">Submission Received</p>
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
    html: wrapEmail({ title: 'Assignment Submitted', preheader: `${studentName} submitted: ${assignmentTitle}`, body }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  5. New document posted (notify students)
// ═══════════════════════════════════════════════════════════════════════════
async function notifyDocumentPosted({ studentEmails, teacherEmail, documentTitle, className, teacherName, description }) {
  if (!studentEmails?.length) return;

  const body = `
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#111827;">New Document Posted 📄</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">New study material is available for your class.</p>
    <div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.08em;">Document</p>
      <p style="margin:0;font-size:20px;font-weight:800;color:#1e1b4b;">${documentTitle}</p>
      ${description ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280;">${description}</p>` : ''}
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
    html: wrapEmail({ title: 'New Document', preheader: `${teacherName} shared: ${documentTitle}`, body }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  6. New announcement (notify students)
// ═══════════════════════════════════════════════════════════════════════════
async function notifyAnnouncement({ studentEmails, teacherEmail, announcementTitle, content, className, teacherName }) {
  if (!studentEmails?.length) return;

  const body = `
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#111827;">New Announcement 📣</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Your teacher has posted an announcement.</p>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#ea580c;text-transform:uppercase;letter-spacing:0.08em;">${className || 'General'}</p>
      <p style="margin:0 0 10px;font-size:20px;font-weight:800;color:#7c2d12;">${announcementTitle}</p>
      <p style="margin:0;font-size:14px;color:#9a3412;line-height:1.6;">${content}</p>
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
    html: wrapEmail({ title: 'New Announcement', preheader: `${teacherName}: ${announcementTitle}`, body }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  7. Online assessment shared (notify students)
// ═══════════════════════════════════════════════════════════════════════════
async function notifyAssessmentShared({ studentEmails, teacherEmail, assessmentTitle, moduleName, className, teacherName, durationMinutes, maxAttempts, expiresAt }) {
  if (!studentEmails?.length) return;
  const expiresStr = expiresAt
    ? new Date(expiresAt).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : 'No expiry set';

  const body = `
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#111827;">New Assessment to Attempt 📝</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Your teacher has shared an online assessment for you to complete.</p>
    <div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.08em;">${moduleName || 'Assessment'}</p>
      <p style="margin:0;font-size:20px;font-weight:800;color:#1e1b4b;">${assessmentTitle}</p>
    </div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${infoRow('Class', className || '—')}
      ${infoRow('Teacher', teacherName)}
      ${infoRow('Duration', durationMinutes ? `${durationMinutes} minutes` : 'No time limit')}
      ${infoRow('Attempts allowed', String(maxAttempts || 1))}
      ${infoRow('Available until', `<span style="color:#ef4444;">${expiresStr}</span>`)}
    </table>
    <div style="margin-top:20px;padding:14px 18px;background:#fef3c7;border:1px solid #fde68a;border-radius:10px;font-size:13px;color:#92400e;">
      ⏰ The assessment opens in full screen and submits automatically when time runs out or if you leave the exam screen. Make sure you're ready before you start.
    </div>
    ${ctaBtn('Go to Assessments →', `${APP_URL()}/student/assessments`)}`;

  await sendMail({
    to: studentEmails,
    ...(teacherEmail ? { bcc: teacherEmail } : {}),
    subject: `📝 New Assessment: ${assessmentTitle}${className ? ' — ' + className : ''}`,
    html: wrapEmail({ title: 'New Assessment', preheader: `${teacherName} shared: ${assessmentTitle}`, body }),
  });
}

module.exports = {
  notifyAccountStatus,
  notifyWelcome,
  notifyAssessmentShared,
  notifyAssignmentPosted,
  notifyAssignmentSubmitted,
  notifyDocumentPosted,
  notifyAnnouncement,
};
