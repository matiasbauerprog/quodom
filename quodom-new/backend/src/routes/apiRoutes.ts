import { Router } from 'express';
import { getCategories, getProducts } from '../controllers/catalogController';
import {
  getQuodoms,
  getQuodomById,
  createQuodom,
  updateQuodom,
  deleteQuodom,
  sendQuodom
} from '../controllers/quodomController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Catalog routes (public)
router.get('/catalog/categories', getCategories);
router.get('/catalog/products', getProducts);

// Quodom routes (protected)
router.get('/quodoms', authMiddleware, getQuodoms);
router.get('/quodoms/:id', authMiddleware, getQuodomById);
router.post('/quodoms', authMiddleware, createQuodom);
router.put('/quodoms/:id', authMiddleware, updateQuodom);
router.delete('/quodoms/:id', authMiddleware, deleteQuodom);
router.post('/quodoms/:id/send', authMiddleware, sendQuodom);

export default router;
