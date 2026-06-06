/**
 * Prisma Seed Script
 * Run with: bun run db:seed
 */

import { AdminRole, PrismaClient } from '@prisma/client';
import { hashSync, genSaltSync } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ========================================
  // Create Admin Users
  // ========================================
  console.log('Creating admin users...');

  // Validate salt rounds from environment variable
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS);
  if (isNaN(saltRounds) || saltRounds <= 0) {
    console.error(
      `Invalid BCRYPT_SALT_ROUNDS value: ${process.env.BCRYPT_SALT_ROUNDS}`,
    );
    throw new Error(
      'Invalid BCRYPT_SALT_ROUNDS value. It must be a positive integer.',
    );
  }

  // Use environment variable for admin password
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error('ADMIN_PASSWORD environment variable is not set');
    throw new Error(
      'ADMIN_PASSWORD environment variable is required for seeding admin users',
    );
  }

  const hashedPassword = hashSync(password, genSaltSync(saltRounds));

  const superAdmin = await prisma.adminUser.upsert({
    where: { email: 'poukamtech@gmail.com' },
    update: {},
    create: {
      email: 'poukamtech@gmail.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  const admin = await prisma.adminUser.upsert({
    where: { email: 'ngamaleu2011@gmail.com' },
    update: {},
    create: {
      email: 'ngamaleu2011@gmail.com',
      password: hashedPassword,
      name: 'Store Admin',
      role: AdminRole.ADMIN,
      isActive: true,
    },
  });

  console.log(`✅ Created admin users: ${superAdmin.email}, ${admin.email}`);

  // ========================================
  // Create Categories
  // ========================================
  console.log('Creating categories...');

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'electronics' },
      update: {},
      create: {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Electronic devices and accessories',
        order: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'clothing' },
      update: {},
      create: {
        name: 'Clothing',
        slug: 'clothing',
        description: 'Fashion and apparel',
        order: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'digital-products' },
      update: {},
      create: {
        name: 'Digital Products',
        slug: 'digital-products',
        description: 'E-books, software, and digital downloads',
        order: 3,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'home-living' },
      update: {},
      create: {
        name: 'Home & Living',
        slug: 'home-living',
        description: 'Home decor and lifestyle products',
        order: 4,
      },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // ========================================
  // Create Settings
  // ========================================
  console.log('Creating settings...');

  const settings = [
    // general settings
    {
      key: 'storeName',
      value: JSON.stringify('ShopPk E-Commerce'),
      category: 'general',
    },
    {
      key: 'storeEmail',
      value: JSON.stringify('poukamtech@gmail.com'),
      category: 'general',
    },
    {
      key: 'storePhone',
      value: JSON.stringify('+237696841451'),
      category: 'general',
    },

    // store settings
    { key: 'currency', value: JSON.stringify('XAF'), category: 'store' },
    {
      key: 'currencySymbol',
      value: JSON.stringify('FCFA'),
      category: 'store',
    },
    { key: 'taxRate', value: JSON.stringify(0), category: 'store' },
    { key: 'taxEnabled', value: JSON.stringify(false), category: 'store' },
    { key: 'shippingCost', value: JSON.stringify(0), category: 'store' },
    {
      key: 'freeShippingThreshold',
      value: JSON.stringify(0),
      category: 'store',
    },
    {
      key: 'inventoryThreshold',
      value: JSON.stringify(10),
      category: 'store',
    },

    // checkout settings
    {
      key: 'whatsappEnabled',
      value: JSON.stringify(true),
      category: 'checkout',
    },
    {
      key: 'whatsappNumber',
      value: JSON.stringify('+237696841451'),
      category: 'checkout',
    },

    // Notifications settings
    {
      key: 'emailNotifications',
      value: JSON.stringify(true),
      category: 'notifications',
    },
    {
      key: 'orderConfirmation',
      value: JSON.stringify(true),
      category: 'notifications',
    },
    {
      key: 'orderShipped',
      value: JSON.stringify(true),
      category: 'notifications',
    },
    {
      key: 'orderDelivered',
      value: JSON.stringify(true),
      category: 'notifications',
    },
    {
      key: 'lowStockAlert',
      value: JSON.stringify(true),
      category: 'notifications',
    },
    {
      key: 'newCustomer',
      value: JSON.stringify(true),
      category: 'notifications',
    },
    {
      key: 'marketingEmails',
      value: JSON.stringify(false),
      category: 'notifications',
    },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log(`✅ Created settings`);

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
