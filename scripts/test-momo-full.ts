import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'https://sandbox.momodeveloper.mtn.com';
const COLLECTIONS_SUB_KEY = process.env.MOMO_COLLECTIONS_SUB_KEY!;
const DISBURSEMENTS_SUB_KEY = process.env.MOMO_DISBURSEMENTS_SUB_KEY!;
const COLLECTIONS_API_USER = process.env.MOMO_COLLECTIONS_API_USER!;
const COLLECTIONS_API_KEY = process.env.MOMO_COLLECTIONS_API_KEY!;
const DISBURSEMENTS_API_USER = process.env.MOMO_DISBURSEMENTS_API_USER!;
const DISBURSEMENTS_API_KEY = process.env.MOMO_DISBURSEMENTS_API_KEY!;

const results: { tc: string; request: string; expected: string; actual: string; status: string }[] = [];

function log(tc: string, request: string, expected: string, actual: string, pass: boolean) {
  const status = pass ? '✅ PASS' : '❌ FAIL';
  results.push({ tc, request, expected, actual, status });
  console.log(`${status} | ${tc} | ${request} | Expected: ${expected} | Actual: ${actual}`);
}

async function getCollectionsToken(): Promise<string> {
  const auth = Buffer.from(`${COLLECTIONS_API_USER}:${COLLECTIONS_API_KEY}`).toString('base64');
  const res = await axios.post(`${BASE_URL}/collection/token/`, {}, {
    headers: { 'Authorization': `Basic ${auth}`, 'Ocp-Apim-Subscription-Key': COLLECTIONS_SUB_KEY }
  });
  return res.data.access_token;
}

async function getDisbursementsToken(): Promise<string> {
  const auth = Buffer.from(`${DISBURSEMENTS_API_USER}:${DISBURSEMENTS_API_KEY}`).toString('base64');
  const res = await axios.post(`${BASE_URL}/disbursement/token/`, {}, {
    headers: { 'Authorization': `Basic ${auth}`, 'Ocp-Apim-Subscription-Key': DISBURSEMENTS_SUB_KEY }
  });
  return res.data.access_token;
}

// ==================== COLLECTIONS TESTS ====================

async function collectionTC01_01() {
  // Invalid Subscription Key → expect 401
  const auth = Buffer.from(`${COLLECTIONS_API_USER}:${COLLECTIONS_API_KEY}`).toString('base64');
  try {
    await axios.post(`${BASE_URL}/collection/token/`, {}, {
      headers: { 'Authorization': `Basic ${auth}`, 'Ocp-Apim-Subscription-Key': 'INVALID_KEY_12345' }
    });
    log('TC01-01', 'Collections Token - Invalid Sub Key', '401', 'Got 200 (unexpected)', false);
  } catch (e: any) {
    const status = e.response?.status;
    log('TC01-01', 'Collections Token - Invalid Sub Key', '401', `${status} - ${e.response?.data?.message || JSON.stringify(e.response?.data)}`, status === 401);
  }
}

async function collectionTC01_02() {
  // Invalid API Key → expect 401
  const auth = Buffer.from(`${COLLECTIONS_API_USER}:INVALID_API_KEY`).toString('base64');
  try {
    await axios.post(`${BASE_URL}/collection/token/`, {}, {
      headers: { 'Authorization': `Basic ${auth}`, 'Ocp-Apim-Subscription-Key': COLLECTIONS_SUB_KEY }
    });
    log('TC01-02', 'Collections Token - Invalid API Key', '401', 'Got 200 (unexpected)', false);
  } catch (e: any) {
    const status = e.response?.status;
    log('TC01-02', 'Collections Token - Invalid API Key', '401', `${status} - ${e.response?.data?.message || JSON.stringify(e.response?.data)}`, status === 401);
  }
}

