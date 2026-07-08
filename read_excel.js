const XLSX = require('xlsx');
const fs = require('fs');

try {
  const workbook = XLSX.readFile('CHART OF ACCOUNTS.xls');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  // Write to file
  fs.writeFileSync('chart_data.json', JSON.stringify(data, null, 2));
  console.log('Successfully converted Excel to JSON');
  console.log('Total rows:', data.length);
  
  // Print first 30 rows
  console.log('\nFirst 30 rows:');
  data.slice(0, 30).forEach((row, idx) => {
    console.log(`Row ${idx}:`, row);
  });
} catch (error) {
  console.error('Error:', error.message);
}
