import { Router } from 'express';
import * as focusController from '../controllers/focus.controller.js';
import authenticate from '../middleware/auth.js';
const router = Router();
router.put('/settings', authenticate, focusController.updateSettings);
router.post('/session/start', authenticate, focusController.startSession);
router.post('/session/end', authenticate, focusController.endSession);
export default router;
