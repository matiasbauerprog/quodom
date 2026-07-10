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
  const filePath = path.resolve(__dirname, '../../../Documentacion 2.0/Categorias/Migracion.xlsx');
  console.log(`Reading Excel file from: ${filePath}`);
  const workbook = XLSX.readFile(filePath);

  // 1. Parse Categories
  const categoriesSheet = workbook.Sheets['TodasCategorias'];
  if (!categoriesSheet) {
    throw new Error('TodasCategorias sheet not found in Excel file');
  }
  const categoriesData: any[] = XLSX.utils.sheet_to_json(categoriesSheet);
  console.log(`Found ${categoriesData.length} category rows in sheet.`);

  const parsedCategoryIds = new Set<number>();
  const categoryUpserts: any[] = [];

  for (const row of categoriesData) {
    if (row.id === undefined || row.id === null || !row.NombreCategoria) {
      continue;
    }
    const id = Math.round(Number(row.id));
    const name = String(row.NombreCategoria).trim();
    const parentId = row.idcategoriapadre !== undefined && row.idcategoriapadre !== null
      ? Math.round(Number(row.idcategoriapadre))
      : 0;
    const image = row.imagen ? String(row.imagen).trim() : null;

    parsedCategoryIds.add(id);
    categoryUpserts.push({ id, name, parentId, image });
  }

  // 2. Parse Products
  const productsSheet = workbook.Sheets['Productos'];
  if (!productsSheet) {
    throw new Error('Productos sheet not found in Excel file');
  }
  const productsData: any[] = XLSX.utils.sheet_to_json(productsSheet);
  console.log(`Found ${productsData.length} product rows in sheet.`);

  const productUpserts: any[] = [];
  for (const row of productsData) {
    if (row.id === undefined || row.id === null || !row.nombreproducto) {
      continue;
    }
    const id = Math.round(Number(row.id));
    const name = String(row.nombreproducto).trim();
    const description = row.descripcion ? String(row.descripcion).trim() : null;
    const unit = getUnit(name);
    const image = row.imagen ? String(row.imagen).trim() : null;
    let categoryId = row.categoria !== undefined && row.categoria !== null
      ? Math.round(Number(row.categoria))
      : NaN;

    if (isNaN(categoryId) && row.categoriaPadre !== undefined && row.categoriaPadre !== null) {
      categoryId = Math.round(Number(row.categoriaPadre));
    }

    if (isNaN(categoryId) || !parsedCategoryIds.has(categoryId)) {
      console.warn(`Warning: Category with ID ${categoryId} not found for product "${name}" (ID ${id}). Skipping product.`);
      continue;
    }

    productUpserts.push({ id, name, description, unit, image, categoryId });
  }

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
