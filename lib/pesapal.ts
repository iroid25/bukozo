/**
 * Pesapal V3 Integration Library
 * Handles authentication, IPN registration, order submission, and status checking
 */

interface PesapalAuthResponse {
  token: string;
  expiryDate: string;
  error?: string;
  message?: string;
}

interface PesapalIPNResponse {
  url: string;
  created_date: string;
  ipn_id: string;
  error?: string;
  message?: string;
}

interface PesapalOrderRequest {
  id: string;
  currency: string;
  amount: number;
  description: string;
  callback_url: string;
  notification_id: string;
  billing_address: {
    email_address?: string;
    phone_number: string;
    country_code: string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    line_1?: string;
    line_2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    zip_code?: string;
  };
}

interface PesapalOrderResponse {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
  error?: string;
  message?: string;
}

interface PesapalTransactionStatus {
  payment_method: string;
  amount: number;
  created_date: string;
  confirmation_code: string;
  payment_status_description: string;
  description: string;
  message: string;
  payment_account: string;
  call_back_url: string;
  status_code: number;
  merchant_reference: string;
  payment_status_code: string;
  currency: string;
  error?: string;
}

// Token cache
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

/**
 * Get Pesapal base URL based on environment
 */
function getPesapalBaseUrl(): string {
  const environment = process.env.PESAPAL_ENVIRONMENT || 'sandbox';
  
  if (environment === 'production') {
    return 'https://pay.pesapal.com/v3';
  }
  return 'https://cybqa.pesapal.com/pesapalv3';
}

/**
 * Get authentication token from Pesapal
 * Implements token caching to avoid rate limits (cache for 4.5 minutes)
 */
export async function getPesapalAuthToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log('✅ Using cached Pesapal token');
    return cachedToken;
  }

  console.log('🔄 Fetching new Pesapal token...');

  const consumerKey = process.env.PESAPAL_CONSUMER_KEY;
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('Pesapal credentials not configured');
  }

  const baseUrl = getPesapalBaseUrl();
  const url = `${baseUrl}/api/Auth/RequestToken`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Pesapal auth error:', errorText);
      throw new Error(`Pesapal authentication failed: ${response.status}`);
    }

    const data: PesapalAuthResponse = await response.json();

    if (data.error || !data.token) {
      console.error('❌ Pesapal Auth Error Details:', {
        status: response.status,
        statusText: response.statusText,
        data: JSON.stringify(data, null, 2)
      });
      throw new Error(data.message || `Failed to get authentication token: ${JSON.stringify(data)}`);
    }

    // Cache the token for 4.5 minutes (270 seconds)
    cachedToken = data.token;
    tokenExpiry = Date.now() + 270000; // 4.5 minutes in milliseconds

    console.log('✅ Pesapal token obtained and cached');
    return data.token;
  } catch (error) {
    console.error('❌ Error getting Pesapal token:', error);
    throw error;
  }
}

/**
 * Register IPN (Instant Payment Notification) URL with Pesapal
 */
export async function registerPesapalIPN(ipnUrl: string): Promise<string> {
  console.log('📝 Registering IPN URL:', ipnUrl);

  const token = await getPesapalAuthToken();
  const baseUrl = getPesapalBaseUrl();
  const url = `${baseUrl}/api/URLSetup/RegisterIPN`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: ipnUrl,
        ipn_notification_type: 'GET',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ IPN registration error:', errorText);
      throw new Error(`IPN registration failed: ${response.status}`);
    }

    const data: PesapalIPNResponse = await response.json();

    if (data.error || !data.ipn_id) {
      throw new Error(data.message || 'Failed to register IPN');
    }

    console.log('✅ IPN registered successfully:', data.ipn_id);
    return data.ipn_id;
  } catch (error) {
    console.error('❌ Error registering IPN:', error);
    throw error;
  }
}

/**
 * Get or create IPN ID
 * Checks if IPN_ID is already set in environment, otherwise registers a new one
 */
