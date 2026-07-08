import axios from 'axios';

export interface RelworxPaymentParams {
  msisdn: string;
  amount: number;
  currency?: string;
  reference: string;
  description: string;
}

export interface RelworxResponse {
  success: boolean;
  message: string;
  internal_reference?: string;
  status?: string;
}

export interface RelworxStatusResponse {
  success: boolean;
  status: 'success' | 'failed' | 'pending' | 'processing';
  message: string;
  customer_reference: string;
  internal_reference: string;
  msisdn: string;
  amount: number;
  currency: string;
  provider?: string;
  charge?: number;
  request_status: string;
  remote_ip?: string;
  provider_transaction_id?: string;
  completed_at?: string;
}

export class RelworxService {
  private static readonly BASE_URL = process.env.RELWORX_API_BASE_URL || 'https://payments.relworx.com/api';
  private static readonly ACCOUNT_NO = process.env.RELWORX_ACCOUNT_NO;
  private static readonly API_KEY = process.env.RELWORX_API_KEY;

  private static getHeaders() {
    return {
      'Authorization': `Bearer ${this.API_KEY}`,
      'Accept': 'application/vnd.relworx.v2',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Formats phone number to +256... format required by Relworx
   */
  private static formatMsisdn(phone: string): string {
    let cleaned = (phone || "").replace(/\D/g, "");

    if (cleaned.startsWith("0")) {
      cleaned = `256${cleaned.substring(1)}`;
    } else if (cleaned.startsWith("7") && cleaned.length === 9) {
      cleaned = `256${cleaned}`;
    }

    return cleaned.startsWith("256") ? `+${cleaned}` : phone.trim();
  }

  /**
   * Request Payment (Collections / Inward)
   * This is used when a member is making a deposit or loan repayment.
   */
  public static async requestPayment(params: RelworxPaymentParams): Promise<RelworxResponse> {
    try {
      const response = await axios.post<RelworxResponse>(
        `${this.BASE_URL}/mobile-money/request-payment`,
        {
          account_no: this.ACCOUNT_NO,
          reference: params.reference,
          msisdn: this.formatMsisdn(params.msisdn),
          currency: params.currency || 'UGX',
          amount: params.amount,
          description: params.description,
        },
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error: any) {
      console.error('Relworx RequestPayment Error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Send Payment (Disbursements / Outward)
   * This is used for loan payouts or member withdrawals.
   */
  public static async sendPayment(params: RelworxPaymentParams): Promise<RelworxResponse> {
    try {
      const response = await axios.post<RelworxResponse>(
        `${this.BASE_URL}/mobile-money/send-payment`,
        {
          account_no: this.ACCOUNT_NO,
          reference: params.reference,
          msisdn: this.formatMsisdn(params.msisdn),
          currency: params.currency || 'UGX',
          amount: params.amount,
          description: params.description,
        },
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error: any) {
      console.error('Relworx SendPayment Error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Check Transaction Status
   */
  public static async getTransactionStatus(internalReference: string): Promise<RelworxStatusResponse> {
    try {
      const response = await axios.get<RelworxStatusResponse>(
        `${this.BASE_URL}/mobile-money/check-request-status`,
        {
          params: {
            internal_reference: internalReference,
            account_no: this.ACCOUNT_NO,
          },
          headers: this.getHeaders(),
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Relworx GetStatus Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  public static async checkTransactionStatus(internalReference: string): Promise<RelworxStatusResponse> {
    return this.getTransactionStatus(internalReference);
  }
}
