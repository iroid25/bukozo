# Float & Reserve System Analysis

## 1. Operational Status
The Float and Reserve systems are **functionally active** and enforce operational rules (e.g., preventing overdrafts, tracking balances). Money moves logically between entities in the database.

However, there are specific **Role-Based Limitations** and **Financial Integration Gaps** you should be aware of.

## 2. Role-Based Functionality Review

### 🟢 Admin / Board
*   **Capabilities:** Full control over the Main Reserve (Vault).
*   **Actions:** Can `Propose Allocation` (with approval workflow) or `Direct Allocate` (immediate) to move funds between Vaults.
*   **Verdict:** **Working Well.** Admins have necessary power to fund branches.

### 🟢 Accountant
*   **Capabilities:** Primary controller of Teller Floats.
*   **Actions:** Can `Allocate Float` to Tellers/Agents.
*   **Verdict:** **Working Well**, assuming the Accountant is central to cash distribution.

### 🟡 Branch Manager
*   **Capabilities:** Limited.
*   **Issue:** The current logic (`actions/float.ts`) **strictly restricts Float Allocation to the `ACCOUNTANT` role**.
*   **Risk:** If your Branch Managers are expected to manage their own tellers' daily cash, **they currently cannot do this**. They would need to wait for an Accountant.
*   **Recommendation:** Update permissions to allow `BRANCH_MANAGER` to also allocate float within their own branch.

### 🟢 Teller / Agent
*   **Capabilities:** Receiver of funds.
*   **Actions:** Can request float (if UI exists), receive allocations, and perform transactions.
*   **Verdict:** **Working Well.** The system correctly updates their float balance and blocks cash transactions if balance is insufficient.

## 3. Financial Integration Gaps (Critical)
Just like the Deposits integration I fixed earlier, the Float/Reserve system is **disconnected from the General Ledger**.

1.  **Float Allocation:**
    *   *Operational:* Teller Float increases.
    *   *Financial:* No Journal Entry. The "Vault Cash" asset in the GL does not decrease.
    *   *Correction Needed:* Debit `Teller Cash`, Credit `Vault/Reserve Cash`.

2.  **Reserve Transfer:**
    *   *Operational:* Source Vault decreases, Target Vault increases.
    *   *Financial:* No Journal Entry.
    *   *Correction Needed:* Debit `Target Branch Cash`, Credit `Source Vault Cash`.

## Summary
*   **Logic:** Robust.
*   **Roles:** Too restrictive for Branch Managers.
*   **Accounting:** "Off-ledger" (needs integration).
