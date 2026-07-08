import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'https://sandbox.momodeveloper.mtn.com';

async function registerProduct(productName: string, subKey: string) {
  console.log(`\n--- Registering ${productName} ---`);
  
  if (!subKey) {
    console.error(`Error: MOMO_${productName.toUpperCase()}_SUB_KEY is missing in .env`);
    return null;
  }

  const userId = crypto.randomUUID();
  console.log(`Generated User ID: ${userId}`);

  try {
    // 1. Create API User
    console.log('Step 1: Creating API User...');
    await axios.post(
      `${BASE_URL}/v1_0/apiuser`,
      { providerCallbackHost: 'localhost' },
      {
        headers: {
          'X-Reference-Id': userId,
          'Ocp-Apim-Subscription-Key': subKey,
          'Content-Type': 'application/json',
        }
      }
    );
    console.log('Success: API User created.');

    // 2. Generate API Key
    console.log('Step 2: Generating API Key...');
    const apiKeyResponse = await axios.post(
      `${BASE_URL}/v1_0/apiuser/${userId}/apikey`,
      {},
      {
        headers: {
          'Ocp-Apim-Subscription-Key': subKey,
        }
      }
    );
    const apiKey = apiKeyResponse.data.apiKey;
    console.log(`Success: API Key generated: ${apiKey}`);

    // 3. Test Token
    console.log('Step 3: Testing Token acquisition...');
    const auth = Buffer.from(`${userId}:${apiKey}`).toString('base64');
    // MTN API uses singular product names: collection, disbursement
    const tokenProduct = productName.toLowerCase().replace(/s$/, '');
    const tokenResponse = await axios.post(
      `${BASE_URL}/${tokenProduct}/token/`,
      {},
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Ocp-Apim-Subscription-Key': subKey,
        }
      }
    );
    console.log('Success: Token acquired correctly.');

    return { userId, apiKey };
  } catch (error: any) {
    console.error(`Error registering ${productName}:`, error.response?.data || error.message);
    return null;
  }
}

async function updateEnvFile(updates: Record<string, string>) {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  let content = fs.readFileSync(envPath, 'utf8');
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}="${value}"`);
    } else {
      content += `\n${key}="${value}"`;
    }
  }
  fs.writeFileSync(envPath, content);
  console.log('Success: .env file updated.');
}

async function updatePostmanCollection(updates: Record<string, string>) {
  const postmanPath = path.resolve(process.cwd(), 'momo_postman_collection.json');
  if (!fs.existsSync(postmanPath)) return;

  let collection = JSON.parse(fs.readFileSync(postmanPath, 'utf8'));
  if (collection.variable && Array.isArray(collection.variable)) {
    collection.variable = collection.variable.map((v: any) => {
      if (updates[v.key]) {
        return { ...v, value: updates[v.key] };
      }
      return v;
    });
  }
  fs.writeFileSync(postmanPath, JSON.stringify(collection, null, 2));
  console.log('Success: Postman collection updated.');
}

async function run() {
  const collections = await registerProduct('Collections', process.env.MOMO_COLLECTIONS_SUB_KEY!);
  const disbursements = await registerProduct('Disbursements', process.env.MOMO_DISBURSEMENTS_SUB_KEY!);

  if (!collections && !disbursements) {
    console.log('\nNothing was registered. Please check your Subscription Keys in .env');
    return;
  }

  const envUpdates: Record<string, string> = {};
  const postmanUpdates: Record<string, string> = {};

  if (collections) {
    envUpdates['MOMO_COLLECTIONS_API_USER'] = collections.userId;
    envUpdates['MOMO_COLLECTIONS_API_KEY'] = collections.apiKey;
    postmanUpdates['collectionsApiUser'] = collections.userId;
    postmanUpdates['collectionsApiKey'] = collections.apiKey;
  }

  if (disbursements) {
    envUpdates['MOMO_DISBURSEMENTS_API_USER'] = disbursements.userId;
    envUpdates['MOMO_DISBURSEMENTS_API_KEY'] = disbursements.apiKey;
    postmanUpdates['disbursementsApiUser'] = disbursements.userId;
    postmanUpdates['disbursementsApiKey'] = disbursements.apiKey;
  }

  console.log('\nStep 4: Persisting variables...');
  await updateEnvFile(envUpdates);
  await updatePostmanCollection(postmanUpdates);

  console.log('\n--- SETUP COMPLETE ---');
  console.log('Variables updated in .env and momo_postman_collection.json');
}

run();
