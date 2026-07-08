import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'https://sandbox.momodeveloper.mtn.com';

async function testCollections() {
  console.log('\n=== Testing Collections ===');
  
  const apiUser = process.env.MOMO_COLLECTIONS_API_USER!;
  const apiKey = process.env.MOMO_COLLECTIONS_API_KEY!;
  const subKey = process.env.MOMO_COLLECTIONS_SUB_KEY!;

  console.log(`API User: ${apiUser}`);
  console.log(`Sub Key: ${subKey.substring(0, 8)}...`);

  // Step 1: Get Token
  console.log('\n1. Getting Collections token...');
  const auth = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');
  
  try {
    const tokenRes = await axios.post(
      `${BASE_URL}/collection/token/`,
      {},
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Ocp-Apim-Subscription-Key': subKey,
        }
      }
    );
    const token = tokenRes.data.access_token;
    console.log(`✅ Token acquired: ${token.substring(0, 20)}...`);

    // Step 2: Request to Pay (test MSISDN)
    console.log('\n2. Sending Request to Pay...');
    const referenceId = crypto.randomUUID();
    
    await axios.post(
      `${BASE_URL}/collection/v1_0/requesttopay`,
      {
        amount: '1000',
        currency: 'EUR',
        externalId: 'TEST-001',
        payer: { partyIdType: 'MSISDN', partyId: '46733123453' },
        payerMessage: 'Test payment from SACCO',
        payeeNote: 'Sandbox test',
      },
      {
        headers: {
          'X-Reference-Id': referenceId,
          'X-Target-Environment': 'sandbox',
          'Ocp-Apim-Subscription-Key': subKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );
    console.log(`✅ Request to Pay submitted. Reference: ${referenceId}`);

    // Step 3: Check status
    console.log('\n3. Checking transaction status...');
    await new Promise(r => setTimeout(r, 3000)); // Wait 3s
    
    const statusRes = await axios.get(
      `${BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
      {
        headers: {
          'X-Target-Environment': 'sandbox',
          'Ocp-Apim-Subscription-Key': subKey,
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    console.log(`✅ Transaction status: ${statusRes.data.status}`);
    console.log('   Full response:', JSON.stringify(statusRes.data, null, 2));
    
  } catch (error: any) {
    console.error('❌ Collections Error:', error.response?.status, error.response?.data || error.message);
  }
}

async function testDisbursements() {
  console.log('\n=== Testing Disbursements ===');
  
  const apiUser = process.env.MOMO_DISBURSEMENTS_API_USER!;
  const apiKey = process.env.MOMO_DISBURSEMENTS_API_KEY!;
  const subKey = process.env.MOMO_DISBURSEMENTS_SUB_KEY!;

  console.log(`API User: ${apiUser}`);
  console.log(`Sub Key: ${subKey.substring(0, 8)}...`);

  // Step 1: Get Token
  console.log('\n1. Getting Disbursements token...');
  const auth = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');
  
  try {
    const tokenRes = await axios.post(
      `${BASE_URL}/disbursement/token/`,
      {},
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Ocp-Apim-Subscription-Key': subKey,
        }
      }
    );
    const token = tokenRes.data.access_token;
    console.log(`✅ Token acquired: ${token.substring(0, 20)}...`);

    // Step 2: Transfer
    console.log('\n2. Sending Transfer...');
    const referenceId = crypto.randomUUID();
    
    await axios.post(
      `${BASE_URL}/disbursement/v1_0/transfer`,
      {
        amount: '500',
        currency: 'EUR',
        externalId: 'TEST-DISB-001',
        payee: { partyIdType: 'MSISDN', partyId: '46733123453' },
        payerMessage: 'Test disbursement from SACCO',
        payeeNote: 'Sandbox test',
      },
      {
        headers: {
          'X-Reference-Id': referenceId,
          'X-Target-Environment': 'sandbox',
          'Ocp-Apim-Subscription-Key': subKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );
    console.log(`✅ Transfer submitted. Reference: ${referenceId}`);

    // Step 3: Check status
    console.log('\n3. Checking transfer status...');
    await new Promise(r => setTimeout(r, 3000));
    
    const statusRes = await axios.get(
      `${BASE_URL}/disbursement/v1_0/transfer/${referenceId}`,
      {
        headers: {
          'X-Target-Environment': 'sandbox',
          'Ocp-Apim-Subscription-Key': subKey,
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    console.log(`✅ Transfer status: ${statusRes.data.status}`);
    console.log('   Full response:', JSON.stringify(statusRes.data, null, 2));
    
  } catch (error: any) {
    console.error('❌ Disbursements Error:', error.response?.status, error.response?.data || error.message);
  }
}

async function main() {
  console.log('🔧 MTN MoMo Sandbox Integration Test');
  console.log('=====================================');
  
  await testCollections();
  await testDisbursements();
  
  console.log('\n=====================================');
  console.log('🏁 Test complete!');
}

main();
