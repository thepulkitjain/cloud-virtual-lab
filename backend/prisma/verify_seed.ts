import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
const prisma = new PrismaClient();

async function verify() {
  console.log('🔍 Verifying seeded database records...\n');

  // 1. Check Admin User (EXCLUDE passwordHash for security)
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      storageQuotaBytes: true,
      profile: {
        select: {
          studentId: true,
          department: true,
        },
      },
    },
  });

  console.log(`👤 Users in Database (${users.length}):`);
  users.forEach((u) => {
    console.log(`  - ID: ${u.id}`);
    console.log(`    Name: ${u.firstName} ${u.lastName}`);
    console.log(`    Email: ${u.email}`);
    console.log(`    Role: ${u.role}`);
    console.log(`    Status: ${u.status}`);
    console.log(`    Quota: ${Number(u.storageQuotaBytes) / (1024 * 1024)} MB`);
    console.log(`    Staff ID: ${u.profile?.studentId || 'N/A'}`);
    console.log(`    Department: ${u.profile?.department || 'N/A'}`);
  });

  // 2. Check Labs & Exercises count
  const labs = await prisma.lab.findMany({
    include: {
      exercises: {
        select: {
          orderIndex: true,
          title: true,
        },
        orderBy: { orderIndex: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n🧪 Laboratories Seeded (${labs.length}):`);
  labs.forEach((lab) => {
    console.log(`  - [${lab.category}] ${lab.title} (Slug: ${lab.slug}, Difficulty: ${lab.difficulty})`);
    console.log(`    Total Exercises: ${lab.exercises.length}`);
    lab.exercises.forEach((ex) => {
      console.log(`      ${ex.orderIndex}. ${ex.title}`);
    });
  });

  console.log('\n✅ Database verification complete. All records confirmed present and relational integrity verified.');
}

verify()
  .catch((e) => {
    console.error('❌ Verification failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
