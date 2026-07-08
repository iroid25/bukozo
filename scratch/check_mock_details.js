const fs = require('fs');
const path = require('path');

const libReportsDir = 'D:\\projects\\bukonzemergency\\lib\\reports';

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getFiles(filePath, fileList);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts') && file !== 'index.ts' && !file.includes('types')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = getFiles(libReportsDir);
const reportDatabaseDetails = {};

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(libReportsDir, file);
  
  // Find all prisma db calls
  const dbCalls = [];
  const matches = content.match(/db\.[a-zA-Z0-9_]+/g);
  if (matches) {
    matches.forEach(m => {
      if (!dbCalls.includes(m)) dbCalls.push(m);
    });
  }
  
  // Also check if they return hardcoded mocks
  const mockMatches = content.match(/mock[a-zA-Z0-9_]*/gi) || [];
  const dummyMatches = content.match(/dummy[a-zA-Z0-9_]*/gi) || [];

  reportDatabaseDetails[relPath] = {
    dbCalls,
    mockReferences: mockMatches.length,
    dummyReferences: dummyMatches.length,
    size: fs.statSync(file).size
  };
});

fs.writeFileSync('D:\\projects\\bukonzemergency\\scratch\\report_db_details.json', JSON.stringify(reportDatabaseDetails, null, 2));
console.log('Done analysis of report DB queries!');
Object.entries(reportDatabaseDetails).forEach(([file, details]) => {
  console.log(`\n${file}:`);
  console.log(`  DB Calls: ${details.dbCalls.join(', ') || 'NONE'}`);
  console.log(`  Mocks/Dummies: ${details.mockReferences + details.dummyReferences}`);
});
