const fs = require('fs');
const path = require('path');

// Read report catalog
const catalogFile = 'D:\\projects\\bukonzemergency\\config\\report-catalog.ts';
let catalogContent = fs.readFileSync(catalogFile, 'utf8');

// Find where reportCatalog starts
const catalogStartIndex = catalogContent.indexOf('export const reportCatalog');
if (catalogStartIndex === -1) {
  console.error("Could not find reportCatalog in file.");
  process.exit(1);
}

// Slice content from reportCatalog definition
let arrayContent = catalogContent.slice(catalogStartIndex);
// Strip the reportBySlug export or any other trailing exports
arrayContent = arrayContent.replace(/export const reportBySlug[\s\S]*$/, '');

// Clean the type annotation e.g. ": ReportCategory[]"
arrayContent = arrayContent.replace(/:\s*ReportCategory\[\]\s*=/, '=');

// Clean the export keyword so it runs in eval
arrayContent = arrayContent.replace(/export\s+const/g, 'const');

const evalCode = `
const Shield = "Shield";
const Scale = "Scale";
const PiggyBank = "PiggyBank";
const PieChart = "PieChart";
const Archive = "Archive";
const ScrollText = "ScrollText";
const BookOpen = "BookOpen";
const Activity = "Activity";

${arrayContent}

reportCatalog;
`;

let reportCatalog = [];
try {
  reportCatalog = eval(evalCode);
} catch (e) {
  console.error("Eval failed: ", e);
  fs.writeFileSync('D:\\projects\\bukonzemergency\\scratch\\evalCode_error_debug.js', evalCode);
  console.log("Wrote debug file to evalCode_error_debug.js");
  process.exit(1);
}

console.log(`Loaded ${reportCatalog.length} categories.`);

// Check where each page route goes and what files implement it.
const results = [];

