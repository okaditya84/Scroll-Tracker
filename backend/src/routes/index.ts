import { Router } from 'express';
import authRoutes from './auth.routes.js';
import trackingRoutes from './tracking.routes.js';
import insightRoutes from './insight.routes.js';
import userRoutes from './user.routes.js';
import requireAuth from '../middleware/auth.js';
import adminRoutes from './admin.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/tracking', requireAuth, trackingRoutes);
router.use('/insights', requireAuth, insightRoutes);
router.use('/users', requireAuth, userRoutes);
router.use('/admin', adminRoutes);

export default router;
