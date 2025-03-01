// prisma/seed.ts
import { PrismaClient, Gender } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Clear existing data
  await clearExistingData();

  // Seed interests
  await seedInterests();

  // Seed products
  await seedProducts();

  console.log('Seeding completed successfully!');
}

async function clearExistingData() {
  console.log('Clearing existing data...');
  // Delete in order to avoid foreign key constraints
  await prisma.productPurchase.deleteMany({});
  await prisma.userContentWhatsApp.deleteMany({});
  await prisma.userContentLike.deleteMany({});
  await prisma.userContent.deleteMany({});
  await prisma.contentGem.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.$executeRaw`DELETE FROM "_InterestContent"`;
  await prisma.$executeRaw`DELETE FROM "_UserInterest"`;
  await prisma.interest.deleteMany({});
  console.log('Existing data cleared!');
}

async function seedInterests() {
  console.log('Seeding interests...');
  
  const interests = [
    // Original interests
    {
      name: 'Fashion',
      targetedGender: Gender.FEMALE,
      minAge: 16,
      maxAge: 65,
    },
    {
      name: 'Electronics',
      targetedGender: null, // For all genders
      minAge: 18,
      maxAge: 70,
    },
    {
      name: 'Sports',
      targetedGender: Gender.MALE,
      minAge: 13,
      maxAge: 60,
    },
    {
      name: 'Cooking',
      targetedGender: null,
      minAge: 18,
      maxAge: 80,
    },
    {
      name: 'Health & Fitness',
      targetedGender: null,
      minAge: 16,
      maxAge: 75,
    },
    {
      name: 'Gaming',
      targetedGender: null,
      minAge: 13,
      maxAge: 45,
    },
    {
      name: 'Beauty',
      targetedGender: Gender.FEMALE,
      minAge: 15,
      maxAge: 65,
    },
    {
      name: 'Home Decor',
      targetedGender: null,
      minAge: 25,
      maxAge: 85,
    },
    {
      name: 'Automotive',
      targetedGender: Gender.MALE,
      minAge: 18,
      maxAge: 70,
    },
    {
      name: 'Education',
      targetedGender: null,
      minAge: 13,
      maxAge: 90,
    },
    
    // New interests
    {
      name: 'Travel',
      targetedGender: null,
      minAge: 18,
      maxAge: 85,
    },
    {
      name: 'Photography',
      targetedGender: null,
      minAge: 15,
      maxAge: 75,
    },
    {
      name: 'Music',
      targetedGender: null,
      minAge: 13,
      maxAge: 90,
    },
    {
      name: 'Books & Literature',
      targetedGender: null,
      minAge: 14,
      maxAge: 95,
    },
    {
      name: 'DIY & Crafts',
      targetedGender: null,
      minAge: 16,
      maxAge: 80,
    },
    {
      name: 'Gardening',
      targetedGender: null,
      minAge: 25,
      maxAge: 90,
    },
    {
      name: 'Parenting',
      targetedGender: null,
      minAge: 20,
      maxAge: 65,
    },
    {
      name: 'Pets & Animals',
      targetedGender: null, 
      minAge: 13,
      maxAge: 90,
    },
    {
      name: 'Technology',
      targetedGender: null,
      minAge: 15,
      maxAge: 75,
    },
    {
      name: 'Finance',
      targetedGender: null,
      minAge: 20,
      maxAge: 85,
    },
    {
      name: 'Art & Design',
      targetedGender: null,
      minAge: 15,
      maxAge: 80,
    },
    {
      name: 'Outdoor Activities',
      targetedGender: null,
      minAge: 13,
      maxAge: 70,
    },
    {
      name: 'Sustainability',
      targetedGender: null,
      minAge: 16,
      maxAge: 90,
    },
    {
      name: 'Wellness & Mindfulness',
      targetedGender: null,
      minAge: 18,
      maxAge: 95,
    },
    {
      name: 'Collectibles',
      targetedGender: null,
      minAge: 14,
      maxAge: 85,
    },
    {
      name: 'Food & Dining',
      targetedGender: null,
      minAge: 18,
      maxAge: 80,
    },
    {
      name: 'Movies & TV',
      targetedGender: null,
      minAge: 13,
      maxAge: 75,
    },
    {
      name: 'Fitness Equipment',
      targetedGender: null,
      minAge: 18,
      maxAge: 70,
    },
    {
      name: 'Luxury Goods',
      targetedGender: null,
      minAge: 25,
      maxAge: 80,
    },
    {
      name: 'Streetwear',
      targetedGender: null,
      minAge: 14,
      maxAge: 35,
    }
  ];

  for (const interest of interests) {
    await prisma.interest.create({
      data: interest,
    });
  }

  console.log(`✅ ${interests.length} interests seeded!`);
}

