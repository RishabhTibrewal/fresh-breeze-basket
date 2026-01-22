import express from 'express';
import { registerCompany } from '../controllers/companies';

const router = express.Router();

router.post('/register', registerCompany);

export default router;
