import { RelworxService } from '../services/relworx.service';

/**
 * This script tests the RelworxService implementation.
 * Run with: npx ts-node scripts/test-relworx.ts
 */
async function testRelworx() {
  console.log('--- Testing Relworx Service ---');

  // 1. Test MSISDN Formatting
  console.log('\n1. Testing MSISDN Formatting:');
  const phones = ['0701234567', '256701234567', '+256701234567'];
  phones.forEach(p => {
    const formatted = (RelworxService as any).formatMsisdn(p);
    console.log(`Input: ${p} -> Formatted: ${formatted}`);
  });

  // 2. Test Request Payment (Collection)
  console.log('\n2. Testing Request Payment (Collection):');
  const collectionParams = {
    msisdn: '256701234567',
    amount: 5000,
    reference: `TEST-COL-${Date.now()}`,
    description: 'Test Collection'
  };
  console.log('Params:', collectionParams);
  
  // Note: Will likely fail if API key is not set, but we want to see the error handled.
  const colResponse = await RelworxService.requestPayment(collectionParams);
  console.log('Response:', colResponse);

  // 3. Test Send Payment (Disbursement)
  console.log('\n3. Testing Send Payment (Disbursement):');
  const disbursementParams = {
    msisdn: '256701234567',
    amount: 1000,
    reference: `TEST-DISB-${Date.now()}`,
    description: 'Test Disbursement'
  };
  console.log('Params:', disbursementParams);
  const disbResponse = await RelworxService.sendPayment(disbursementParams);
  console.log('Response:', disbResponse);

  console.log('\n--- Test Complete ---');
}

testRelworx().catch(err => {
  console.error('Test Script failed:', err);
});