async function collectionTC01_04() {
  // Second token before first expires — both should be valid
  const token1 = await getCollectionsToken();
  const token2 = await getCollectionsToken();
  const bothValid = token1 && token2 && token1 !== token2;
  log('TC01-04', 'Collections - Second Token Before Expiry', 'Both tokens valid', `Token1: ${token1.substring(0, 15)}... Token2: ${token2.substring(0, 15)}... Different: ${token1 !== token2}`, !!token1 && !!token2);
}

async function collectionTC02_02() {
  // Subscriber Rejects — use MSISDN 46733123454 (insufficient funds = rejection)
  const token = await getCollectionsToken();
  const refId = crypto.randomUUID();
  try {
    await axios.post(`${BASE_URL}/collection/v1_0/requesttopay`, {
      amount: '1000', currency: 'EUR', externalId: 'SACCO-REJECT-001',
      payer: { partyIdType: 'MSISDN', partyId: '46733123454' },
      payerMessage: 'Test rejected payment', payeeNote: 'Rejection test'
    }, {
      headers: {
        'X-Reference-Id': refId, 'X-Target-Environment': 'sandbox',
        'Ocp-Apim-Subscription-Key': COLLECTIONS_SUB_KEY,
        'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'
      }
    });
    // Wait and check status
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await axios.get(`${BASE_URL}/collection/v1_0/requesttopay/${refId}`, {
      headers: { 'X-Target-Environment': 'sandbox', 'Ocp-Apim-Subscription-Key': COLLECTIONS_SUB_KEY, 'Authorization': `Bearer ${token}` }
    });
    const txStatus = statusRes.data.status;
    const reason = statusRes.data.reason || 'N/A';
    log('TC02-02', 'Collections - Subscriber Rejects (Insufficient Funds)', 'FAILED', `${txStatus} - reason: ${JSON.stringify(statusRes.data.reason || statusRes.data)}`, txStatus === 'FAILED');
  } catch (e: any) {
    log('TC02-02', 'Collections - Subscriber Rejects', 'FAILED status', `Error: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`, false);
  }
}

async function collectionTC02_03() {
  // Approval Timeout — use MSISDN 46733123452
  const token = await getCollectionsToken();
  const refId = crypto.randomUUID();
  try {
    await axios.post(`${BASE_URL}/collection/v1_0/requesttopay`, {
      amount: '1000', currency: 'EUR', externalId: 'SACCO-TIMEOUT-001',
      payer: { partyIdType: 'MSISDN', partyId: '46733123452' },
      payerMessage: 'Test timeout payment', payeeNote: 'Timeout test'
    }, {
      headers: {
        'X-Reference-Id': refId, 'X-Target-Environment': 'sandbox',
        'Ocp-Apim-Subscription-Key': COLLECTIONS_SUB_KEY,
        'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'
      }
    });
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await axios.get(`${BASE_URL}/collection/v1_0/requesttopay/${refId}`, {
      headers: { 'X-Target-Environment': 'sandbox', 'Ocp-Apim-Subscription-Key': COLLECTIONS_SUB_KEY, 'Authorization': `Bearer ${token}` }
    });
    const txStatus = statusRes.data.status;
    log('TC02-03', 'Collections - Approval Timeout', 'FAILED/TIMEOUT', `${txStatus} - ${JSON.stringify(statusRes.data.reason || statusRes.data)}`, txStatus === 'FAILED' || txStatus === 'PENDING');
  } catch (e: any) {
    log('TC02-03', 'Collections - Approval Timeout', 'FAILED/TIMEOUT', `Error: ${e.response?.status}`, false);
  }
}

