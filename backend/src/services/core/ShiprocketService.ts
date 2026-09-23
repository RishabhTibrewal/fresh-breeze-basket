import axios from 'axios';

interface ServiceabilityResponse {
  serviceable: boolean;
  estimated_days: number;
  courier_name?: string;
  pincode: string;
  city?: string;
  state?: string;
  message?: string;
}

export class ShiprocketService {
  private static token: string | null = null;
  private static tokenExpiry: number | null = null;

  /**
   * Get Shiprocket API Token (authenticates if expired or missing)
   */
  private static async getToken(): Promise<string | null> {
    const email = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;

    if (!email || !password) {
      return null;
    }

    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    try {
      const response = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
        email,
        password,
      });

      if (response.data && response.data.token) {
        this.token = response.data.token;
        // Token expires in 10 days, refresh after 9 days
        this.tokenExpiry = Date.now() + 9 * 24 * 60 * 60 * 1000;
        return this.token;
      }
    } catch (error) {
      console.warn('[ShiprocketService] Authentication failed, using fallback estimation:', error);
    }
    return null;
  }

  /**
   * Check nationwide delivery serviceability for a delivery pincode
   */
  public static async checkServiceability(
    deliveryPincode: string,
    pickupPincode: string = process.env.DEFAULT_PICKUP_PINCODE || '110001'
  ): Promise<ServiceabilityResponse> {
    // Validate Indian pincode format (6 digits)
    const pincodeRegex = /^[1-9][0-9]{5}$/;
    if (!pincodeRegex.test(deliveryPincode)) {
      return {
        serviceable: false,
        estimated_days: 0,
        pincode: deliveryPincode,
        message: 'Invalid 6-digit Indian Pincode',
      };
    }

    const token = await this.getToken();

    if (token) {
      try {
        const response = await axios.get(
          'https://apiv2.shiprocket.in/v1/external/courier/serviceability/',
          {
            params: {
              pickup_postcode: pickupPincode,
              delivery_postcode: deliveryPincode,
              weight: 1.0,
              cod: 0,
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data && response.data.status === 200 && response.data.data) {
          const availableCouriers = response.data.data.available_courier_companies;
          if (availableCouriers && availableCouriers.length > 0) {
            const fastestCourier = availableCouriers.reduce((prev: any, curr: any) =>
              (prev.etd_hours || 72) < (curr.etd_hours || 72) ? prev : curr
            );

            const estimatedDays = Math.max(2, Math.ceil((fastestCourier.etd_hours || 72) / 24));
            return {
              serviceable: true,
              estimated_days: estimatedDays,
              courier_name: fastestCourier.courier_name,
              pincode: deliveryPincode,
              city: response.data.data.delivery_city || undefined,
              state: response.data.data.delivery_state || undefined,
              message: `Express Nationwide Delivery within ${estimatedDays} business days.`,
            };
          }
        }
      } catch (err) {
        console.warn('[ShiprocketService] API query error, proceeding with pincode heuristics:', err);
      }
    }

    // Fallback heuristic estimation when API credentials are pending or offline
    return {
      serviceable: true,
      estimated_days: 3,
      courier_name: 'Standard Express Courier',
      pincode: deliveryPincode,
      message: 'Nationwide Delivery available (2-4 business days).',
    };
  }
}
