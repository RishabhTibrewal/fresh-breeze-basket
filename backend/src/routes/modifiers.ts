import express from 'express';
import { protect, adminOnly } from '../middleware/auth';
import {
  getModifierGroups,
  createModifierGroup,
  updateModifierGroup,
  deleteModifierGroup,
  getModifiersByGroup,
  createModifier,
  updateModifier,
  deleteModifier
} from '../controllers/modifierController';

const router = express.Router();

// All routes require authentication
router.use(protect);

// --- Modifier Groups ---
router.get('/', getModifierGroups);
router.post('/', adminOnly, createModifierGroup);
router.put('/:id', adminOnly, updateModifierGroup);
router.delete('/:id', adminOnly, deleteModifierGroup);

// --- Modifiers ---
router.get('/:groupId/modifiers', getModifiersByGroup);
router.post('/items', adminOnly, createModifier);
router.put('/items/:id', adminOnly, updateModifier);
router.delete('/items/:id', adminOnly, deleteModifier);

export default router;
