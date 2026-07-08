# MTN MoMo API Integration Guide (Uganda)

This document provides detailed instructions for integrating the MTN MoMo OpenAPI for the SACCO system, covering **Deposits** (Collections), **Withdrawals** (Disbursements), and **Loan Repayments** (Collections).

## 1. Initial Setup & Credentials

### Sandbox Access
- **Developer Portal**: [momodeveloper.mtn.com](https://momodeveloper.mtn.com/)
- **Subscription Keys**: Obtain the primary/secondary keys for both **Collections** and **Disbursements** from your Profile page.

### Environment Variables (.env)
```bash
MOMO_TARGET_ENV=sandbox
MOMO_TYPE=sandbox
MOMO_COLLECTIONS_SUB_KEY=your_collections_key
MOMO_DISBURSEMENTS_SUB_KEY=your_disbursements_key

# These are generated via API for Sandbox (Run scripts/setup-momo-sandbox.ts)
MOMO_COLLECTIONS_API_USER=your_uuid_v4
MOMO_COLLECTIONS_API_KEY=your_generated_api_key
MOMO_DISBURSEMENTS_API_USER=your_uuid_v4
MOMO_DISBURSEMENTS_API_KEY=your_generated_api_key
```


---

## 2. Sandbox API User & Key Generation
In the sandbox environment, you must programmatically create an API User (UUID v4) and retrieve an API Key.

1.  **Subscription Keys**: Get your Primary Keys from the Developer Portal.
2.  **Run Setup Script**: 
    ```bash
    npx ts-node scripts/setup-momo-sandbox.ts
    ```
    This script will:
    - Create API Users (UUID v4).
    - Generate API Keys.
    - Validate tokens.
3.  **Update `.env`**: Copy the generated UUIDs and Keys into your `.env` file.

---

## 3. Using MonoService

A core service `MomoService` is available in `services/momo.service.ts` to handle all interactions.

### Get Token
```typescript
const token = await MomoService.getToken('collection');
```

### Request to Pay (Deposit/Repayment)
```typescript
const referenceId = await MomoService.requestToPay({
  amount: "1000",
  currency: "UGX",
  externalId: "TXN-001",
  payer: { partyIdType: "MSISDN", partyId: "256..." },
  payerMessage: "Payment for SACCO",
  payeeNote: "Deposit"
});
```


---

## 3. Implementation Flows

### A. Deposits & Loan Repayments (Collections)
**Product**: Collections
**Method**: `POST /collection/v1_0/requesttopay`

**Execution Logic**:
1.  **Authentication**: Get a Collections bearer token.
2.  **Request**: Send payment request to user's phone.
    - `amount`: Transaction amount.
    - `currency`: `UGX`.
    - `externalId`: SACCO transaction reference.
    - `payer`: `{ "partyIdType": "MSISDN", "partyId": "256..." }`.
    - `payerMessage`: e.g., "Loan Repayment for Bukonzemergency".
3.  **Status**: Look for `202 Accepted`.
4.  **Verification**: Poll `GET /collection/v1_0/requesttopay/{refId}` or wait for **Callback**.

---

### B. Withdrawals (Disbursements)
**Product**: Disbursements
**Method**: `POST /disbursement/v1_0/transfer`

**Execution Logic**:
1.  **Authentication**: Get a Disbursements bearer token.
2.  **Request**: Initiate transfer to user's phone.
    - `X-Target-Environment`: `sandbox`.
    - `payee`: `{ "partyIdType": "MSISDN", "partyId": "256..." }`.
    - Same structure as requesttopay.
3.  **Security**: Ensure your callback URL is HTTPS in production.

---

## 4. Webhooks & Callbacks
MTN sends a POST request to your `X-Callback-Url` once the transaction is finalized.

**Payload Structure**:
```json
{
  "financialTransactionId": "12345",
  "externalId": "SACCO-REF-001",
  "amount": "1000",
  "currency": "UGX",
  "payer": { "partyIdType": "MSISDN", "partyId": "2567..." },
  "status": "SUCCESSFUL"
}
```

**Actions on Callback**:
- Update `Transaction` status.
- Update `Member` or `Institution` account balance.
- Notify the user via SMS/Email.

---

## 5. Testing MSISDNs (Sandbox)
Use the following test MSISDNs in the sandbox:
- `46733123453` (Successful transaction)
- `46733123454` (Insufficient funds)
- `46733123452` (Transaction timeout)

> [!WARNING]
> In production, the `X-Target-Environment` must be changed to `mtnuganda`.

---
*Last updated: March 2026*
