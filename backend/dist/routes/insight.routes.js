import { Router } from 'express';
import * as insightController from '../controllers/insight.controller.js';
const router = Router();
router.get('/', insightController.getInsights);
router.post('/generate', insightController.generateInsightOnDemand);
export default router;
