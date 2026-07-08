# System Functionality by Role

**Version:** 1.1
**Updated:** March 2026

| Role | Core Responsibilities | Specific Functionalities |
|:---|:---|:---|
| **SYSTEM ADMINISTRATOR** | Full System Control | - Create/Manage Users & Assign Roles<br>- Configure System Settings (Organization, Branches)<br>- Manage Loan Products & Interest Rates<br>- Audit Log Access<br>- Bulk Account Import<br>- Override all restricted actions |
| **BRANCH MANAGER** | Branch Operations | - Approve Loan Applications<br>- Allocate Float to Tellers<br>- Reconcile Vaults<br>- View Branch Performance Reports<br>- Manage Branch Staff<br>- Approve large transactions (over limit) |
| **LOAN_OFFICER** | Credit Management | - Onboard New Members (KYC)<br>- Analyze Loan Applications (Individual & Institution)<br>- **Search & Link Guarantors** via real-time member search<br>- Conduct Field Visits<br>- Manage Guarantors & Collateral<br>- **Manage Account Holds**: Sort, Filter, and Export active restrictions.<br>- Monitor Portfolio at Risk (PAR)<br>- **Generate Loan Reports**: Ledger Cards, Repayment Schedules, Disbursement Reports |
| **TELLER / AGENT** | Cash Operations | - Process Cash Deposits & Withdrawals<br>- Process Mobile Money transactions<br>- **Verify Institution Signatories** (New validation)<br>- **Disburse Loans** to member's Voluntary Savings Account<br>- Balance Daily Float<br>- View Member Balances (Read-only) |
| **ACCOUNTANT** | Financial Reporting | - Manage Chart of Accounts<br>- Post Journal Entries<br>- Process Expenses & Incomes<br>- Generate Financial Statements (BS, PL)<br>- Reconcile Bank Statements |
| **MEMBER / INSTITUTION** | End User | - View Account Balances<br>- Apply for Loans (Portal)<br>- View Transaction History<br>- Receive Notifications (SMS/Email) |


## 🔑 Access Control Matrix (Key Modules)

| Module | Admin | Manager | Loan Officer | Teller | Accountant |
|:---|:---:|:---:|:---:|:---:|:---:|
| **User Mgmt** | ✅ | ⚠️ (Branch) | ❌ | ❌ | ❌ |
| **Create Account** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Approve Loan** | ✅ | ✅ | ⚠️ (Analysis) | ❌ | ❌ |
| **Disburse Loan** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Withdraw Cash** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Place Holds** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Reports** | ✅ | ✅ | ⚠️ (Own) | ❌ | ✅ |
| **Accounting** | ✅ | ❌ | ❌ | ❌ | ✅ |

*(Key: ✅ Full Access, ⚠️ Partial/Restricted, ❌ No Access)*
