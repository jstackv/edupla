require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, User, Class } = require('./models/db');

async function seed() {
  await connectDB();
  try {
    // Admin
    const adminPass = await bcrypt.hash('admin123', 10);
    await User.findOneAndUpdate(
      { email: 'admin@edupla.edu' },
      { name: 'School Manager', email: 'admin@edupla.edu', password: adminPass, role: 'admin' },
      { upsert: true }
    );

    // Teachers
    const t1Pass = await bcrypt.hash('teacher123', 10);
    const t2Pass = await bcrypt.hash('teacher456', 10);

    const t1 = await User.findOneAndUpdate(
      { email: 'teacher@school.edu' },
      { name: 'Alice Uwase', email: 'teacher@school.edu', password: t1Pass, role: 'teacher' },
      { upsert: true, new: true }
    );
    const t2 = await User.findOneAndUpdate(
      { email: 'teacher2@school.edu' },
      { name: 'Bob Habimana', email: 'teacher2@school.edu', password: t2Pass, role: 'teacher' },
      { upsert: true, new: true }
    );

    // Classes for teacher 1
    await Class.findOneAndUpdate(
      { name: 'Web Development Basics' },
      { name: 'Web Development Basics', description: 'Intro to HTML, CSS and JavaScript', teacher_id: t1._id },
      { upsert: true }
    );
    await Class.findOneAndUpdate(
      { name: 'Database Systems' },
      { name: 'Database Systems', description: 'MongoDB, design and normalization', teacher_id: t1._id },
      { upsert: true }
    );
    await Class.findOneAndUpdate(
      { name: 'Advanced React' },
      { name: 'Advanced React', description: 'State management, hooks and patterns', teacher_id: t1._id },
      { upsert: true }
    );

    // Classes for teacher 2
    await Class.findOneAndUpdate(
      { name: 'Network Fundamentals' },
      { name: 'Network Fundamentals', description: 'OSI model and TCP/IP', teacher_id: t2._id },
      { upsert: true }
    );
    await Class.findOneAndUpdate(
      { name: 'Cybersecurity Basics' },
      { name: 'Cybersecurity Basics', description: 'Threats, tools, and defense', teacher_id: t2._id },
      { upsert: true }
    );

    // Students
    const sPass = await bcrypt.hash('student123', 10);
    const s1 = await User.findOneAndUpdate(
      { email: 'student@school.edu' },
      { name: 'Jean Paul Uwimana', email: 'student@school.edu', password: sPass, role: 'student' },
      { upsert: true, new: true }
    );
    await User.findOneAndUpdate({ email: 'marie@school.edu' }, { name: 'Marie Claire Ingabire', email: 'marie@school.edu', password: sPass, role: 'student' }, { upsert: true });
    await User.findOneAndUpdate({ email: 'eric@school.edu' }, { name: 'Eric Nkurunziza', email: 'eric@school.edu', password: sPass, role: 'student' }, { upsert: true });
    await User.findOneAndUpdate({ email: 'grace@school.edu' }, { name: 'Grace Mutoni', email: 'grace@school.edu', password: sPass, role: 'student' }, { upsert: true });

    // Enroll s1 in two classes
    await Class.updateOne({ name: 'Web Development Basics' }, { $addToSet: { students: s1._id } });
    await Class.updateOne({ name: 'Database Systems' }, { $addToSet: { students: s1._id } });

    console.log('✅ Seed complete!');
    console.log('   Admin:      admin@edupla.edu / admin123');
    console.log('   Teacher 1:  teacher@school.edu / teacher123');
    console.log('   Teacher 2:  teacher2@school.edu / teacher456');
    console.log('   Student:    student@school.edu / student123');
    process.exit(0);
  } catch (err) { console.error(err); process.exit(1); }
}
seed();
