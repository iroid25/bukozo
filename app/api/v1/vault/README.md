# Vault Management API

## Endpoints
- **GET** `/api/v1/vault` - Get vault
- **POST** `/api/v1/vault` - Initialize vault
- **POST** `/api/v1/vault/add-funds` - Add funds
- **POST** `/api/v1/vault/withdraw-funds` - Withdraw funds
- **POST** `/api/v1/vault/reconcile` - Reconcile
- **GET** `/api/v1/vault/reconcile` - Get reconciliations
- **GET** `/api/v1/vault/statistics` - Get statistics
- **GET** `/api/v1/vault/transactions` - Get transactions

## Authorization
Requires: ACCOUNTANT, ADMIN, or BRANCH_MANAGER

## Quick Test
```bash
curl -X POST http://localhost:3000/api/v1/vault
curl http://localhost:3000/api/v1/vault
```
