import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
const router = Router();
router.get('/me', userController.getProfile);
router.patch('/me', userController.updateProfile);
router.get('/me/preferences', userController.getPreferences);
router.patch('/me/preferences', userController.updatePreferences);
router.delete('/me', userController.deleteAccount);
export default router;
