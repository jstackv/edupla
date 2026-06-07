require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, User, Class, Level, Trade } = require('./models/db');

async function seed() {
  await connectDB();
  try {
    // ── Super Admin ────────────────────────────────────────────────────
    const adminPass = await bcrypt.hash('admin123', 10);
    const superAdmin = await User.findOneAndUpdate(
      { email: 'admin@edupla.edu' },
      { name: 'School Manager', email: 'admin@edupla.edu', password: adminPass, role: 'admin', is_super_admin: true, is_active: true },
      { upsert: true, new: true }
    );

    // ── Second Admin ──────────────────────────────────────────────────
    const admin2Pass = await bcrypt.hash('admin456', 10);
    const admin2 = await User.findOneAndUpdate(
      { email: 'admin2@edupla.edu' },
      { name: 'Branch Manager', email: 'admin2@edupla.edu', password: admin2Pass, role: 'admin', is_super_admin: false, is_active: true },
      { upsert: true, new: true }
    );

    // ── Levels for Super Admin ─────────────────────────────────────────
    for (const [value, label] of [['L1', 'Level 1'], ['L2', 'Level 2'], ['L3', 'Level 3']]) {
      await Level.findOneAndUpdate(
        { value, created_by: superAdmin._id },
        { value, label, created_by: superAdmin._id },
        { upsert: true }
      );
    }

    // ── Levels for Admin 2 ────────────────────────────────────────────
    for (const [value, label] of [['A1', 'Advanced 1'], ['A2', 'Advanced 2']]) {
      await Level.findOneAndUpdate(
        { value, created_by: admin2._id },
        { value, label, created_by: admin2._id },
        { upsert: true }
      );
    }

    // ── Trades for Super Admin ────────────────────────────────────────
    for (const [value, label] of [['ICT', 'Information & Communication Technology'], ['ELE', 'Electronics'], ['MEC', 'Mechanics']]) {
      await Trade.findOneAndUpdate(
        { value, created_by: superAdmin._id },
        { value, label, created_by: superAdmin._id },
        { upsert: true }
      );
    }

    // ── Trades for Admin 2 ────────────────────────────────────────────
    for (const [value, label] of [['CONS', 'Construction'], ['AGRI', 'Agriculture']]) {
      await Trade.findOneAndUpdate(
        { value, created_by: admin2._id },
        { value, label, created_by: admin2._id },
        { upsert: true }
      );
    }

    // ── Teachers (under Super Admin) ──────────────────────────────────
    const t1Pass = await bcrypt.hash('teacher123', 10);
    const t2Pass = await bcrypt.hash('teacher456', 10);

    const t1 = await User.findOneAndUpdate(
      { email: 'teacher@school.edu' },
      { name: 'Alice Uwase', email: 'teacher@school.edu', password: t1Pass, role: 'teacher', created_by: superAdmin._id, is_active: true },
      { upsert: true, new: true }
    );
    const t2 = await User.findOneAndUpdate(
      { email: 'teacher2@school.edu' },
      { name: 'Bob Habimana', email: 'teacher2@school.edu', password: t2Pass, role: 'teacher', created_by: superAdmin._id, is_active: true },
      { upsert: true, new: true }
    );

    // ── Teachers (under Admin 2) ──────────────────────────────────────
    const t3Pass = await bcrypt.hash('teacher789', 10);
    const t3 = await User.findOneAndUpdate(
      { email: 'teacher3@school.edu' },
      { name: 'Claire Mukamana', email: 'teacher3@school.edu', password: t3Pass, role: 'teacher', created_by: admin2._id, is_active: true },
      { upsert: true, new: true }
    );

    // ── Classes (under Super Admin) ───────────────────────────────────
    await Class.findOneAndUpdate(
      { name: 'Web Development Basics' },
      { name: 'Web Development Basics', description: 'Intro to HTML, CSS and JavaScript', teacher_id: t1._id, created_by: superAdmin._id },
      { upsert: true }
    );
    await Class.findOneAndUpdate(
      { name: 'Database Systems' },
      { name: 'Database Systems', description: 'MongoDB, design and normalization', teacher_id: t1._id, created_by: superAdmin._id },
      { upsert: true }
    );
    await Class.findOneAndUpdate(
      { name: 'Advanced React' },
      { name: 'Advanced React', description: 'State management, hooks and patterns', teacher_id: t1._id, created_by: superAdmin._id },
      { upsert: true }
    );
    await Class.findOneAndUpdate(
      { name: 'Network Fundamentals' },
      { name: 'Network Fundamentals', description: 'OSI model and TCP/IP', teacher_id: t2._id, created_by: superAdmin._id },
      { upsert: true }
    );
    await Class.findOneAndUpdate(
      { name: 'Cybersecurity Basics' },
      { name: 'Cybersecurity Basics', description: 'Threats, tools, and defense', teacher_id: t2._id, created_by: superAdmin._id },
      { upsert: true }
    );

    // ── Classes (under Admin 2) ───────────────────────────────────────
    await Class.findOneAndUpdate(
      { name: 'Construction Safety' },
      { name: 'Construction Safety', description: 'Workplace safety and regulations', teacher_id: t3._id, created_by: admin2._id },
      { upsert: true }
    );

    // ── Students (under Super Admin) ──────────────────────────────────
    const sPass = await bcrypt.hash('student123', 10);
    const s1 = await User.findOneAndUpdate(
      { email: 'student@school.edu' },
      { name: 'Jean Paul Uwimana', email: 'student@school.edu', password: sPass, role: 'student', level: 'L1', trade: 'ICT', created_by: superAdmin._id, is_active: true },
      { upsert: true, new: true }
    );
    await User.findOneAndUpdate(
      { email: 'marie@school.edu' },
      { name: 'Marie Claire Ingabire', email: 'marie@school.edu', password: sPass, role: 'student', level: 'L2', trade: 'ICT', created_by: superAdmin._id, is_active: true },
      { upsert: true }
    );
    await User.findOneAndUpdate(
      { email: 'eric@school.edu' },
      { name: 'Eric Nkurunziza', email: 'eric@school.edu', password: sPass, role: 'student', level: 'L1', trade: 'ELE', created_by: superAdmin._id, is_active: true },
      { upsert: true }
    );
    await User.findOneAndUpdate(
      { email: 'grace@school.edu' },
      { name: 'Grace Mutoni', email: 'grace@school.edu', password: sPass, role: 'student', level: 'L3', trade: 'MEC', created_by: superAdmin._id, is_active: true },
      { upsert: true }
    );

    // ── Students (under Admin 2) ──────────────────────────────────────
    await User.findOneAndUpdate(
      { email: 'patrick@school.edu' },
      { name: 'Patrick Niyonzima', email: 'patrick@school.edu', password: sPass, role: 'student', level: 'A1', trade: 'CONS', created_by: admin2._id, is_active: true },
      { upsert: true }
    );

    // Enroll s1 in two classes
    await Class.updateOne({ name: 'Web Development Basics' }, { $addToSet: { students: s1._id } });
    await Class.updateOne({ name: 'Database Systems' }, { $addToSet: { students: s1._id } });

    console.log('✅ Seed complete!');
    console.log('');
    console.log('── Super Admin ─────────────────────────────────────');
    console.log('   Email:    admin@edupla.edu');
    console.log('   Password: admin123');
    console.log('');
    console.log('── Admin 2 ─────────────────────────────────────────');
    console.log('   Email:    admin2@edupla.edu');
    console.log('   Password: admin456');
    console.log('');
    console.log('── Teacher 1 (under Super Admin) ───────────────────');
    console.log('   Email:    teacher@school.edu');
    console.log('   Password: teacher123');
    console.log('');
    console.log('── Teacher 2 (under Super Admin) ───────────────────');
    console.log('   Email:    teacher2@school.edu');
    console.log('   Password: teacher456');
    console.log('');
    console.log('── Teacher 3 (under Admin 2) ───────────────────────');
    console.log('   Email:    teacher3@school.edu');
    console.log('   Password: teacher789');
    console.log('');
    console.log('── Students ────────────────────────────────────────');
    console.log('   Email:    student@school.edu  Password: student123');
    console.log('   Email:    marie@school.edu    Password: student123');
    console.log('   Email:    eric@school.edu     Password: student123');
    console.log('   Email:    grace@school.edu    Password: student123');
    console.log('   Email:    patrick@school.edu  Password: student123  (under Admin 2)');
    process.exit(0);
  } catch (err) { console.error(err); process.exit(1); }
}
seed();
