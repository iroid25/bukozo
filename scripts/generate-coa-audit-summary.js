const fs = require('fs');
const path = require('path');

const inputPath = path.join(process.cwd(), 'parsed_accounts.json');
const outputPath = path.join(process.cwd(), 'progress', 'coa-audit-summary.md');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNumericCode(rawCode) {
  const trimmed = String(rawCode || '').trim();
  const match = trimmed.match(/^(\d{3,6})\b/);
  return match ? match[1] : null;
}

function inferLedgerType(code) {
  if (!code) return 'REVIEW';
  const first = code[0];
  if (first === '1') return 'ASSETS';
  if (first === '2') return 'LIABILITIES';
  if (first === '3') return 'EQUITY';
  if (first === '4') return 'INCOME';
  if (first === '5') return 'EXPENDITURES';
  return 'REVIEW';
}

function classifyRow(row) {
  const rawCode = String(row.accountCode || '').trim();
  const code = extractNumericCode(rawCode);
  const name = String(rawCode).replace(/^\d+\s+/, '').trim();

  if (!code) {
    return {
      kind: 'noise',
      action: 'archive',
      reason: 'non-numeric or malformed code',
      target: 'review',
    };
  }

  return {
    kind: 'coa',
    action: 'keep',
    reason: 'numeric account code aligns with SACCO pillar structure',
    target: inferLedgerType(code),
  };
}

function buildReport(rows) {
  const classified = rows.map((row) => {
    const parsed = classifyRow(row);
    return {
      ...row,
      parsedCode: extractNumericCode(row.accountCode),
      normalizedName: normalizeName(row.accountCode).replace(/^\d+\s+/, ''),
      ...parsed,
    };
  });

  const noise = classified.filter((row) => row.kind === 'noise');
  const coa = classified.filter((row) => row.kind === 'coa');

  const counts = coa.reduce((acc, row) => {
    acc[row.target] = (acc[row.target] || 0) + 1;
    return acc;
  }, {});

  const duplicateNames = new Map();
  for (const row of coa) {
    const key = normalizeName(String(row.accountCode).replace(/^\d+\s+/, ''));
    if (!duplicateNames.has(key)) duplicateNames.set(key, []);
    duplicateNames.get(key).push(row);
  }

  const duplicates = [...duplicateNames.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([name, items]) => ({ name, items }));

  const lines = [];
  lines.push('# COA Audit Summary');
  lines.push('');
  lines.push(`- Source file: \`parsed_accounts.json\``);
  lines.push(`- Total rows: ${rows.length}`);
  lines.push(`- Numeric COA rows: ${coa.length}`);
  lines.push(`- Noise / review rows: ${noise.length}`);
  lines.push('');
  lines.push('## Category Breakdown');
  lines.push('');
  lines.push(`- Assets: ${counts.ASSETS || 0}`);
  lines.push(`- Liabilities: ${counts.LIABILITIES || 0}`);
  lines.push(`- Equity: ${counts.EQUITY || 0}`);
  lines.push(`- Income: ${counts.INCOME || 0}`);
  lines.push(`- Expenditures: ${counts.EXPENDITURES || 0}`);
  lines.push('');
  lines.push('## Rows To Archive Or Review');
  lines.push('');
  if (noise.length === 0) {
    lines.push('- None');
  } else {
    for (const row of noise) {
      lines.push(`- \`${row.accountCode}\` -> archive (${row.reason})`);
    }
  }
  lines.push('');
  lines.push('## Duplicate Names');
  lines.push('');
  if (duplicates.length === 0) {
    lines.push('- None');
  } else {
    for (const dup of duplicates) {
      lines.push(`- ${dup.name}: ${dup.items.map((item) => item.accountCode).join(', ')}`);
    }
  }
  lines.push('');
  lines.push('## Next Move');
  lines.push('');
  lines.push('- Keep the numeric COA rows.');
  lines.push('- Archive the malformed header/import rows.');
  lines.push('- Reclassify any questionable but numeric rows during the live migration pass.');

  return lines.join('\n');
}

function main() {
  const rows = readJson(inputPath);
  const report = buildReport(rows);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, report + '\n', 'utf8');
  console.log(`Wrote ${outputPath}`);
}

main();
