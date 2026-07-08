const fs = require('fs');
const path = require('path');

const reportsApiDir = 'D:\\projects\\bukonzemergency\\app\\api\\v1\\reports';
const reportsPageDir = 'D:\\projects\\bukonzemergency\\app\\(dashboard)\\dashboard\\reports';

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getFiles(filePath, fileList);
    } else if (file === 'route.ts' || file === 'route.js' || file === 'page.tsx') {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const apiFiles = getFiles(reportsApiDir);
const pageFiles = getFiles(reportsPageDir);

console.log(`Found ${apiFiles.length} API route files and ${pageFiles.length} page files.`);

const analysis = [];

apiFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(reportsApiDir, file);
  
  // check database access
  const usesDb = content.includes('db.') || content.includes('prisma.');
  
  // check for hardcoded arrays or strings that look like mock data
  const hasMockData = content.includes('const mock') || 
                      content.includes('const dummy') || 
                      (content.includes('return Response.json') && !usesDb) ||
                      (content.includes('return NextResponse.json') && !usesDb);

  // check if there is an empty handler or just static values
  const lines = content.split('\n');
  const size = fs.statSync(file).size;

  analysis.push({
    type: 'API',
    path: relPath,
    fullPath: file,
    usesDb,
    hasMockData,
    size
  });
});

pageFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(reportsPageDir, file);
  
  // check if page has no api call (doesn't use fetch)
  const usesFetch = content.includes('fetch(');
  const usesDb = content.includes('db.') || content.includes('prisma.');
  const usesMockData = content.includes('const mock') || content.includes('const dummy');

  analysis.push({
    type: 'Page',
    path: relPath,
    fullPath: file,
    usesFetch,
    usesDb,
    usesMockData,
    size: fs.statSync(file).size
  });
});

fs.writeFileSync('D:\\projects\\bukonzemergency\\scratch\\report_analysis.json', JSON.stringify(analysis, null, 2));
console.log('Analysis written to scratch/report_analysis.json');
