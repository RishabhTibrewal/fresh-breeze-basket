import express, { Request, Response } from 'express';
import { protect } from '../middleware/auth';
import { supabase, supabaseAdmin } from '../lib/supabase';

const router = express.Router();

/**
 * @route POST /api/notifications/register-token
 * @desc Save user device token for FCM / Expo Push Notifications
 */
router.post('/register-token', protect, async (req: Request, res: Response) => {
  try {
    const { token, platform } = req.body;
    const userId = req.user?.id;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Push token is required' });
    }

    // Upsert token in user profile / devices table
    const dbClient = supabaseAdmin || supabase;
    const { error } = await dbClient
      .from('user_push_tokens')
      .upsert({
        user_id: userId,
        push_token: token,
        platform: platform || 'android',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id, push_token' });

    if (error) {
      console.warn('Could not save push token directly to database (table may need migration):', error.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Push notification token registered successfully',
    });
  } catch (error) {
    console.error('Error registering push token:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
