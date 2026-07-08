const fs = require('fs');

const data = JSON.parse(fs.readFileSync('D:\\projects\\bukonzemergency\\scratch\\lib_reports_analysis.json', 'utf8'));

console.log('--- REPORT SERVICE FILE ANALYSIS ---');
console.log(`Total Files Checked: ${data.length}`);

const noDb = data.filter(x => !x.usesDb);
const dbAndMock = data.filter(x => x.usesDb && x.hasHardcodedData);
const realDb = data.filter(x => x.usesDb && !x.hasHardcodedData);

console.log(`\nFiles NOT using DB (100% Mock/Static): ${noDb.length}`);
noDb.forEach(x => {
  console.log(` - ${x.path} (${x.size} bytes)`);
});

console.log(`\nFiles using DB but having hardcoded/mock checks (Partially Mocked or containing mock fallbacks): ${dbAndMock.length}`);
dbAndMock.forEach(x => {
  console.log(` - ${x.path} (${x.size} bytes)`);
});

console.log(`\nFiles using DB (Real Integration): ${realDb.length}`);
realDb.forEach(x => {
  console.log(` - ${x.path} (${x.size} bytes)`);
});