export async function getOrCreateIPNId(): Promise<string> {
  const existingIpnId = process.env.PESAPAL_IPN_ID;
  
  if (existingIpnId && existingIpnId.trim() !== '') {
    console.log('✅ Using existing IPN ID from environment');
    return existingIpnId;
  }

  // Register new IPN
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
  const ipnUrl = `${baseUrl}/api/webhook`;
  
  const ipnId = await registerPesapalIPN(ipnUrl);
  
  console.warn('⚠️ New IPN ID created:', ipnId);
  console.warn('⚠️ Please add this to your .env.local file:');
  console.warn(`PESAPAL_IPN_ID=${ipnId}`);
  
  return ipnId;
}

/**
 * Submit order to Pesapal and get redirect URL
 */
export async function submitPesapalOrder(
  orderData: {
    merchantReference: string;
    amount: number;
    description: string;
    phoneNumber: string;
    email?: string;
    firstName: string;
    lastName: string;
  }
): Promise<PesapalOrderResponse> {
  console.log('📤 Submitting order to Pesapal:', orderData.merchantReference);

  const token = await getPesapalAuthToken();
  const ipnId = await getOrCreateIPNId();
  const baseUrl = getPesapalBaseUrl();
  const url = `${baseUrl}/api/Transactions/SubmitOrderRequest`;

  const callbackUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}/dashboard/member-details/deposit-details`;
  const currency = process.env.NEXT_PUBLIC_CURRENCY || 'UGX';
  const countryCode = process.env.NEXT_PUBLIC_COUNTRY_CODE || '256';

  const orderRequest: PesapalOrderRequest = {
    id: orderData.merchantReference,
    currency,
    amount: orderData.amount,
    description: orderData.description,
    callback_url: callbackUrl,
    notification_id: ipnId,
    billing_address: {
      email_address: orderData.email,
      phone_number: orderData.phoneNumber,
      country_code: countryCode,
      first_name: orderData.firstName,
      middle_name: '',
      last_name: orderData.lastName,
      line_1: '',
      line_2: '',
      city: '',
      state: '',
      postal_code: '',
      zip_code: '',
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Order submission error:', errorText);
      throw new Error(`Order submission failed: ${response.status}`);
    }

    const data: PesapalOrderResponse = await response.json();

    if (data.error || !data.redirect_url) {
      throw new Error(data.message || 'Failed to submit order');
    }

    console.log('✅ Order submitted successfully:', data.order_tracking_id);
    return data;
  } catch (error) {
    console.error('❌ Error submitting order:', error);
    throw error;
  }
}

/**
 * Get transaction status from Pesapal
 */
export async function getPesapalTransactionStatus(
  orderTrackingId: string
): Promise<PesapalTransactionStatus> {
  console.log('🔍 Checking transaction status:', orderTrackingId);

  const token = await getPesapalAuthToken();
  const baseUrl = getPesapalBaseUrl();
  const url = `${baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Status check error:', errorText);
      throw new Error(`Status check failed: ${response.status}`);
    }

    const data: PesapalTransactionStatus = await response.json();

    // Only throw error if there's an actual error (not null) and message is not a success message
    if (data.error && typeof data.error === 'string' && !data.message?.includes('successfully')) {
      throw new Error(data.error || 'Failed to get transaction status');
    }

    console.log('✅ Transaction status:', data.payment_status_description);
    return data;
  } catch (error) {
    console.error('❌ Error checking transaction status:', error);
    throw error;
  }
}

/**
 * Map Pesapal status code to human-readable status
 * 0 = Invalid
 * 1 = Completed
 * 2 = Failed
 * 3 = Reversed
 */
export function mapPesapalStatus(statusCode: number): string {
  switch (statusCode) {
    case 0:
      return 'Invalid';
    case 1:
      return 'Completed';
    case 2:
      return 'Failed';
    case 3:
      return 'Reversed';
    default:
      return 'Unknown';
  }
}

/**
 * Clear cached token (useful for testing or forcing refresh)
 */
export function clearTokenCache(): void {
  cachedToken = null;
  tokenExpiry = null;
  console.log('🗑️ Token cache cleared');
}
