import { Request, Response } from 'express';
import prisma from '../prisma';

export async function getCategories(req: Request, res: Response) {
  try {
    const allCategories = await prisma.category.findMany();
    const roots = allCategories.filter(c => c.parentId === 0);
    const result = roots.map(root => {
      const subcategories = allCategories.filter(c => c.parentId === root.id);
      return {
        id: root.id,
        name: root.name,
        parentId: root.parentId,
        image: root.image,
        subcategories: subcategories.map(sub => ({
          id: sub.id,
          name: sub.name,
          parentId: sub.parentId,
          image: sub.image,
          subcategories: []
        }))
      };
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error('Get categories error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getProducts(req: Request, res: Response) {
  try {
    const { categoryId, search } = req.query;

    const where: any = {};

    if (categoryId) {
      const catId = Number(categoryId);
      if (!isNaN(catId)) {
        const category = await prisma.category.findUnique({
          where: { id: catId },
        });

        if (category) {
          if (category.parentId === 0) {
            // Root category: fetch all subcategories plus the root itself
            const subcategories = await prisma.category.findMany({
              where: { parentId: catId },
            });
            const categoryIds = [catId, ...subcategories.map(sub => sub.id)];
            where.categoryId = { in: categoryIds };
          } else {
            where.categoryId = catId;
          }
        } else {
          where.categoryId = catId;
        }
      }
    }

    if (search) {
      const searchStr = String(search).trim();
      if (searchStr) {
        where.OR = [
          { name: { contains: searchStr } },
          { description: { contains: searchStr } },
        ];
      }
    }

    const products = await prisma.product.findMany({
      where,
    });

    return res.status(200).json(products);
  } catch (error) {
    console.error('Get products error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
