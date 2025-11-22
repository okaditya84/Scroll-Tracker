import { Router } from 'express';
import authRoutes from './auth.routes.js';
import trackingRoutes from './tracking.routes.js';
import insightRoutes from './insight.routes.js';
import userRoutes from './user.routes.js';
import requireAuth from '../middleware/auth.js';
import adminRoutes from './admin.routes.js';
import contentRoutes from './content.routes.js';
import analyticsRoutes from './analytics.routes.js';
import focusRoutes from './focus.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/tracking', requireAuth, trackingRoutes);
router.use('/insights', requireAuth, insightRoutes);
router.use('/users', requireAuth, userRoutes);
router.use('/admin', adminRoutes);
router.use('/content', contentRoutes);
router.use('/analytics', requireAuth, analyticsRoutes);
router.use('/focus', requireAuth, focusRoutes);

export default router;
