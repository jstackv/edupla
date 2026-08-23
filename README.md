<div align="center">

# 🎓 Edupla

**A modern, all-in-one school management &amp; online assessment platform**

Built for schools that want one clean system for classes, assignments, quizzes, marks, chat, billing, and reporting — instead of five disconnected tools.

[![Live App](https://img.shields.io/badge/Live-edupla.vercel.app-6366f1?style=for-the-badge)](https://edupla.vercel.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Node](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongoosejs.com)
[![Vite](https://img.shields.io/badge/Vite-Frontend-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)

</div>

---

## What is Edupla?

Edupla is a full-stack, multi-role platform that gives a school **one system of record** for teaching and assessment. It covers the whole loop: a school admin sets up classes and accounts → teachers assign work and build quizzes → students learn, submit, and get graded → everyone sees results, marks, and reports in one place — with group chat woven throughout so classes can actually talk to each other.

It's built as a real **multi-tenant** platform: every school that signs up gets its own isolated data (classes, students, teachers, marks — nothing crosses between schools), its own subscription/billing lifecycle, and its own branding on report exports.

## ✨ Key Features

### 👑 Super Admin / School Admin
- **Multi-school management** — onboard schools, manage subscriptions and billing, review payment requests
- **Teacher & student accounts** — create accounts with auto-generated credentials, activate/deactivate, and **reset a forgotten password** in one click (generates a new one, emails it, and instantly invalidates every session on the old password)
- **Class, level & trade management** — build out your school's academic structure (levels, trades/specializations, classes, program configs)
- **Report branding** — upload a school logo/letterhead used across every PDF/Excel export
- **Impersonation** — log in "as" a teacher or student for support, without needing their password

### 👨‍🏫 Teachers
- **Assignments & documents** — post work, share files (Word/Excel/PDF/PowerPoint preview support), track submissions
- **Online quiz builder** — mix manual question authoring with **AI-generated questions** (via Gemini), across MCQ, true/false, fill-in-the-gap, matching, and open-response types
- **Flexible assessment sharing** — set attempt limits (with per-student overrides), duration, and a scheduled "available from" start time
- **Grading & analytics** — auto-graded objective questions, manual grading for open-ended answers, class performance dashboards (weighted averages, completion rate, grade-band distribution, term/year trends)
- **Polished exports** — branded PDF and Excel mark sheets, per-assessment and combined "Overall" results, generated server-side with the school's own letterhead
- **Group chat** — text, voice notes (with real-time waveform visualization), and file sharing with your classes, plus a private channel with the team-lead teacher

### 🎓 Students
- **Take assessments** — a focused, distraction-aware quiz-taking screen with live countdown, auto-save, and auto-submit on timeout
- **Track results** — a personal results dashboard per assessment (and combined series results), scored against the module's competency line — never compared to classmates
- **Review your work** — once an assessment closes, open **View Response** on any attempt to see every question next to your answer *and* the reference answer, color-coded correct/incorrect — and export the whole review as a PDF to keep
- **Classes, modules & documents** — a certificate-styled class view, a modules browser, and access to everything a teacher shares
- **Group chat** — the same rich chat experience as teachers, restyled for a distinct student aesthetic

### 🌍 Platform-wide
- **Multi-language** — English, French, and Kinyarwanda (`react-i18next`)
- **Secure by default** — JWT auth, bcrypt-hashed passwords, role-based route protection, session invalidation on deactivation/password reset
- **Cloud media** — Cloudinary-backed uploads for documents, avatars, and chat media
- **Billing & subscriptions** — trial periods, MoMo payment integration, and a manual-payment review flow for admins

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite, React Router, Tailwind CSS + inline styles, Lucide icons, `react-i18next` |
| **Backend** | Node.js + Express, JWT auth, `express-validator` |
| **Database** | MongoDB + Mongoose |
| **Media storage** | Cloudinary |
| **AI** | Google Gemini (`gemini-2.5-flash` family) for AI-assisted question generation |
| **Documents** | `pdfkit` (PDF generation), `exceljs` (Excel generation), `mammoth` / `xlsx` (in-browser Word/Excel preview) |
| **Email** | Nodemailer |
| **Deployment** | Vercel (monorepo — separate frontend & backend deployments) |

## 📁 Project Structure

```
edupla/
├── frontend/                # React + Vite SPA
│   └── src/
│       ├── pages/
│       │   ├── admin/       # School admin & super admin screens
│       │   ├── teacher/     # Teacher-facing screens
│       │   ├── student/     # Student-facing screens
│       │   └── auth/        # Login / auth flows
│       ├── components/
│       │   └── common/      # Shared modals, cards, chat components, etc.
│       ├── context/         # Auth, billing, chat-notification, pending-payments contexts
│       └── utils/           # API client, formatting helpers
│
└── backend/                 # Node.js + Express API
    ├── controllers/         # Route handlers (admin, teacher, student, assessment, auth, billing…)
    ├── models/db.js         # Every Mongoose schema, in one file
    ├── routes/               # Express routers, one per domain area
    ├── middleware/           # Auth guard, upload (Cloudinary/multer)
    ├── services/             # Email service, MoMo payment service
    └── scripts/              # One-off maintenance scripts
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A MongoDB connection string (Atlas or self-hosted)
- A Cloudinary account (for file/media uploads)
- *(Optional)* an SMTP account for transactional email, a Gemini API key for AI question generation, and MTN MoMo API credentials for payments

### 1. Clone & install

```bash
git clone https://github.com/jstackv/edupla.git
cd edupla

cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment variables

Create `backend/.env`:

```env
# Core
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>
DB_NAME=edupla
JWT_SECRET=<a-long-random-secret>
APP_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000

# Cloudinary (file & media uploads)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Email (Nodemailer — optional but recommended)
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM="Edupla <noreply@yourschool.com>"

# Default credentials assigned to newly-created accounts
TEACHER_DEFAULT_PASSWORD=ChangeMe123
STUDENT_DEFAULT_PASSWORD=ChangeMe123

# Platform owner (super admin) bootstrap
EDUPLA_OWNER_NAME=
EDUPLA_OWNER_EMAIL=
EDUPLA_OWNER_PHONE=

# Subscriptions / trial
TRIAL_DAYS=30
SUBSCRIPTION_AMOUNT=
SUBSCRIPTION_PLAN_DAYS=30

# MTN MoMo (optional — only needed for in-app payments)
MOMO_BASE_URL=
MOMO_TARGET_ENVIRONMENT=
MOMO_SUBSCRIPTION_KEY=
MOMO_API_USER=
MOMO_API_KEY=
MOMO_CALLBACK_HOST=
MOMO_CURRENCY=
MOMO_DEBUG=false

# AI question generation (optional — get a key at aistudio.google.com)
GEMINI_API_KEY=
```

Create `frontend/.env` if you need to point at a non-default API URL (the dev server already proxies `/api` → `http://localhost:5000`, so this is usually unnecessary locally).

### 3. Run it

```bash
# Terminal 1 — backend (http://localhost:5000)
cd backend && npm run dev

# Terminal 2 — frontend (http://localhost:3000)
cd frontend && npm run dev
```

On first boot, the backend bootstraps a super admin account from `EDUPLA_OWNER_*` — log in with that to start onboarding a school.

### 4. Build for production

```bash
cd frontend && npm run build   # outputs to frontend/dist
```

The project deploys as two separate Vercel projects (frontend static build + backend serverless/Node API) from the same monorepo.

## 🔐 Roles at a Glance

| Role | Can do |
|---|---|
| **Super Admin** | Manage every school on the platform, review payments, platform-wide settings |
| **School Admin** | Manage their school's teachers, students, classes, subscription |
| **Teacher** | Manage their classes: assignments, documents, announcements, assessments, grading, chat |
| **Student** | Attend classes, submit work, take assessments, view results, chat |

## 🤝 Contributing

This is a solo-maintained project by [@jstackv](https://github.com/jstackv). Issues and pull requests are welcome — please open an issue describing the change before submitting a large PR.

## 📄 License

No license file is currently published for this repository — all rights reserved by the author unless stated otherwise. Reach out via GitHub if you'd like to discuss usage.

---

<div align="center">
<sub>Built with ❤️ in Kigali, Rwanda</sub>
</div>
