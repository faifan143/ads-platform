import { Gender, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { blue, green, red, yellow } from 'chalk';
import { Spinner } from 'cli-spinner';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function cleanDatabase() {
  console.log(yellow('🧹 Cleaning existing data...'));
  const spinner = new Spinner('Deleting data...');
  spinner.start();

  try {
    await prisma.$transaction([
      prisma.userContent.deleteMany(),
      prisma.userContentLike.deleteMany(),
      prisma.userContentWhatsApp.deleteMany(),
      prisma.content.deleteMany(),
      prisma.productPurchase.deleteMany(),
      prisma.interest.deleteMany(),
      prisma.product.deleteMany(),
      prisma.user.deleteMany(),
      prisma.admin.deleteMany(),
    ]);
    spinner.stop();
    console.log(green('✅ Database cleaned successfully'));
  } catch (error) {
    spinner.stop();
    console.error(red('❌ Error cleaning database:'), error);
    throw error;
  }
}

async function seedAdmins() {
  console.log(blue('\n🔑 Seeding admins...'));
  await prisma.admin.create({
    data: {
      name: 'System Admin',
      email: process.env.ADMIN_EMAIL || 'admin@ramadan-ads.com',
      password: await hashPassword(process.env.ADMIN_PASSWORD || 'Admin123!'),
    },
  });
  console.log(green('✅ Admin created'));
}

async function seedInterests() {
  console.log(blue('\n🎯 Seeding interests...'));
  await prisma.interest.createMany({
    data: [
      { name: 'Ramadan Iftar', targetedGender: null, minAge: 18, maxAge: 65 },
      {
        name: 'Sweets & Desserts',
        targetedGender: null,
        minAge: 15,
        maxAge: 70,
      },
      {
        name: 'Islamic Clothing',
        targetedGender: Gender.FEMALE,
        minAge: 18,
        maxAge: 60,
      },
      { name: 'Dates & Fruits', targetedGender: null, minAge: 20, maxAge: 65 },
      {
        name: 'Restaurant Deals',
        targetedGender: null,
        minAge: 20,
        maxAge: 50,
      },
    ],
  });
  console.log(green('✅ Interests created'));
}

async function seedProducts() {
  console.log(blue('\n🛍️ Seeding products...'));
  await prisma.product.createMany({
    data: [
      {
        name: 'Premium Ad Boost',
        photo: '/products/boost.jpg',
        details: 'Boost your ad visibility for 24 hours',
        pointsPrice: 100,
      },
      {
        name: 'Featured Listing',
        photo: '/products/featured.jpg',
        details: 'Get your ad featured at the top of the feed',
        pointsPrice: 200,
      },
      {
        name: 'Extended Duration',
        photo: '/products/duration.jpg',
        details: 'Extend your ad duration by 48 hours',
        pointsPrice: 150,
      },
    ],
  });
  console.log(green('✅ Products created'));
}

// async function seedUsers() {
//   console.log(blue('\n👥 Seeding users...'));
//   const interests = await prisma.interest.findMany();
//   const products = await prisma.product.findMany();

//   const userData = [
//     {
//       name: 'Ahmad Al-Hassan',
//       phone: '+963934567890',
//       dateOfBirth: new Date('1990-05-15'),
//       gender: Gender.MALE,
//       providence: Providence.ALEPPO,
//       points: 150,
//     },
//     {
//       name: 'Fatima Khaled',
//       phone: '+963945678901',
//       dateOfBirth: new Date('1995-03-20'),
//       gender: Gender.FEMALE,
//       providence: Providence.DAMASCUS,
//       points: 250,
//     },
//     {
//       name: 'Mohammed Said',
//       phone: '+963956789012',
//       dateOfBirth: new Date('1988-08-10'),
//       gender: Gender.MALE,
//       providence: Providence.HOMS,
//       points: 175,
//     },
//   ];

//   for (const user of userData) {
//     const createdUser = await prisma.user.create({
//       data: { ...user, password: await hashPassword('User123!') },
//     });
//     const age =
//       new Date().getFullYear() - createdUser.dateOfBirth.getFullYear();
//     const compatibleInterests = interests.filter(
//       (i) =>
//         (!i.targetedGender || i.targetedGender === createdUser.gender) &&
//         age >= i.minAge &&
//         age <= i.maxAge,
//     );
//     const selectedInterests = compatibleInterests
//       .sort(() => Math.random() - 0.5)
//       .slice(0, 5);

//     await prisma.user.update({
//       where: { id: createdUser.id },
//       data: {
//         interests: { connect: selectedInterests.map((i) => ({ id: i.id })) },
//         ProductPurchase: {
//           create: products
//             .filter((product) => product.pointsPrice <= createdUser.points)
//             .sort(() => Math.random() - 0.5)
//             .slice(0, Math.floor(Math.random() * 3))
//             .map((product) => ({
//               productId: product.id,
//               pointsSpent: product.pointsPrice,
//             })),
//         },
//       },
//     });
//   }
//   console.log(green('✅ Users created with interests and purchases'));
// }

// async function seedContent() {
//   console.log(blue('\n📝 Seeding content...'));
//   const users = await prisma.user.findMany();
//   const interests = await prisma.interest.findMany();

//   for (const user of users) {
//     const content = await prisma.content.create({
//       data: {
//         title: `${user.name}'s Ramadan Special`,
//         description: `Special Ramadan offers and deals in ${user.providence.toLowerCase()}`,
//         ownerName: user.name,
//         ownerNumber: user.phone,
//         type: Math.random() > 0.5 ? AdType.STORY : AdType.REEL,
//         intervalHours: Math.floor(Math.random() * 3) + 1,
//         endValidationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//         mediaUrls: [
//           'https://source.unsplash.com/800x600/?ramadan',
//           'https://source.unsplash.com/800x600/?mosque',
//         ],
//         interests: {
//           connect: interests
//             .sort(() => Math.random() - 0.5)
//             .slice(0, 2)
//             .map((i) => ({ id: i.id })),
//         },
//       },
//     });

//     const viewers = users.filter((u) => u.id !== user.id);
//     const randomViewers = viewers
//       .sort(() => Math.random() - 0.5)
//       .slice(0, Math.floor(Math.random() * viewers.length * 0.7));
//     for (const viewer of randomViewers) {
//       await prisma.userContent.create({
//         data: { userId: viewer.id, contentId: content.id },
//       });
//       if (Math.random() > 0.6)
//         await prisma.userContentLike.create({
//           data: { userId: viewer.id, contentId: content.id },
//         });
//       if (Math.random() > 0.7)
//         await prisma.userContentWhatsApp.create({
//           data: { userId: viewer.id, contentId: content.id },
//         });
//     }
//   }
//   console.log(green('✅ Content with views, likes, and shares created'));
// }

async function main() {
  console.log(blue('🌱 Starting database seed...'));
  await cleanDatabase();
  // await seedAdmins();
  // await seedInterests();
  // await seedProducts();
  // await seedUsers();
  // await seedContent();
  console.log(green('\n✨ Database seeded successfully!'));
  await prisma.$disconnect();
}

process.on('unhandledRejection', (error) => {
  console.error(red('❌ Unhandled rejection:'), error);
  process.exit(1);
});

main().catch((error) => {
  console.error(red('❌ Seed failed:'), error);
  process.exit(1);
});