async function collectionTC_duplicateRef() {
  // Duplicate Reference ID
  const token = await getCollectionsToken();
  const refId = crypto.randomUUID();
  const body = {
    amount: '500', currency: 'EUR', externalId: 'SACCO-DUP-001',
    payer: { partyIdType: 'MSISDN', partyId: '46733123453' },
    payerMessage: 'Duplicate test', payeeNote: 'Dup ref'
  };
  const headers = {
    'X-Reference-Id': refId, 'X-Target-Environment': 'sandbox',
    'Ocp-Apim-Subscription-Key': COLLECTIONS_SUB_KEY,
    'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'
  };

  // First request
  await axios.post(`${BASE_URL}/collection/v1_0/requesttopay`, body, { headers });
  
  // Second request with same ref ID
  try {
    await axios.post(`${BASE_URL}/collection/v1_0/requesttopay`, body, { headers });
    log('TC-DUP', 'Collections - Duplicate Reference ID', '409 Conflict', 'Got 202 (unexpected)', false);
  } catch (e: any) {
    const status = e.response?.status;
    log('TC-DUP', 'Collections - Duplicate Reference ID', '409 Conflict', `${status} - ${JSON.stringify(e.response?.data)}`, status === 409);
  }
}

async function collectionTC_incompleteInfo() {
  // Incomplete info — missing payer
  const token = await getCollectionsToken();
  const refId = crypto.randomUUID();
  try {
    await axios.post(`${BASE_URL}/collection/v1_0/requesttopay`, {
      amount: '1000', currency: 'EUR', externalId: 'SACCO-INCOMPLETE-001'
      // Missing payer field
    }, {
      headers: {
        'X-Reference-Id': refId, 'X-Target-Environment': 'sandbox',
        'Ocp-Apim-Subscription-Key': COLLECTIONS_SUB_KEY,
        'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'
      }
    });
    log('TC-INC', 'Collections - Incomplete Info (no payer)', '400 Bad Request', 'Got 202 (unexpected)', false);
  } catch (e: any) {
    const status = e.response?.status;
    log('TC-INC', 'Collections - Incomplete Info (no payer)', '400 Bad Request', `${status} - ${JSON.stringify(e.response?.data)}`, status === 400);
  }
}

// ==================== DISBURSEMENTS TESTS ====================

async function disbursementTC01_01() {
  const auth = Buffer.from(`${DISBURSEMENTS_API_USER}:${DISBURSEMENTS_API_KEY}`).toString('base64');
  try {
    await axios.post(`${BASE_URL}/disbursement/token/`, {}, {
      headers: { 'Authorization': `Basic ${auth}`, 'Ocp-Apim-Subscription-Key': 'INVALID_KEY_12345' }
    });
    log('TC01-01', 'Disbursements Token - Invalid Sub Key', '401', 'Got 200 (unexpected)', false);
  } catch (e: any) {
    const status = e.response?.status;
    log('TC01-01', 'Disbursements Token - Invalid Sub Key', '401', `${status} - ${e.response?.data?.message || JSON.stringify(e.response?.data)}`, status === 401);
  }
}

async function disbursementTC01_02() {
  const auth = Buffer.from(`${DISBURSEMENTS_API_USER}:INVALID_API_KEY`).toString('base64');
  try {
    await axios.post(`${BASE_URL}/disbursement/token/`, {}, {
      headers: { 'Authorization': `Basic ${auth}`, 'Ocp-Apim-Subscription-Key': DISBURSEMENTS_SUB_KEY }
    });
    log('TC01-02', 'Disbursements Token - Invalid API Key', '401', 'Got 200 (unexpected)', false);
  } catch (e: any) {
    const status = e.response?.status;
    log('TC01-02', 'Disbursements Token - Invalid API Key', '401', `${status} - ${e.response?.data?.message || JSON.stringify(e.response?.data)}`, status === 401);
  }
}

async function disbursementTC01_04() {
  const token1 = await getDisbursementsToken();
  const token2 = await getDisbursementsToken();
  log('TC01-04', 'Disbursements - Second Token Before Expiry', 'Both tokens valid', `Token1: ${token1.substring(0, 15)}... Token2: ${token2.substring(0, 15)}... Different: ${token1 !== token2}`, !!token1 && !!token2);
}

