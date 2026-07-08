const fs = require('fs');

const data = JSON.parse(fs.readFileSync('chart_data.json', 'utf8'));

// Find header row
let headerRowIndex = -1;
for (let i = 0; i < data.length; i++) {
  const row = data[i];
  if (row.some(cell => cell && cell.toString().includes('GL A/C No'))) {
    headerRowIndex = i;
    break;
  }
}

console.log('Header row index:', headerRowIndex);
console.log('Header:', data[headerRowIndex].filter(c => c).join(' | '));

// Get actual data rows (skip empty rows)
const dataRows = [];
for (let i = headerRowIndex + 1; i < data.length; i++) {
  const row = data[i];
  // Check if row has meaningful data (account number or name)
  if (row[0] || row[1] || row[3] || row[6]) {
    const accountCode = (row[0] || row[1] || row[3] || '').toString().trim();
    const accountName = (row[6] || '').toString().trim();
    const ledgerType = (row[13] || '').toString().trim();
    const product = (row[16] || row[17] || '').toString().trim();
    const debitCredit = (row[20] || row[22] || '').toString().trim();
    const currency = (row[27] || row[28] || '').toString().trim();
    
    if (accountCode || accountName) {
      dataRows.push({
        accountCode,
        accountName,
        ledgerType,
        product,
        debitCredit,
        currency
      });
    }
  }
}

console.log('\nTotal accounts found:', dataRows.length);
console.log('\nFirst 30 accounts:');
dataRows.slice(0, 30).forEach((acc, idx) => {
  console.log(`${idx + 1}. ${acc.accountCode} | ${acc.accountName} | ${acc.ledgerType} | ${acc.product}`);
});

// Save parsed data
fs.writeFileSync('parsed_accounts.json', JSON.stringify(dataRows, null, 2));
console.log('\nSaved to parsed_accounts.json');
