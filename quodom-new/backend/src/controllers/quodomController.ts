import { Request, Response } from 'express';
import prisma from '../prisma';

export async function getQuodoms(req: Request, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const quodoms = await prisma.quodom.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(quodoms);
  } catch (error) {
    console.error('Get Quodoms error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getQuodomById(req: Request, res: Response) {
  try {
    const userId = req.userId;
    const quodomId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const quodom = await prisma.quodom.findUnique({
      where: { id: quodomId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!quodom) {
      return res.status(404).json({ error: 'Quodom not found' });
    }

    if (quodom.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.status(200).json(quodom);
  } catch (error) {
    console.error('Get Quodom by ID error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createQuodom(req: Request, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title, items } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const itemsList = Array.isArray(items) ? items : [];

    // Create the Quodom and associated items inside a transaction
    const newQuodom = await prisma.quodom.create({
      data: {
        title,
        status: 'En Proceso',
        userId,
        items: {
          create: itemsList.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return res.status(201).json(newQuodom);
  } catch (error: any) {
    console.error('Create Quodom error:', error);
    if (error && error.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid productId provided' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateQuodom(req: Request, res: Response) {
  try {
    const userId = req.userId;
    const quodomId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title, items } = req.body;

    const existing = await prisma.quodom.findUnique({
      where: { id: quodomId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Quodom not found' });
    }

    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update title if provided
      const updateData: any = {};
      if (title !== undefined) {
        updateData.title = title;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.quodom.update({
          where: { id: quodomId },
          data: updateData,
        });
      }

      // 2. Sync items if provided
      if (items !== undefined && Array.isArray(items)) {
        // Delete existing items
        await tx.quodomItem.deleteMany({
          where: { quodomId },
        });

        // Create new items
        for (const item of items) {
          await tx.quodomItem.create({
            data: {
              quodomId,
              productId: item.productId,
              quantity: item.quantity,
            },
          });
        }
      }

      // 3. Retrieve and return the updated Quodom with items and products
      return tx.quodom.findUnique({
        where: { id: quodomId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    });

    return res.status(200).json(updated);
  } catch (error: any) {
    console.error('Update Quodom error:', error);
    if (error && error.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid productId provided' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteQuodom(req: Request, res: Response) {
  try {
    const userId = req.userId;
    const quodomId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await prisma.quodom.findUnique({
      where: { id: quodomId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Quodom not found' });
    }

    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Delete items first to be 100% sure, then delete the Quodom
    await prisma.$transaction(async (tx) => {
      await tx.quodomItem.deleteMany({
        where: { quodomId },
      });
      await tx.quodom.delete({
        where: { id: quodomId },
      });
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete Quodom error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function sendQuodom(req: Request, res: Response) {
  try {
    const userId = req.userId;
    const quodomId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await prisma.quodom.findUnique({
      where: { id: quodomId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Quodom not found' });
    }

    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.quodom.update({
      where: { id: quodomId },
      data: { status: 'Enviado' },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Send Quodom error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
