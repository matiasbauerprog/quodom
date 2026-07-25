const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding from JSON...');
  const jsonPath = path.resolve(__dirname, 'seed-data.json');
  if (!fs.existsSync(jsonPath)) {
    console.log('No seed-data.json found, skipping seed.');
    return;
  }

  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const seedData = JSON.parse(rawData);
  const { categories = [], products = [], users = [] } = seedData;

  if (categories.length > 0) {
    console.log(`Seeding ${categories.length} categories...`);
    const catPromises = categories.map(cat =>
      prisma.category.upsert({
        where: { id: cat.id },
        update: { name: cat.name, parentId: cat.parentId, image: cat.image },
        create: { id: cat.id, name: cat.name, parentId: cat.parentId, image: cat.image },
      })
    );
    await prisma.$transaction(catPromises);
    console.log(`Successfully seeded ${categories.length} categories.`);
  }

  if (products.length > 0) {
    console.log(`Seeding ${products.length} products...`);
    const prodPromises = products.map(prod =>
      prisma.product.upsert({
        where: { id: prod.id },
        update: {
          name: prod.name,
          description: prod.description,
          unit: prod.unit,
          image: prod.image,
          categoryId: prod.categoryId,
        },
        create: {
          id: prod.id,
          name: prod.name,
          description: prod.description,
          unit: prod.unit,
          image: prod.image,
          categoryId: prod.categoryId,
        },
      })
    );
    await prisma.$transaction(prodPromises);
    console.log(`Successfully seeded ${products.length} products.`);
  }

  if (users.length > 0) {
    console.log(`Seeding ${users.length} users...`);
    for (const u of users) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: { email: u.email, passwordHash: u.passwordHash, name: u.name, whatsapp: u.whatsapp },
        create: { id: u.id, email: u.email, passwordHash: u.passwordHash, name: u.name, whatsapp: u.whatsapp, company: u.company, cuit: u.cuit, address: u.address },
      });
    }
    console.log(`Successfully seeded ${users.length} users.`);
  }

  console.log('Seeding finished successfully.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
