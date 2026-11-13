import { PrismaClient, Role, UserStatus, LabCategory, LabDifficulty } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@virtuallab.edu';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@Lab2026!';
  const adminFirstName = process.env.ADMIN_FIRST_NAME || 'System';
  const adminLastName = process.env.ADMIN_LAST_NAME || 'Administrator';

  // 1. Seed or update the initial Admin account
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(adminPassword, salt);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: adminEmail,
      passwordHash,
      firstName: adminFirstName,
      lastName: adminLastName,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      storageQuotaBytes: BigInt(1073741824), // 1 GB for admin
      profile: {
        create: {
          studentId: 'STAFF-001',
          department: 'Computer Science & Engineering',
          bio: 'System Administrator and Lead Lab Coordinator',
        },
      },
    },
  });

  console.log(`✅ Admin account seeded: ${adminUser.email} (Role: ${adminUser.role})`);

  // 2. Seed or update the demo Student account
  const studentEmail = 'student@virtuallab.edu';
  const studentPassword = process.env.STUDENT_PASSWORD || 'Student@Lab2026!';
  const studentPasswordHash = await bcrypt.hash(studentPassword, salt);

  const studentUser = await prisma.user.upsert({
    where: { email: studentEmail },
    update: {
      passwordHash: studentPasswordHash,
      role: Role.STUDENT,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: studentEmail,
      passwordHash: studentPasswordHash,
      firstName: 'Alex',
      lastName: 'Chen',
      role: Role.STUDENT,
      status: UserStatus.ACTIVE,
      storageQuotaBytes: BigInt(104857600), // 100 MB
      profile: {
        create: {
          studentId: 'CS-2026-042',
          department: 'Computer Science & Engineering',
          bio: 'Undergraduate Computer Science Student',
        },
      },
    },
  });

  console.log(`✅ Demo Student account seeded: ${studentUser.email} (Role: ${studentUser.role})`);

  // 2. Seed Default Laboratories
  const defaultLabs = [
    {
      title: 'Linux Command-Line Essentials',
      slug: 'linux-command-basics',
      description: 'Master core Linux terminal commands including navigation, directory structure, file management, and permissions in a sandboxed shell.',
      category: LabCategory.LINUX,
      difficulty: LabDifficulty.BEGINNER,
      estimatedMinutes: 25,
      exercises: [
        {
          orderIndex: 1,
          title: 'Working Directory & Inspection',
          instruction: 'Explore the current working directory using `pwd` and inspect files using `ls -la`.',
          hint: 'Type "pwd" and press Enter, then type "ls -la".',
          expectedCommand: 'pwd',
          expectedOutput: '/home/student',
        },
        {
          orderIndex: 2,
          title: 'Directory Creation and Navigation',
          instruction: 'Create a new project directory named `cse_lab` and navigate inside it using `cd cse_lab`.',
          hint: 'Run "mkdir cse_lab" followed by "cd cse_lab".',
          expectedCommand: 'mkdir cse_lab',
          expectedOutput: 'Directory cse_lab created.',
        },
        {
          orderIndex: 3,
          title: 'File Creation and Content Viewing',
          instruction: 'Create a file named `notes.txt` and display its content using `cat notes.txt`.',
          hint: 'Run "echo \'Hello Linux\' > notes.txt" then "cat notes.txt".',
          expectedCommand: 'cat notes.txt',
          expectedOutput: 'Hello Linux',
        },
      ],
    },
    {
      title: 'Networking & Connectivity Fundamentals',
      slug: 'networking-fundamentals',
      description: 'Diagnose network interfaces, packet round-trip latencies, domain name resolution, and HTTP headers with simulated network tools.',
      category: LabCategory.NETWORKING,
      difficulty: LabDifficulty.BEGINNER,
      estimatedMinutes: 30,
      exercises: [
        {
          orderIndex: 1,
          title: 'Network Interface Inspection',
          instruction: 'View active network interfaces and assigned IP addresses using `ifconfig`.',
          hint: 'Run "ifconfig" or "ip addr".',
          expectedCommand: 'ifconfig',
          expectedOutput: 'eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500',
        },
        {
          orderIndex: 2,
          title: 'Packet Transmission Testing with Ping',
          instruction: 'Test network reachability to the local gateway server `192.168.1.1` with `ping -c 4 192.168.1.1`.',
          hint: 'Type "ping -c 4 192.168.1.1".',
          expectedCommand: 'ping -c 4 192.168.1.1',
          expectedOutput: '4 packets transmitted, 4 received, 0% packet loss',
        },
        {
          orderIndex: 3,
          title: 'DNS Resolution with Nslookup',
          instruction: 'Query DNS records for `virtuallab.edu` using `nslookup virtuallab.edu`.',
          hint: 'Type "nslookup virtuallab.edu".',
          expectedCommand: 'nslookup virtuallab.edu',
          expectedOutput: 'Address: 10.0.15.42',
        },
      ],
    },
    {
      title: 'Programming Foundations (Python & Node.js)',
      slug: 'programming-fundamentals',
      description: 'Run automated scripts, inspect runtime outputs, debug arithmetic functions, and observe return codes in our simulated development environment.',
      category: LabCategory.PROGRAMMING,
      difficulty: LabDifficulty.INTERMEDIATE,
      estimatedMinutes: 35,
      exercises: [
        {
          orderIndex: 1,
          title: 'Python Environment Verification',
          instruction: 'Verify Python version and print an greeting output using `python3 app.py`.',
          hint: 'Run "python3 app.py".',
          expectedCommand: 'python3 app.py',
          expectedOutput: 'Virtual Lab Python Runtime Ready: 200 OK',
        },
        {
          orderIndex: 2,
          title: 'Node.js Execution & JSON Parsing',
          instruction: 'Execute the Node.js script `index.js` to parse student data structures.',
          hint: 'Run "node index.js".',
          expectedCommand: 'node index.js',
          expectedOutput: '{"status":"success","modules":["auth","storage","lab"]}',
        },
      ],
    },
    {
      title: 'Relational Database Fundamentals (SQL / psql)',
      slug: 'database-fundamentals',
      description: 'Execute DDL and DML operations in an interactive simulated psql console: table definitions, insertions, and relational queries.',
      category: LabCategory.DATABASE,
      difficulty: LabDifficulty.INTERMEDIATE,
      estimatedMinutes: 40,
      exercises: [
        {
          orderIndex: 1,
          title: 'Database Catalog Inspection',
          instruction: 'List all existing relations and tables in the simulated database with `\\dt`.',
          hint: 'Type "\\dt" in the database prompt.',
          expectedCommand: '\\dt',
          expectedOutput: 'List of relations: students, courses, enrollments',
        },
        {
          orderIndex: 2,
          title: 'Querying Records with SELECT',
          instruction: 'Retrieve all records from the `students` table where GPA is greater than 3.5: `SELECT * FROM students WHERE gpa > 3.5;`.',
          hint: 'Type "SELECT * FROM students WHERE gpa > 3.5;".',
          expectedCommand: 'SELECT * FROM students WHERE gpa > 3.5;',
          expectedOutput: '3 rows returned. (Alice, Bob, Catherine)',
        },
      ],
    },
  ];

  for (const labData of defaultLabs) {
    const { exercises, ...labMeta } = labData;

    const lab = await prisma.lab.upsert({
      where: { slug: labMeta.slug },
      update: {
        title: labMeta.title,
        description: labMeta.description,
        category: labMeta.category,
        difficulty: labMeta.difficulty,
        estimatedMinutes: labMeta.estimatedMinutes,
      },
      create: labMeta,
    });

    for (const ex of exercises) {
      await prisma.labExercise.upsert({
        where: {
          labId_orderIndex: {
            labId: lab.id,
            orderIndex: ex.orderIndex,
          },
        },
        update: {
          title: ex.title,
          instruction: ex.instruction,
          hint: ex.hint,
          expectedCommand: ex.expectedCommand,
          expectedOutput: ex.expectedOutput,
        },
        create: {
          labId: lab.id,
          orderIndex: ex.orderIndex,
          title: ex.title,
          instruction: ex.instruction,
          hint: ex.hint,
          expectedCommand: ex.expectedCommand,
          expectedOutput: ex.expectedOutput,
        },
      });
    }

    console.log(`✅ Lab & exercises seeded: ${lab.title}`);
  }

  console.log('🎉 Seeding successfully completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
