# COA Audit Summary

- Source file: `parsed_accounts.json`
- Total rows: 345
- Numeric COA rows: 338
- Noise / review rows: 7

## Category Breakdown

- Assets: 71
- Liabilities: 18
- Equity: 15
- Income: 50
- Expenditures: 184

## Rows To Archive Or Review

- `GL A/C No.` -> archive (non-numeric or malformed code)
- `<info@maripatechagency.com>0  INTEREST ON LOANS` -> archive (non-numeric or malformed code)
- `GL A/C No.` -> archive (non-numeric or malformed code)
- `GL A/C No.` -> archive (non-numeric or malformed code)
- `GL A/C No.` -> archive (non-numeric or malformed code)
- `GL A/C No.` -> archive (non-numeric or malformed code)
- `Total: 337` -> archive (non-numeric or malformed code)

## Duplicate Names

- None

## Next Move

- Keep the numeric COA rows.
- Archive the malformed header/import rows.
- Reclassify any questionable but numeric rows during the live migration pass.
