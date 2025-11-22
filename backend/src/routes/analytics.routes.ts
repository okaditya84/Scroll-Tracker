import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import authenticate from '../middleware/auth.js';

const router = Router();

router.get('/dashboard', authenticate, analyticsController.getDashboardStats);
router.get('/focus', authenticate, analyticsController.getFocusStats);

export default router;
