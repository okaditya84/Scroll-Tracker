import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import requireAuth from '../middleware/auth.js';
import isAdmin from '../middleware/admin.js';
const router = Router();
// All admin routes require authentication + admin role (or basic auth as fallback)
router.use(requireAuth, isAdmin);
router.get('/users', adminController.listUsers);
router.get('/events', adminController.listEvents);
router.get('/metrics', adminController.listMetrics);
router.get('/insights', adminController.listInsights);
router.get('/summary', adminController.summary);
export default router;