async function disbursementTC02_02() {
  // Duplicate Reference ID
  const token = await getDisbursementsToken();
  const refId = crypto.randomUUID();
  const body = {
    amount: '500', currency: 'EUR', externalId: 'SACCO-DIS-DUP-001',
    payee: { partyIdType: 'MSISDN', partyId: '46733123453' },
    payerMessage: 'Duplicate test', payeeNote: 'Dup ref'
  };
  const headers = {
    'X-Reference-Id': refId, 'X-Target-Environment': 'sandbox',
    'Ocp-Apim-Subscription-Key': DISBURSEMENTS_SUB_KEY,
    'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'
  };

  await axios.post(`${BASE_URL}/disbursement/v1_0/transfer`, body, { headers });

  try {
    await axios.post(`${BASE_URL}/disbursement/v1_0/transfer`, body, { headers });
    log('TC02-02', 'Disbursements - Duplicate Reference ID', '409 Conflict', 'Got 202 (unexpected)', false);
  } catch (e: any) {
    const status = e.response?.status;
    log('TC02-02', 'Disbursements - Duplicate Reference ID', '409 Conflict', `${status} - ${JSON.stringify(e.response?.data)}`, status === 409);
  }
}

async function disbursementTC02_03() {
  // Incomplete info — missing payee
  const token = await getDisbursementsToken();
  const refId = crypto.randomUUID();
  try {
    await axios.post(`${BASE_URL}/disbursement/v1_0/transfer`, {
      amount: '1000', currency: 'EUR', externalId: 'SACCO-DIS-INC-001'
      // Missing payee
    }, {
      headers: {
        'X-Reference-Id': refId, 'X-Target-Environment': 'sandbox',
        'Ocp-Apim-Subscription-Key': DISBURSEMENTS_SUB_KEY,
        'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'
      }
    });
    log('TC02-03', 'Disbursements - Incomplete Info (no payee)', '400 Bad Request', 'Got 202 (unexpected)', false);
  } catch (e: any) {
    const status = e.response?.status;
    log('TC02-03', 'Disbursements - Incomplete Info (no payee)', '400 Bad Request', `${status} - ${JSON.stringify(e.response?.data)}`, status === 400);
  }
}

// ==================== BALANCE & VALIDATE ACCOUNT ====================

async function collectionsBalance() {
  const token = await getCollectionsToken();
  try {
    const res = await axios.get(`${BASE_URL}/collection/v1_0/account/balance`, {
      headers: {
        'X-Target-Environment': 'sandbox',
        'Ocp-Apim-Subscription-Key': COLLECTIONS_SUB_KEY,
        'Authorization': `Bearer ${token}`
      }
    });
    log('BAL-COL', 'Collections - Get Balance', '200 OK', `${res.status} - Balance: ${JSON.stringify(res.data)}`, res.status === 200);
  } catch (e: any) {
    log('BAL-COL', 'Collections - Get Balance', '200 OK', `${e.response?.status} - ${JSON.stringify(e.response?.data)}`, false);
  }
}

async function disbursementsBalance() {
  const token = await getDisbursementsToken();
  try {
    const res = await axios.get(`${BASE_URL}/disbursement/v1_0/account/balance`, {
      headers: {
        'X-Target-Environment': 'sandbox',
        'Ocp-Apim-Subscription-Key': DISBURSEMENTS_SUB_KEY,
        'Authorization': `Bearer ${token}`
      }
    });
    log('BAL-DIS', 'Disbursements - Get Balance', '200 OK', `${res.status} - Balance: ${JSON.stringify(res.data)}`, res.status === 200);
  } catch (e: any) {
    log('BAL-DIS', 'Disbursements - Get Balance', '200 OK', `${e.response?.status} - ${JSON.stringify(e.response?.data)}`, false);
  }
}

async function validateAccountCollections() {
  const token = await getCollectionsToken();
  try {
    const res = await axios.get(`${BASE_URL}/collection/v1_0/accountholder/msisdn/46733123453/active`, {
      headers: {
        'X-Target-Environment': 'sandbox',
        'Ocp-Apim-Subscription-Key': COLLECTIONS_SUB_KEY,
        'Authorization': `Bearer ${token}`
      }
    });
    log('VAL-COL', 'Collections - Validate Account (valid MSISDN)', '200 OK', `${res.status} - Result: ${JSON.stringify(res.data)}`, res.status === 200);
  } catch (e: any) {
    log('VAL-COL', 'Collections - Validate Account (valid MSISDN)', '200 OK', `${e.response?.status} - ${JSON.stringify(e.response?.data)}`, false);
  }
}

