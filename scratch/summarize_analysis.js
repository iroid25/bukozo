const fs = require('fs');

const data = JSON.parse(fs.readFileSync('D:\\projects\\bukonzemergency\\scratch\\report_analysis.json', 'utf8'));

const apis = data.filter(x => x.type === 'API');
const pages = data.filter(x => x.type === 'Page');

console.log('--- API ROUTE ANALYSIS ---');
console.log(`Total APIs: ${apis.length}`);
const apisNoDb = apis.filter(x => !x.usesDb);
console.log(`APIs NOT using DB: ${apisNoDb.length}`);
apisNoDb.forEach(x => {
  console.log(` - ${x.path} (size: ${x.size} bytes)`);
});

console.log('\n--- PAGES ANALYSIS ---');
console.log(`Total Pages: ${pages.length}`);
const pagesNoFetchNoDb = pages.filter(x => !x.usesFetch && !x.usesDb);
console.log(`Pages NOT using Fetch or DB (likely static or client-side mock): ${pagesNoFetchNoDb.length}`);
pagesNoFetchNoDb.forEach(x => {
  console.log(` - ${x.path} (size: ${x.size} bytes)`);
});

console.log('\n--- PAGES WITH MOCK/DUMMY KEYWORDS ---');
const pagesWithMock = pages.filter(x => x.usesMockData);
console.log(`Pages containing mock/dummy: ${pagesWithMock.length}`);
pagesWithMock.forEach(x => {
  console.log(` - ${x.path}`);
});
