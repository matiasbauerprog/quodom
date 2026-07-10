import { Request, Response } from 'express';
import prisma from '../prisma';
import { generateQuodomFromPrompt } from '../services/aiService';

export async function generateQuodom(req: Request, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Call service to generate Quodom data from prompt
    const generated = await generateQuodomFromPrompt(prompt, userId);

    // Save Quodom in database
    const newQuodom = await prisma.quodom.create({
      data: {
        title: generated.title,
        status: 'En Proceso',
        userId,
        items: {
          create: generated.items.map(item => ({
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
  } catch (error) {
    console.error('AI generation controller error:', error);
    return res.status(500).json({ error: 'AI generation failed or could not parse result' });
  }
}
