const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BASE_URL = 'https://sandbox.momodeveloper.mtn.com';

async function updateEnvFile(updates) {
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

async function updatePostmanCollection(updates) {
  const postmanPath = path.resolve(process.cwd(), 'momo_postman_collection.json');
  if (!fs.existsSync(postmanPath)) return;

  let collection = JSON.parse(fs.readFileSync(postmanPath, 'utf8'));
  if (collection.variable && Array.isArray(collection.variable)) {
    collection.variable = collection.variable.map((v) => {
      if (updates[v.key]) {
        return { ...v, value: updates[v.key] };
      }
      return v;
    });
  }
  fs.writeFileSync(postmanPath, JSON.stringify(collection, null, 2));
  console.log('Success: Postman collection updated.');
}

async function register(name, subKey) {
  console.log(`\n--- ${name} ---`);
  if (!subKey) { console.log('Missing sub key!'); return null; }
  const userId = crypto.randomUUID();
  console.log('User ID:', userId);
  try {
    await axios.post(`${BASE_URL}/v1_0/apiuser`, { providerCallbackHost: 'localhost' }, {
      headers: { 'X-Reference-Id': userId, 'Ocp-Apim-Subscription-Key': subKey, 'Content-Type': 'application/json' }
    });
    console.log('API User created');
    const r = await axios.post(`${BASE_URL}/v1_0/apiuser/${userId}/apikey`, {}, {
      headers: { 'Ocp-Apim-Subscription-Key': subKey }
    });
    console.log('API Key:', r.data.apiKey);
    const tokenProduct = name.toLowerCase().replace(/s$/, '');
    const auth = Buffer.from(`${userId}:${r.data.apiKey}`).toString('base64');
    await axios.post(`${BASE_URL}/${tokenProduct}/token/`, {}, {
      headers: { 'Authorization': `Basic ${auth}`, 'Ocp-Apim-Subscription-Key': subKey }
    });
    console.log('Token OK');
    return { userId, apiKey: r.data.apiKey };
  } catch (e) { console.log('Error:', e.response?.status, e.response?.data || e.message); return null; }
}

(async () => {
  const c = await register('Collections', process.env.MOMO_COLLECTIONS_SUB_KEY);
  const d = await register('Disbursements', process.env.MOMO_DISBURSEMENTS_SUB_KEY);
  
  if (!c && !d) return;

  const envUpdates = {};
  const postmanUpdates = {};

  if (c) {
    envUpdates['MOMO_COLLECTIONS_API_USER'] = c.userId;
    envUpdates['MOMO_COLLECTIONS_API_KEY'] = c.apiKey;
    postmanUpdates['collectionsApiUser'] = c.userId;
    postmanUpdates['collectionsApiKey'] = c.apiKey;
  }

  if (d) {
    envUpdates['MOMO_DISBURSEMENTS_API_USER'] = d.userId;
    envUpdates['MOMO_DISBURSEMENTS_API_KEY'] = d.apiKey;
    postmanUpdates['disbursementsApiUser'] = d.userId;
    postmanUpdates['disbursementsApiKey'] = d.apiKey;
  }

  console.log('\nStep 4: Persisting variables...');
  await updateEnvFile(envUpdates);
  await updatePostmanCollection(postmanUpdates);

  console.log('\n=== SETUP COMPLETE ===');
  console.log('Variables updated in .env and momo_postman_collection.json');
})();
