/**
 * Prisma Seed Script
 * Run with: bun run db:seed
 */

import { PrismaClient, AdminRole, ProductType, OrderStatus, PaymentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ========================================
  // Create Admin Users
  // ========================================
  console.log('Creating admin users...');
  
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const superAdmin = await prisma.adminUser.upsert({
    where: { email: 'superadmin@shopnx.com' },
    update: {},
    create: {
      email: 'superadmin@shopnx.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@shopnx.com' },
    update: {},
    create: {
      email: 'admin@shopnx.com',
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
  // Create Products
  // ========================================
  console.log('Creating products...');

  // Physical Product
  const product1 = await prisma.product.upsert({
    where: { sku: 'ELEC-001' },
    update: {},
    create: {
      sku: 'ELEC-001',
      name: 'Wireless Bluetooth Headphones',
      slug: 'wireless-bluetooth-headphones',
      description: 'High-quality wireless headphones with noise cancellation and 30-hour battery life.',
      type: ProductType.PHYSICAL,
      price: 89.99,
      comparePrice: 129.99,
      costPrice: 45.00,
      inventoryQuantity: 150,
      inventoryTracked: true,
      lowStockThreshold: 20,
      weight: 0.35,
      categoryId: categories[0].id,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
      isActive: true,
      isFeatured: true,
      ownerName: 'Tech Supplies Co.',
      ownerWhatsapp: '+6281234567890',
    },
  });

  // Digital Product
  const product2 = await prisma.product.upsert({
    where: { sku: 'DIGI-001' },
    update: {},
    create: {
      sku: 'DIGI-001',
      name: 'Complete Web Development Course',
      slug: 'complete-web-development-course',
      description: 'Learn web development from scratch. Includes HTML, CSS, JavaScript, React, Node.js, and more.',
      type: ProductType.DIGITAL,
      price: 49.99,
      comparePrice: 199.99,
      costPrice: 0,
      inventoryQuantity: 9999,
      inventoryTracked: false,
      downloadUrl: 'https://downloads.shopnx.com/courses/web-dev-2024.zip',
      downloadLimit: 5,
      downloadExpiry: 365,
      categoryId: categories[2].id,
      image: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=500',
      isActive: true,
      isFeatured: true,
      isBestSeller: true,
      ownerName: 'Code Academy',
      ownerWhatsapp: '+6281234567891',
    },
  });

  // Another Physical Product
  const product3 = await prisma.product.upsert({
    where: { sku: 'CLTH-001' },
    update: {},
    create: {
      sku: 'CLTH-001',
      name: 'Premium Cotton T-Shirt',
      slug: 'premium-cotton-t-shirt',
      description: '100% organic cotton t-shirt. Comfortable and stylish for everyday wear.',
      type: ProductType.PHYSICAL,
      price: 29.99,
      comparePrice: 39.99,
      costPrice: 12.00,
      inventoryQuantity: 500,
      inventoryTracked: true,
      lowStockThreshold: 50,
      weight: 0.2,
      categoryId: categories[1].id,
      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500',
      isActive: true,
      ownerName: 'Fashion Hub',
      ownerWhatsapp: '+6281234567892',
    },
  });

  console.log(`✅ Created 3 sample products`);

  // ========================================
  // Create Product Variants
  // ========================================
  console.log('Creating product variants...');

  // Create variants one by one to avoid skipDuplicates issue
  const variants = [
    {
      productId: product3.id,
      sku: 'CLTH-001-S-WHT',
      name: 'Small - White',
      option1Name: 'Size',
      option1Value: 'S',
      option2Name: 'Color',
      option2Value: 'White',
      price: 29.99,
      inventoryQuantity: 100,
      isActive: true,
    },
    {
      productId: product3.id,
      sku: 'CLTH-001-M-WHT',
      name: 'Medium - White',
      option1Name: 'Size',
      option1Value: 'M',
      option2Name: 'Color',
      option2Value: 'White',
      price: 29.99,
      inventoryQuantity: 150,
      isActive: true,
    },
    {
      productId: product3.id,
      sku: 'CLTH-001-L-WHT',
      name: 'Large - White',
      option1Name: 'Size',
      option1Value: 'L',
      option2Name: 'Color',
      option2Value: 'White',
      price: 29.99,
      inventoryQuantity: 120,
      isActive: true,
    },
    {
      productId: product3.id,
      sku: 'CLTH-001-M-BLK',
      name: 'Medium - Black',
      option1Name: 'Size',
      option1Value: 'M',
      option2Name: 'Color',
      option2Value: 'Black',
      price: 29.99,
      inventoryQuantity: 130,
      isActive: true,
    },
  ];

  for (const variant of variants) {
    await prisma.productVariant.upsert({
      where: { sku: variant.sku },
      update: {},
      create: variant,
    });
  }

  console.log(`✅ Created product variants`);

  // ========================================
  // Create Product Images
  // ========================================
  console.log('Creating product images...');

  const images = [
    {
      productId: product1.id,
      url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
      alt: 'Wireless Bluetooth Headphones',
      order: 1,
      isPrimary: true,
    },
    {
      productId: product1.id,
      url: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=500',
      alt: 'Headphones side view',
      order: 2,
      isPrimary: false,
    },
    {
      productId: product2.id,
      url: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=500',
      alt: 'Web Development Course',
      order: 1,
      isPrimary: true,
    },
    {
      productId: product3.id,
      url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500',
      alt: 'Premium Cotton T-Shirt',
      order: 1,
      isPrimary: true,
    },
  ];

  for (const image of images) {
    await prisma.productImage.create({
      data: image,
    });
  }

  console.log(`✅ Created product images`);

  // ========================================
  // Create Settings
  // ========================================
  console.log('Creating settings...');

  const settings = [
    {
      key: 'store_name',
      value: JSON.stringify('ShopNx E-Commerce'),
      category: 'general',
    },
    {
      key: 'store_email',
      value: JSON.stringify('support@shopnx.com'),
      category: 'general',
    },
    {
      key: 'store_phone',
      value: JSON.stringify('+6281234567890'),
      category: 'general',
    },
    {
      key: 'currency',
      value: JSON.stringify({ code: 'IDR', symbol: 'Rp', rate: 15500 }),
      category: 'general',
    },
    {
      key: 'whatsapp_enabled',
      value: JSON.stringify(true),
      category: 'checkout',
    },
    {
      key: 'whatsapp_number',
      value: JSON.stringify('+6281234567890'),
      category: 'checkout',
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

  // ========================================
  // Create Sample Customer
  // ========================================
  console.log('Creating sample customer...');

  const customer = await prisma.customer.upsert({
    where: { phone: '+6289876543210' },
    update: {},
    create: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+6289876543210',
      whatsappNumber: '+6289876543210',
      whatsappOptIn: true,
    },
  });

  console.log(`✅ Created sample customer: ${customer.email}`);

  // ========================================
  // Create Sample Order
  // ========================================
  console.log('Creating sample order...');

  const order = await prisma.order.create({
    data: {
      orderNumber: `ORD-${Date.now()}`,
      customerId: customer.id,
      customerName: customer.name || 'John Doe',
      customerEmail: customer.email,
      customerPhone: customer.phone || '+6289876543210',
      customerWhatsapp: customer.whatsappNumber,
      shippingName: customer.name || 'John Doe',
      shippingPhone: customer.phone || '+6289876543210',
      shippingAddress: 'Jl. Sudirman No. 123',
      shippingCity: 'Jakarta',
      shippingProvince: 'DKI Jakarta',
      shippingPostalCode: '12190',
      subtotal: 89.99,
      discount: 0,
      shippingCost: 10,
      tax: 0,
      total: 99.99,
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      customerNotes: 'Please deliver in the morning',
      items: {
        create: {
          productId: product1.id,
          productSku: product1.sku,
          productName: product1.name,
          productImage: product1.image,
          unitPrice: 89.99,
          totalPrice: 89.99,
          quantity: 1,
          productType: ProductType.PHYSICAL,
        },
      },
    },
  });

  console.log(`✅ Created sample order: ${order.orderNumber}`);

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
