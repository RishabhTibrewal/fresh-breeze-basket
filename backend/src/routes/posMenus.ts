import express from 'express';
import { protect } from '../middleware/auth';
import {
  listMenus,
  createMenu,
  getActiveMenu,
  getMenu,
  updateMenu,
  deleteMenu,
  upsertMenuItems,
  assignOutlet,
  unassignOutlet,
  updateMenuDisplayFilters,
} from '../controllers/posMenuController';

const router = express.Router();

router.use(protect);

// Static routes before parameterised ones
router.get('/active', getActiveMenu);          // GET  /api/pos/menus/active?warehouse_id=xxx
router.get('/', listMenus);                    // GET  /api/pos/menus
router.post('/', createMenu);                  // POST /api/pos/menus

// Parameterised menu routes
router.get('/:id', getMenu);                   // GET  /api/pos/menus/:id
router.put('/:id', updateMenu);                // PUT  /api/pos/menus/:id
router.delete('/:id', deleteMenu);             // DELETE /api/pos/menus/:id
router.put('/:id/items', upsertMenuItems);     // PUT  /api/pos/menus/:id/items
router.patch('/:id/display-filters', updateMenuDisplayFilters); // PATCH /api/pos/menus/:id/display-filters

// Outlet assignment
router.post('/:id/outlets/:warehouseId', assignOutlet);    // POST   /api/pos/menus/:id/outlets/:warehouseId
router.delete('/:id/outlets/:warehouseId', unassignOutlet); // DELETE /api/pos/menus/:id/outlets/:warehouseId

export default router;
