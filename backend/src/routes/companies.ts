import express from 'express';
import { registerCompany, getCompanyBySlug } from '../controllers/companies';

const router = express.Router();

router.post('/register', registerCompany);
router.get('/by-slug/:slug', getCompanyBySlug);

export default router;
