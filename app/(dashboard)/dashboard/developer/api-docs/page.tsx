"use client";

import ApiDocViewer, { ApiCategory } from "@/components/developer/ApiDocViewer";

export default function ApiDocsPage() {
  const categories: ApiCategory[] = [
    {
      name: "Authentication",
      description: "Endpoints for user authentication and session management.",
      endpoints: [
        {
          method: "POST",
          path: "/api/auth/login",
          summary: "User Login",
          description: "Authenticate a user with email and password.",
          body: {
            email: "user@example.com",
            password: "password123"
          },
          response: {
            user: {
              id: "clq...",
              name: "John Doe",
              email: "user@example.com",
              role: "TELLER"
            },
            token: "eyJhbG..."
          }
        },
        {
            method: "GET",
            path: "/api/auth/session",
            summary: "Get Session",
            description: "Retrieve current user session.",
            response: {
                user: {
                    name: "John Doe",
                    email: "user@example.com",
                    image: null
                },
                expires: "2025-01-01T00:00:00.000Z"
            }
        },
        {
          method: "POST",
          path: "/api/v1/auth/change-password",
          summary: "Change Password",
          description: "Allow a logged-in user to change their password.",
          body: {
            currentPassword: "oldpassword123",
            newPassword: "newpassword456"
          },
          response: {
            success: true,
            message: "Password updated successfully"
          }
        }
      ]
    },
    {
      name: "Accounts",
      description: "Manage member and institution accounts.",
      endpoints: [
        {
          method: "GET",
          path: "/api/v1/accounts",
          summary: "List Accounts",
          description: "Get a list of all accounts. Supports filtering by branch.",
          params: [
            { name: "branchId", type: "string", required: false, description: "Filter by branch ID" }
          ],
          response: {
            data: [
              {
                id: "clq...",
                accountNumber: "ACC123456",
                balance: 50000,
                status: "ACTIVE",
                member: { name: "John Doe" },
                accountType: { name: "SAVINGS" }
              }
            ]
          }
        },
        {
          method: "POST",
          path: "/api/v1/accounts",
          summary: "Create Account",
          description: "Create a new account for a member or institution.",
          body: {
            memberId: "clq... (optional)",
            institutionId: "clq... (optional)",
            accountTypeId: "clq...",
            branchId: "clq...",
            initialDeposit: 10000
          },
          response: {
            data: {
              id: "clq...",
              accountNumber: "ACC837492",
              balance: 10000,
              status: "ACTIVE"
            },
            message: "Account created successfully"
          }
        }
      ]
    },
    {
        name: "Transactions",
        description: "Financial transactions including Deposits, Withdrawals, Income, and Expenditure.",
        endpoints: [
            {
                method: "GET",
                path: "/api/v1/transactions",
                summary: "List Transactions",
                description: "Get a paginated list of all transactions.",
                params: [
                    { name: "page", type: "number", required: false, description: "Page number (default 1)" },
                    { name: "limit", type: "number", required: false, description: "Items per page (default 20)" },
                    { name: "type", type: "string", required: false, description: "Filter by transaction type (DEPOSIT, WITHDRAWAL, etc)" }
                ],
                response: {
                    data: [],
                    meta: { total: 100, page: 1, lastPage: 5 }
                }
            },
            {
                method: "POST",
                path: "/api/v1/transactions/deposit",
                summary: "Create Deposit",
                description: "Record a new cash deposit.",
                body: {
                    accountId: "clq...",
                    amount: 50000,
                    depositorName: "John Doe",
                    phone: "0771234567"
                },
                response: {
                    success: true,
                    data: {
                        transactionRef: "TXN123456",
                        amount: 50000,
                        balanceAfter: 150000
                    }
                }
            },
            {
                method: "POST",
                path: "/api/v1/transactions/withdraw",
                summary: "Create Withdrawal",
                description: "Record a new withdrawal. Requires verification for large amounts.",
                body: {
                    accountId: "clq...",
                    amount: 20000,
                    withdrawerName: "John Doe"
                },
                response: {
                    success: true,
                    data: {
                        transactionRef: "TXN123457",
                        amount: 20000
                    }
                }
            },
            {
                method: "GET",
                path: "/api/v1/income",
                summary: "List Incomes",
                description: "Get recorded income entries. Supports date and branch filtering.",
                params: [
                    { name: "startDate", type: "string", required: false, description: "Filter by start date" },
                    { name: "endDate", type: "string", required: false, description: "Filter by end date" },
                    { name: "branchId", type: "string", required: false, description: "Filter by branch ID" }
                ],
                response: {
                    data: [
                        {
                            id: "clq...",
                            amount: 15000,
                            description: "Loan Processing Fee",
                            category: { name: "Fees" },
                            recordDate: "2024-05-20"
                        }
                    ]
                }
            },
            {
                method: "POST",
                path: "/api/v1/income",
                summary: "Record Income",
                description: "Manually record a new income entry.",
                body: {
                    categoryId: "clq...",
                    amount: 50000,
                    recordDate: "2024-05-20",
                    description: "Consultancy Fee",
                    branchId: "clq..."
                },
                response: {
                    success: true,
                    data: { id: "clq..." }
                }
            }
        ]
    },
    {
        name: "Expenditure",
        description: "Management of organizational costs and expenses.",
        endpoints: [
            {
                method: "GET",
                path: "/api/v1/expenditure",
                summary: "List Expenditures",
                description: "Retrieve all expenditure records with filtering support.",
                params: [
                    { name: "status", type: "string", required: false, description: "Filter by status (PENDING, COMPLETED, FAILED)" },
                    { name: "branchId", type: "string", required: false, description: "Filter by branch" }
                ],
                response: {
                    data: []
                }
            },
            {
                method: "POST",
                path: "/api/v1/expenditure",
                summary: "Record Expenditure",
                description: "Record a new expense entry.",
                body: {
                    categoryId: "clq...",
                    amount: 250000,
                    recordDate: "2024-05-20",
                    payee: "Office Supplies Ltd",
                    branchId: "clq...",
                    paymentMethod: "CASH"
                },
                response: {
                    success: true,
                    data: { id: "clq..." }
                }
            },
            {
                method: "GET",
                path: "/api/v1/expenditure/categories",
                summary: "List Categories",
                description: "Get hierarchical list of expenditure categories.",
                response: {
                    data: [
                        {
                            id: "clq...",
                            name: "Operations",
                            children: [{ id: "clq2...", name: "Rent" }]
                        }
                    ]
                }
            }
        ]
    },
    {
        name: "Fixed Assets",
        description: "Management of sacco physical assets and property.",
        endpoints: [
            {
                method: "GET",
                path: "/api/v1/fixed-assets",
                summary: "List Assets",
                description: "Get all registered assets.",
                response: {
                    data: [
                        {
                            id: "clq...",
                            name: "Office Desk",
                            quantity: 5,
                            purchaseDate: "2024-01-10",
                            valuation: 1500000
                        }
                    ]
                }
            },
            {
                method: "POST",
                path: "/api/v1/fixed-assets",
                summary: "Register Asset",
                description: "Register a new asset in the system.",
                body: {
                    name: "Laptop",
                    quantity: 1,
                    purchaseDate: "2024-05-20",
                    cost: 2500000,
                    description: "Admin Laptop",
                    branchId: "clq..."
                },
                response: {
                    success: true,
                    data: { id: "clq..." }
                }
            }
        ]
    },
    {
        name: "Loans",
        description: "Loan management endpoints.",
        endpoints: [
            {
                method: "GET",
                path: "/api/v1/loans/applications",
                summary: "List Applications",
                description: "Get all loan applications.",
                params: [
                    { name: "status", type: "string", required: false, description: "Filter by status (PENDING, APPROVED, REJECTED)" }
                ],
                response: {
                    data: []
                }
            },
            {
                method: "POST",
                path: "/api/v1/loans/apply",
                summary: "Submit Application",
                description: "Submit a new loan application for a member.",
                body: {
                    memberId: "clq...",
                    productId: "clq...",
                    amount: 1000000,
                    repaymentPeriod: 12,
                    purpose: "Business Expansion"
                },
                response: {
                    success: true,
                    message: "Application submitted successfully"
                }
            }
        ]
    },
    {
        name: "Members",
        description: "Member management endpoints.",
        endpoints: [
            {
                method: "GET",
                path: "/api/v1/members",
                summary: "List Members",
                description: "Get all registered members.",
                response: {
                    data: [
                        {
                            id: "clq...",
                            memberNumber: "MEM001",
                            user: { name: "Jane Doe" }
                        }
                    ]
                }
            },
            {
                method: "POST",
                path: "/api/v1/members",
                summary: "Register Member",
                description: "Register a new member.",
                body: {
                    firstName: "Jane",
                    lastName: "Doe",
                    email: "jane@example.com",
                    phone: "0701234567",
                    nin: "CM12345678"
                },
                response: {
                    success: true,
                    data: { memberNumber: "MEM002" }
                }
            },
            {
                method: "POST",
                path: "/api/v1/members/:id/approve",
                summary: "Approve Member",
                description: "Approve a pending member registration.",
                response: {
                    success: true,
                    message: "Member approved successfully"
                }
            }
        ]
    },
    {
        name: "Reports",
        description: "Financial and operational reports.",
        endpoints: [
            {
                method: "GET",
                path: "/api/v1/reports/financial/summary",
                summary: "Financial Summary",
                description: "Get high-level financial summary (Total Assets, Liabilities, Equity).",
                response: {
                    assets: 10000000,
                    liabilities: 5000000,
                    equity: 5000000
                }
            },
            {
                method: "GET",
                path: "/api/v1/reports/transactions/daily",
                summary: "Daily Transactions",
                description: "Get transaction volume and value for the current day.",
                response: {
                    date: "2024-05-20",
                    count: 45,
                    volume: 2500000
                }
            }
        ]
    }
  ];

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">API Documentation</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive reference for all available API endpoints in the system.
        </p>
      </div>
      
      <ApiDocViewer categories={categories} />
    </div>
  );
}
