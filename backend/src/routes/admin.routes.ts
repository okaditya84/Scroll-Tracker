import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import isAdmin from '../middleware/admin.js';
import { listContactMessages } from '../controllers/content.controller.js';

const router = Router();

// All admin routes require admin level verification
router.use(isAdmin);

router.get('/users', adminController.listUsers);
router.post('/users/:id/promote', adminController.promoteUser);
router.post('/users/:id/demote', adminController.demoteUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/users/:id/detail', adminController.getUserDetail);
router.patch('/users/:id/tracking', adminController.updateTrackingStatus);
router.get('/events', adminController.listEvents);
router.get('/events/export', adminController.exportEventsCsv);
router.get('/metrics', adminController.listMetrics);
router.get('/insights', adminController.listInsights);
router.get('/summary', adminController.summary);
router.get('/activity/live', adminController.liveActivity);
router.get('/contact/messages', listContactMessages);
router.get('/otp/metrics', adminController.listOtpMetrics);

export default router;
