import express from 'express';
import { 
  registerCompany, 
  getCompanyBySlug, 
  getMyCompany, 
  updateMyCompany 
} from '../controllers/companies';
import { protect } from '../middleware/auth';

const router = express.Router();

router.post('/register', registerCompany);
router.get('/by-slug/:slug', getCompanyBySlug);

// Company context specific routes
router.get('/me', protect, getMyCompany);
router.patch('/me', protect, updateMyCompany);

export default router;
