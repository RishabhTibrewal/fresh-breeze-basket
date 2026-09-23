import express, { Request, Response } from 'express';
import { ShiprocketService } from '../services/core/ShiprocketService';

const router = express.Router();

/**
 * @route POST /api/delivery/check-pincode
 * @desc Check nationwide delivery serviceability and estimated transit time
 */
router.post('/check-pincode', async (req: Request, res: Response) => {
  try {
    const { pincode } = req.body;

    if (!pincode) {
      return res.status(400).json({
        success: false,
        message: 'Pincode is required',
      });
    }

    const result = await ShiprocketService.checkServiceability(pincode.toString().trim());

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error checking delivery pincode:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify delivery pincode',
    });
  }
});

export default router;