reportCatalog.forEach(cat => {
  const categoryInfo = {
    id: cat.id,
    title: cat.title,
    description: cat.description,
    reports: []
  };

  cat.reports.forEach(rep => {
    const reportInfo = {
      slug: rep.slug,
      title: rep.title,
      description: rep.description,
      href: rep.href,
      status: rep.status,
      pageFile: '',
      apiFile: '',
      generatorClass: '',
      generatorFile: '',
      prismaModels: [],
      error: ''
    };

    // 1. Locate the page route file
    let pageDir = rep.href.replace('/dashboard/reports', '');
    if (pageDir.startsWith('/')) pageDir = pageDir.slice(1);
    
    const possiblePaths = [
      path.join('D:\\projects\\bukonzemergency\\app\\(dashboard)\\dashboard\\reports', pageDir, 'page.tsx'),
      path.join('D:\\projects\\bukonzemergency\\app\\(dashboard)\\dashboard\\reports', path.dirname(pageDir), '[reportType]', 'page.tsx'),
      path.join('D:\\projects\\bukonzemergency\\app\\(dashboard)\\dashboard\\reports', path.dirname(pageDir), '[reportSlug]', 'page.tsx'),
      path.join('D:\\projects\\bukonzemergency\\app\\(dashboard)\\dashboard\\reports', pageDir + '.tsx')
    ];

    let foundPage = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        foundPage = p;
        break;
      }
    }
    reportInfo.pageFile = foundPage ? path.relative('D:\\projects\\bukonzemergency', foundPage) : 'NOT FOUND';

    // 2. Locate API Route and inspect its content for endpoints and generators
    if (foundPage && fs.existsSync(foundPage)) {
      const pageCode = fs.readFileSync(foundPage, 'utf8');
      
      // Look for fetch calls or endpoints
      const apiRegex = /\/api\/v1\/reports\/[^\s'`"]+/g;
      const apiMatches = pageCode.match(apiRegex);
      if (apiMatches && apiMatches.length > 0) {
        const apiPath = apiMatches[0].replace(/['"`]/g, '').split('?')[0].trim();
        reportInfo.apiFile = apiPath;
      }
    }

    // Fallback if not found in page code
    if (!reportInfo.apiFile) {
      const guessApiPath = path.join('D:\\projects\\bukonzemergency\\app\\api\\v1\\reports', pageDir, 'route.ts');
      if (fs.existsSync(guessApiPath)) {
        reportInfo.apiFile = `/api/v1/reports/${pageDir}`;
      } else {
        const guessCategoryPath = path.join('D:\\projects\\bukonzemergency\\app\\api\\v1\\reports', path.dirname(pageDir), 'route.ts');
        if (fs.existsSync(guessCategoryPath)) {
          reportInfo.apiFile = `/api/v1/reports/${path.dirname(pageDir)}`;
        }
      }
    }

    // Now resolve physical API file
    if (reportInfo.apiFile) {
      let relativeApi = reportInfo.apiFile.replace(/^\/api\//, 'app/api/');
      let apiPhysicalPath = path.join('D:\\projects\\bukonzemergency', relativeApi, 'route.ts');
      
      if (!fs.existsSync(apiPhysicalPath)) {
        const parts = relativeApi.split('/');
        parts[parts.length - 1] = '[reportType]';
        const tryPath = path.join('D:\\projects\\bukonzemergency', parts.join('/'), 'route.ts');
        if (fs.existsSync(tryPath)) {
          apiPhysicalPath = tryPath;
        }
      }
      if (!fs.existsSync(apiPhysicalPath)) {
        const parts = relativeApi.split('/');
        parts[parts.length - 1] = '[reportSlug]';
        const tryPath = path.join('D:\\projects\\bukonzemergency', parts.join('/'), 'route.ts');
        if (fs.existsSync(tryPath)) {
          apiPhysicalPath = tryPath;
        }
      }

      if (fs.existsSync(apiPhysicalPath)) {
        reportInfo.apiFilePath = path.relative('D:\\projects\\bukonzemergency', apiPhysicalPath);
        
        const apiCode = fs.readFileSync(apiPhysicalPath, 'utf8');
        const generatorMatches = apiCode.match(/(?:new\s+)([A-Z][A-Za-z0-9_]+Generator|[A-Z][A-Za-z0-9_]+Report)/g);
        if (generatorMatches && generatorMatches.length > 0) {
          const genName = generatorMatches[0].replace('new ', '').trim();
          reportInfo.generatorClass = genName;

          const importLines = apiCode.split('\n').filter(l => l.includes('import') && l.includes(genName));
          if (importLines.length > 0) {
            const pathMatch = importLines[0].match(/from\s+['"]([^'"]+)['"]/);
            if (pathMatch) {
              let importPath = pathMatch[1].replace('@/', '');
              const possibleGenPaths = [
                path.join('D:\\projects\\bukonzemergency', importPath + '.ts'),
                path.join('D:\\projects\\bukonzemergency', importPath, 'index.ts'),
                path.join('D:\\projects\\bukonzemergency\\lib\\reports', genName.replace('Generator', '').replace('Report', '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + '.ts'),
                path.join('D:\\projects\\bukonzemergency\\lib\\reports\\generators', genName.replace('Generator', '').replace('Report', '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + '.ts')
              ];

              let foundGen = '';
              for (const gp of possibleGenPaths) {
                if (fs.existsSync(gp)) {
                  foundGen = gp;
                  break;
                }
              }
              if (foundGen) {
                reportInfo.generatorFile = path.relative('D:\\projects\\bukonzemergency', foundGen);
              }
            }
          }

          if (!reportInfo.generatorFile) {
            const fileName = genName.replace('Generator', '').replace('Report', '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + '.ts';
            const tryPath1 = path.join('D:\\projects\\bukonzemergency\\lib\\reports\\generators', fileName);
            const tryPath2 = path.join('D:\\projects\\bukonzemergency\\lib\\reports', fileName);
            if (fs.existsSync(tryPath1)) {
              reportInfo.generatorFile = path.relative('D:\\projects\\bukonzemergency', tryPath1);
            } else if (fs.existsSync(tryPath2)) {
              reportInfo.generatorFile = path.relative('D:\\projects\\bukonzemergency', tryPath2);
            }
          }
        }
      } else {
        reportInfo.apiFilePath = 'ROUTE FILE NOT FOUND';
      }
    }

    // 3. Inspect the generator or api code for db calls to find Prisma Models
    const filesToScan = [];
    if (reportInfo.generatorFile) {
      filesToScan.push(path.join('D:\\projects\\bukonzemergency', reportInfo.generatorFile));
    }
    if (reportInfo.apiFilePath && reportInfo.apiFilePath !== 'ROUTE FILE NOT FOUND') {
      filesToScan.push(path.join('D:\\projects\\bukonzemergency', reportInfo.apiFilePath));
    }

    const dbModels = new Set();
    filesToScan.forEach(f => {
      if (fs.existsSync(f)) {
        const code = fs.readFileSync(f, 'utf8');
        const dbMatches = code.match(/db\.[a-zA-Z0-9_]+/g);
        if (dbMatches) {
          dbMatches.forEach(m => {
            const model = m.replace('db.', '');
            dbModels.add(model);
          });
        }
      }
    });
    reportInfo.prismaModels = Array.from(dbModels);

    categoryInfo.reports.push(reportInfo);
  });

  results.push(categoryInfo);
});

fs.writeFileSync('D:\\projects\\bukonzemergency\\scratch\\detailed_catalog_mapping.json', JSON.stringify(results, null, 2));
console.log("Detailed catalog mapping written successfully.");
