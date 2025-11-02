import { Router } from 'express';
import * as trackingController from '../controllers/tracking.controller.js';
const router = Router();
router.post('/events', trackingController.recordEvents);
router.get('/summary', trackingController.getSummary);
router.get('/timeline', trackingController.getTimeline);
router.get('/streaks', trackingController.getStreaks);
export default router;