async function seedProducts() {
  console.log('Seeding products...');
  
  const products = [
    // Original products
    {
      name: 'Premium Membership - 1 Month',
      photo: 'http://anycode-sy.com/media/reel-win/products/premium-membership.webp',
      details: 'Get access to exclusive content and features for one month',
      pointsPrice: 500,
      purchasable: true,
    },
    {
      name: 'Gift Card - $10',
      photo: 'http://anycode-sy.com/media/reel-win/products/gift-card.webp',
      details: '$10 gift card that can be used at partner stores',
      pointsPrice: 1000,
      purchasable: true,
    },
    {
      name: 'Phone Case',
      photo: 'http://anycode-sy.com/media/reel-win/products/phone-case.webp',
      details: 'Stylish and protective case for your smartphone',
      pointsPrice: 300,
      purchasable: true,
    },
    {
      name: 'T-Shirt',
      photo: 'http://anycode-sy.com/media/reel-win/products/tshirt.webp',
      details: 'Comfortable cotton t-shirt with app logo',
      pointsPrice: 450,
      purchasable: true,
    },
    {
      name: 'Coffee Mug',
      photo: 'http://anycode-sy.com/media/reel-win/products/coffee-mug.webp',
      details: 'Ceramic coffee mug featuring app design',
      pointsPrice: 200,
      purchasable: true,
    },
    {
      name: 'Wireless Earbuds',
      photo: 'http://anycode-sy.com/media/reel-win/products/earbuds.webp',
      details: 'High-quality wireless earbuds for music lovers',
      pointsPrice: 2000,
      purchasable: true,
    },
    {
      name: 'Water Bottle',
      photo: 'http://anycode-sy.com/media/reel-win/products/water-bottle.webp',
      details: 'Eco-friendly reusable water bottle',
      pointsPrice: 350,
      purchasable: true,
    },
    {
      name: 'Notebook & Pen Set',
      photo: 'http://anycode-sy.com/media/reel-win/products/notebook.webp',
      details: 'Premium notebook with matching pen',
      pointsPrice: 250,
      purchasable: true,
    },
    {
      name: 'Tote Bag',
      photo: 'http://anycode-sy.com/media/reel-win/products/tote-bag.webp',
      details: 'Canvas tote bag with custom design',
      pointsPrice: 180,
      purchasable: true,
    },
    {
      name: 'Premium Membership - 1 Year',
      photo: 'http://anycode-sy.com/media/reel-win/products/premium-year.webp',
      details: 'Get access to exclusive content and features for one full year',
      pointsPrice: 5000,
      purchasable: true,
    },
    
    // New products
    {
      name: 'Bluetooth Speaker',
      photo: 'http://anycode-sy.com/media/reel-win/products/speaker.webp',
      details: 'Portable wireless speaker with premium sound quality',
      pointsPrice: 1800,
      purchasable: true,
    },
    {
      name: 'Fitness Tracker',
      photo: 'http://anycode-sy.com/media/reel-win/products/fitness-tracker.webp',
      details: 'Smart fitness band to track your activity and health metrics',
      pointsPrice: 1500,
      purchasable: true,
    },
    {
      name: 'Gift Card - $25',
      photo: 'http://anycode-sy.com/media/reel-win/products/gift-card-25.webp',
      details: '$25 gift card for use at our partner retailers',
      pointsPrice: 2500,
      purchasable: true,
    },
    {
      name: 'Wireless Charger',
      photo: 'http://anycode-sy.com/media/reel-win/products/wireless-charger.webp',
      details: 'Fast charging wireless pad for compatible smartphones',
      pointsPrice: 800,
      purchasable: true,
    },
    {
      name: 'Backpack',
      photo: 'http://anycode-sy.com/media/reel-win/products/backpack.webp',
      details: 'Durable backpack with multiple compartments and laptop sleeve',
      pointsPrice: 1200,
      purchasable: true,
    },
    {
      name: 'Smart Bulb Kit',
      photo: 'http://anycode-sy.com/media/reel-win/products/smart-bulb.webp',
      details: 'Color-changing smart LED bulbs that work with voice assistants',
      pointsPrice: 950,
      purchasable: true,
    },
    {
      name: 'Premium Subscription - 3 Months',
      photo: 'http://anycode-sy.com/media/reel-win/products/premium-3month.webp',
      details: 'Three months of premium features and exclusive content',
      pointsPrice: 1300,
      purchasable: true,
    },
    {
      name: 'Wireless Mouse',
      photo: 'http://anycode-sy.com/media/reel-win/products/wireless-mouse.webp',
      details: 'Ergonomic wireless mouse with precision tracking',
      pointsPrice: 700,
      purchasable: true,
    },
    {
      name: 'Laptop Sleeve',
      photo: 'http://anycode-sy.com/media/reel-win/products/laptop-sleeve.webp',
      details: 'Protective padded sleeve for laptops up to 15 inches',
      pointsPrice: 400,
      purchasable: true,
    },
    {
      name: 'Portable Power Bank',
      photo: 'http://anycode-sy.com/media/reel-win/products/power-bank.webp',
      details: '10,000mAh fast-charging power bank with dual USB ports',
      pointsPrice: 850,
      purchasable: true,
    },
    {
      name: 'Smart Plant Sensor',
      photo: 'http://anycode-sy.com/media/reel-win/products/plant-sensor.webp',
      details: 'Monitor soil moisture, light, and temperature for your plants',
      pointsPrice: 600,
      purchasable: true,
    },
    {
      name: 'Gaming Mouse Pad',
      photo: 'http://anycode-sy.com/media/reel-win/products/mouse-pad.webp',
      details: 'Large RGB gaming mouse pad with custom lighting effects',
      pointsPrice: 350,
      purchasable: true,
    },
    {
      name: 'Kitchen Digital Scale',
      photo: 'http://anycode-sy.com/media/reel-win/products/kitchen-scale.webp',
      details: 'Precise digital kitchen scale for cooking and baking',
      pointsPrice: 450,
      purchasable: true,
    },
    {
      name: 'Streaming Service - 6 Months',
      photo: 'http://anycode-sy.com/media/reel-win/products/streaming.webp',
      details: '6-month subscription to a premium streaming service',
      pointsPrice: 3000,
      purchasable: true,
    },
    {
      name: 'Yoga Mat',
      photo: 'http://anycode-sy.com/media/reel-win/products/yoga-mat.webp',
      details: 'Non-slip eco-friendly yoga mat with carrying strap',
      pointsPrice: 550,
      purchasable: true,
    },
    {
      name: 'Digital Drawing Tablet',
      photo: 'http://anycode-sy.com/media/reel-win/products/drawing-tablet.webp',
      details: 'Professional drawing tablet for digital artists',
      pointsPrice: 2800,
      purchasable: true,
    },
    {
      name: 'Insulated Travel Tumbler',
      photo: 'http://anycode-sy.com/media/reel-win/products/tumbler.webp',
      details: 'Vacuum insulated stainless steel travel tumbler',
      pointsPrice: 420,
      purchasable: true,
    },
    {
      name: 'Smartphone Gimbal',
      photo: 'http://anycode-sy.com/media/reel-win/products/gimbal.webp',
      details: '3-axis stabilizer for smartphone photography and videography',
      pointsPrice: 1600,
      purchasable: true,
    },
    {
      name: 'Smart Key Finder',
      photo: 'http://anycode-sy.com/media/reel-win/products/key-finder.webp',
      details: 'Bluetooth tracker to find your keys, wallet, or other items',
      pointsPrice: 280,
      purchasable: true,
    },
    {
      name: 'Gift Card - $50',
      photo: 'http://anycode-sy.com/media/reel-win/products/gift-card-50.webp',
      details: '$50 gift card redeemable at select retailers',
      pointsPrice: 5000,
      purchasable: true,
    }
  ];

  for (const product of products) {
    await prisma.product.create({
      data: product,
    });
  }

  console.log(`✅ ${products.length} products seeded!`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });