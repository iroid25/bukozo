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
console.log(`Found ${files.length} report service files.`);

const analysis = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(libReportsDir, file);
  
  // check database access
  const usesDb = content.includes('db.') || content.includes('prisma.');
  
  // Look for telltale signs of mock/dummy data: large hardcoded arrays or strings
  const hasHardcodedData = content.includes('const mock') || 
                            content.includes('const dummy') || 
                            content.includes(' = [') && content.includes('{') && !usesDb && content.length > 2000;

  analysis.push({
    path: relPath,
    fullPath: file,
    usesDb,
    hasHardcodedData,
    size: fs.statSync(file).size
  });
});

fs.writeFileSync('D:\\projects\\bukonzemergency\\scratch\\lib_reports_analysis.json', JSON.stringify(analysis, null, 2));
console.log('Analysis written to scratch/lib_reports_analysis.json');
