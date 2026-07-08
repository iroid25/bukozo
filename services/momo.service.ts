import axios from 'axios';
import crypto from 'crypto';

export type MomoProduct = 'collection' | 'disbursement';

export interface Payer {
  partyIdType: 'MSISDN';
  partyId: string;
}

export interface RequestToPayParams {
  amount: string;
  currency: string;
  externalId: string;
  payer: Payer;
  payerMessage: string;
  payeeNote: string;
}

export interface TransferParams {
  amount: string;
  currency: string;
  externalId: string;
  payee: Payer;
  payerMessage: string;
  payeeNote: string;
}

export interface MomoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export class MomoService {
  private static readonly BASE_URL = 'https://sandbox.momodeveloper.mtn.com'; // Change to mtnuganda for PROD
  private static readonly TARGET_ENVIRONMENT = process.env.MOMO_TARGET_ENV || 'sandbox';

  private static getHeaders(product: MomoProduct, referenceId?: string) {
    const subKey = product === 'collection' 
      ? process.env.MOMO_COLLECTIONS_SUB_KEY 
      : process.env.MOMO_DISBURSEMENTS_SUB_KEY;

    return {
      'Ocp-Apim-Subscription-Key': subKey,
      'X-Target-Environment': this.TARGET_ENVIRONMENT,
      ...(referenceId && { 'X-Reference-Id': referenceId }),
    };
  }

  /**
   * Generates a Bearer Token for the specified product.
   */
  public static async getToken(product: MomoProduct): Promise<string> {
    const apiUser = product === 'collection' 
      ? process.env.MOMO_COLLECTIONS_API_USER 
      : process.env.MOMO_DISBURSEMENTS_API_USER;
    const apiKey = product === 'collection' 
      ? process.env.MOMO_COLLECTIONS_API_KEY 
      : process.env.MOMO_DISBURSEMENTS_API_KEY;

    const auth = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');

    const response = await axios.post<MomoTokenResponse>(
      `${this.BASE_URL}/${product}/token/`,
      {},
      {
        headers: {
          ...this.getHeaders(product),
          'Authorization': `Basic ${auth}`,
        },
      }
    );

    return response.data.access_token;
  }

  /**
   * Request To Pay (Collections)
   */
  public static async requestToPay(params: RequestToPayParams): Promise<string> {
    const referenceId = crypto.randomUUID();
    const token = await this.getToken('collection');

    await axios.post(
      `${this.BASE_URL}/collection/v1_0/requesttopay`,
      params,
      {
        headers: {
          ...this.getHeaders('collection', referenceId),
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return referenceId;
  }

  /**
   * Get Transaction Status (Collections)
   */
  public static async getTransactionStatus(referenceId: string) {
    const token = await this.getToken('collection');

    const response = await axios.get(
      `${this.BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
      {
        headers: {
          ...this.getHeaders('collection'),
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data;
  }

  /**
   * Transfer (Disbursements)
   */
  public static async transfer(params: TransferParams): Promise<string> {
    const referenceId = crypto.randomUUID();
    const token = await this.getToken('disbursement');

    await axios.post(
      `${this.BASE_URL}/disbursement/v1_0/transfer`,
      params,
      {
        headers: {
          ...this.getHeaders('disbursement', referenceId),
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return referenceId;
  }

  /**
   * Get Transfer Status (Disbursements)
   */
  public static async getTransferStatus(referenceId: string) {
    const token = await this.getToken('disbursement');

    const response = await axios.get(
      `${this.BASE_URL}/disbursement/v1_0/transfer/${referenceId}`,
      {
        headers: {
          ...this.getHeaders('disbursement'),
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data;
  }
}