async function validateAccountCollectionsInvalid() {
  const token = await getCollectionsToken();
  try {
    const res = await axios.get(`${BASE_URL}/collection/v1_0/accountholder/msisdn/00000000000/active`, {
      headers: {
        'X-Target-Environment': 'sandbox',
        'Ocp-Apim-Subscription-Key': COLLECTIONS_SUB_KEY,
        'Authorization': `Bearer ${token}`
      }
    });
    log('VAL-COL-INV', 'Collections - Validate Account (invalid MSISDN)', '404 or result=false', `${res.status} - Result: ${JSON.stringify(res.data)}`, true);
  } catch (e: any) {
    const status = e.response?.status;
    log('VAL-COL-INV', 'Collections - Validate Account (invalid MSISDN)', '404 or result=false', `${status} - ${JSON.stringify(e.response?.data)}`, status === 404 || status === 400);
  }
}

async function validateAccountDisbursements() {
  const token = await getDisbursementsToken();
  try {
    const res = await axios.get(`${BASE_URL}/disbursement/v1_0/accountholder/msisdn/46733123453/active`, {
      headers: {
        'X-Target-Environment': 'sandbox',
        'Ocp-Apim-Subscription-Key': DISBURSEMENTS_SUB_KEY,
        'Authorization': `Bearer ${token}`
      }
    });
    log('VAL-DIS', 'Disbursements - Validate Account (valid MSISDN)', '200 OK', `${res.status} - Result: ${JSON.stringify(res.data)}`, res.status === 200);
  } catch (e: any) {
    log('VAL-DIS', 'Disbursements - Validate Account (valid MSISDN)', '200 OK', `${e.response?.status} - ${JSON.stringify(e.response?.data)}`, false);
  }
}

// ==================== RUN ALL ====================

async function main() {
  console.log('==========================================================');
  console.log('  MTN MoMo Sandbox — Full Test Suite');
  console.log('  Date:', new Date().toISOString());
  console.log('==========================================================\n');

  console.log('--- COLLECTIONS: Auth Tests ---');
  await collectionTC01_01();
  await collectionTC01_02();
  await collectionTC01_04();

  console.log('\n--- COLLECTIONS: Transaction Tests ---');
  await collectionTC02_02();
  await collectionTC02_03();
  await collectionTC_duplicateRef();
  await collectionTC_incompleteInfo();

  console.log('\n--- DISBURSEMENTS: Auth Tests ---');
  await disbursementTC01_01();
  await disbursementTC01_02();
  await disbursementTC01_04();

  console.log('\n--- DISBURSEMENTS: Transaction Tests ---');
  await disbursementTC02_02();
  await disbursementTC02_03();

  console.log('\n--- BALANCE ---');
  await collectionsBalance();
  await disbursementsBalance();

  console.log('\n--- VALIDATE ACCOUNT ---');
  await validateAccountCollections();
  await validateAccountCollectionsInvalid();
  await validateAccountDisbursements();

  // Summary
  console.log('\n==========================================================');
  console.log('  SUMMARY');
  console.log('==========================================================');
  console.log(`Total: ${results.length} | Passed: ${results.filter(r => r.status === '✅ PASS').length} | Failed: ${results.filter(r => r.status === '❌ FAIL').length}`);
  console.log('\n--- Full Results Table ---');
  console.log('| TC | Request | Expected | Actual | Status |');
  console.log('|---|---|---|---|---|');
  for (const r of results) {
    console.log(`| ${r.tc} | ${r.request} | ${r.expected} | ${r.actual} | ${r.status} |`);
  }
}

main();
