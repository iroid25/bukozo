const fs = require('fs');
const path = require('path');

const reportsDir = path.join(__dirname, '..', 'app', '(dashboard)', 'dashboard', 'loans', 'reports');

function processDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDir(fullPath);
    } else if (entry.name === 'page.tsx') {
      let content = fs.readFileSync(fullPath, 'utf-8');
      if (!content.includes('force-dynamic')) {
        // Insert force-dynamic before the export default
        content = content.replace(
          /export default/,
          'export const dynamic = "force-dynamic";\n\nexport default'
        );
        fs.writeFileSync(fullPath, content, 'utf-8');
        console.log('Updated:', path.relative(reportsDir, fullPath));
      } else {
        console.log('Skipped (already has):', path.relative(reportsDir, fullPath));
      }
    }
  }
}

processDir(reportsDir);
console.log('Done!');
