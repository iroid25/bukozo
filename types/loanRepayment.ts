// types/loanRepayment.ts

export interface LoanRepayment {
  id: string;
  loanId: string;
  loan: {
    id: string;
    amountGranted: number;
    totalAmountDue: number;
    outstandingBalance: number;
    dueDate: Date;
    member: {
      id: string;
      memberNumber: string;
      user: {
        name: string;
        email: string;
        phone: string | null;
        image: string | null;
      };
    };
    loanApplication: {
      loanProduct: {
        name: string;
        interestRate: number;
      };
    };
  };
  memberId: string;
  member: {
    id: string;
    memberNumber: string;
    user: {
      name: string;
      email: string;
      phone: string | null;
      image: string | null;
    };
  };
  amount: number;
  repaymentDate: Date;
  handlerUserId: string;
  handler: {
    id: string;
    name: string;
    role: string;
  };
  channel: string;
  mobileMoneyRef: string | null;
  interestPaid: number;
  principalPaid: number;
  penaltyPaid: number;
}

export interface LoanRepaymentCreateDTO {
  loanId: string;
  amount: number;
  channel: string;
  mobileMoneyRef?: string;
}

export interface LoanRepaymentUpdateDTO {
  id: string;
  amount?: number;
  channel?: string;
  mobileMoneyRef?: string;
}

// Helper function to get channel display info
export const getChannelInfo = (channel: string) => {
  const channelConfig: Record<
    string,
    {
      label: string;
      color: string;
      icon: string;
      description: string;
    }
  > = {
    Cash: {
      label: "Cash",
      color: "bg-green-100 text-green-800",
      icon: "💵",
      description: "Cash payment",
    },
    "Mobile Money": {
      label: "Mobile Money",
      color: "bg-blue-100 text-blue-800",
      icon: "📱",
      description: "Mobile money transfer",
    },
    "Bank Transfer": {
      label: "Bank Transfer",
      color: "bg-purple-100 text-purple-800",
      icon: "🏦",
      description: "Bank transfer",
    },
    Check: {
      label: "Check",
      color: "bg-orange-100 text-orange-800",
      icon: "📋",
      description: "Check payment",
    },
  };

  return (
    channelConfig[channel] || {
      label: channel,
      color: "bg-gray-100 text-gray-800",
      icon: "💳",
      description: "Other payment method",
    }
  );
};

// Helper function to calculate repayment impact
export const calculateRepaymentImpact = (
  repaymentAmount: number,
  outstandingBalance: number
) => {
  const newBalance = Math.max(0, outstandingBalance - repaymentAmount);
  const percentagePaid =
    ((outstandingBalance - newBalance) / outstandingBalance) * 100;
  const isFullyPaid = newBalance === 0;

  return {
    newBalance,
    percentagePaid,
    isFullyPaid,
    overpayment:
      repaymentAmount > outstandingBalance
        ? repaymentAmount - outstandingBalance
        : 0,
  };
};

// Get payment channel options for forms
export const getPaymentChannelOptions = () => [
  { label: "Cash", value: "Cash" },
  { label: "Mobile Money", value: "Mobile Money" },
  { label: "Bank Transfer", value: "Bank Transfer" },
  { label: "Check", value: "Check" },
];

// Helper function to format payment reference
export const formatPaymentReference = (
  channel: string,
  mobileMoneyRef?: string | null
) => {
  if (channel === "Mobile Money" && mobileMoneyRef) {
    return `MM: ${mobileMoneyRef}`;
  }
  return channel;
};

// Helper function to get loan status based on repayments
export const getLoanStatusFromBalance = (
  outstandingBalance: number,
  dueDate: Date
) => {
  if (outstandingBalance <= 0) {
    return {
      status: "REPAID",
      label: "Fully Repaid",
      color: "bg-green-100 text-green-800",
      icon: "✅",
    };
  }

  const now = new Date();
  const isOverdue = now > dueDate;

  if (isOverdue) {
    return {
      status: "OVERDUE",
      label: "Overdue",
      color: "bg-red-100 text-red-800",
      icon: "⚠️",
    };
  }

  return {
    status: "ACTIVE",
    label: "Active",
    color: "bg-blue-100 text-blue-800",
    icon: "💰",
  };
};
