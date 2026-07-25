import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

function getUnit(name: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('litro') || lowerName.includes('lts')) {
    return 'Litros';
  }
  if (lowerName.includes('kilo') || lowerName.includes('kg') || lowerName.includes('kilos')) {
    return 'Kilos';
  }
  if (lowerName.includes('metro') || lowerName.includes('mts') || lowerName.includes('metros')) {
    return 'Metros';
  }
  return 'Unidades';
}

async function main() {
  console.log('Starting database seeding...');
  const jsonPath = path.resolve(__dirname, 'seed-data.json');
  const excelPath = path.resolve(__dirname, '../../../Documentacion 2.0/Categorias/Migracion.xlsx');

  let categoryUpserts: any[] = [];
  let productUpserts: any[] = [];
  let userUpserts: any[] = [];

  const fs = await import('fs');
  if (fs.existsSync(jsonPath)) {
    console.log(`Reading JSON seed file from: ${jsonPath}`);
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const seedData = JSON.parse(rawData);
    categoryUpserts = seedData.categories || [];
    productUpserts = seedData.products || [];
    userUpserts = seedData.users || [];
  } else if (fs.existsSync(excelPath)) {
    console.log(`Reading Excel file from: ${excelPath}`);
    const workbook = XLSX.readFile(excelPath);
    const categoriesSheet = workbook.Sheets['TodasCategorias'];
    if (categoriesSheet) {
      const categoriesData: any[] = XLSX.utils.sheet_to_json(categoriesSheet);
      const parsedCategoryIds = new Set<number>();
      for (const row of categoriesData) {
        if (row.id === undefined || row.id === null || !row.NombreCategoria) continue;
        const id = Math.round(Number(row.id));
        const name = String(row.NombreCategoria).trim();
        const parentId = row.idcategoriapadre !== undefined && row.idcategoriapadre !== null ? Math.round(Number(row.idcategoriapadre)) : 0;
        const image = row.imagen ? String(row.imagen).trim() : null;
        parsedCategoryIds.add(id);
        categoryUpserts.push({ id, name, parentId, image });
      }
      const productsSheet = workbook.Sheets['Productos'];
      if (productsSheet) {
        const productsData: any[] = XLSX.utils.sheet_to_json(productsSheet);
        for (const row of productsData) {
          if (row.id === undefined || row.id === null || !row.nombreproducto) continue;
          const id = Math.round(Number(row.id));
          const name = String(row.nombreproducto).trim();
          const description = row.descripcion ? String(row.descripcion).trim() : null;
          const unit = getUnit(name);
          const image = row.imagen ? String(row.imagen).trim() : null;
          let categoryId = row.categoria !== undefined && row.categoria !== null ? Math.round(Number(row.categoria)) : NaN;
          if (isNaN(categoryId) && row.categoriaPadre !== undefined && row.categoriaPadre !== null) categoryId = Math.round(Number(row.categoriaPadre));
          if (isNaN(categoryId) || !parsedCategoryIds.has(categoryId)) continue;
          productUpserts.push({ id, name, description, unit, image, categoryId });
        }
      }
    }
  } else {
    console.warn('No seed file found (neither seed-data.json nor Migracion.xlsx)');
  }

  if (categoryUpserts.length > 0) {
    console.log(`Executing upsert transaction for ${categoryUpserts.length} categories...`);
    const catPromises = categoryUpserts.map(cat =>
      prisma.category.upsert({
        where: { id: cat.id },
        update: { name: cat.name, parentId: cat.parentId, image: cat.image },
        create: { id: cat.id, name: cat.name, parentId: cat.parentId, image: cat.image },
      })
    );
    await prisma.$transaction(catPromises);
    console.log(`Seeded ${categoryUpserts.length} categories.`);
  }

  if (productUpserts.length > 0) {
    console.log(`Executing upsert transaction for ${productUpserts.length} products...`);
    const prodPromises = productUpserts.map(prod =>
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
    console.log(`Seeded ${productUpserts.length} products.`);
  }

  if (userUpserts.length > 0) {
    console.log(`Executing upsert transaction for ${userUpserts.length} users...`);
    for (const u of userUpserts) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: { email: u.email, passwordHash: u.passwordHash, name: u.name, whatsapp: u.whatsapp },
        create: { id: u.id, email: u.email, passwordHash: u.passwordHash, name: u.name, whatsapp: u.whatsapp, company: u.company, cuit: u.cuit, address: u.address },
      });
    }
    console.log(`Seeded ${userUpserts.length} users.`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Seeding finished successfully.');
  })
  .catch(async (e) => {
    console.error('Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
