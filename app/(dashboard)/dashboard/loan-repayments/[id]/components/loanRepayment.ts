export interface LoanRepayment {
  id: string;
  loanId: string;
  memberId: string;
  amount: number;
  handlerUserId: string;
  channel: string;
  mobileMoneyRef: string | null;
  repaymentDate: Date;
  handler: {
    id: string;
    name: string;
    role: string;
    email?: string;
  };
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

// Channel information helper
export function getChannelInfo(channel: string) {
  const channelMap = {
    Cash: {
      label: "Cash",
      icon: "💵",
      color: "bg-green-100 text-green-800",
    },
    "Mobile Money": {
      label: "Mobile Money",
      icon: "📱",
      color: "bg-blue-100 text-blue-800",
    },
    "Bank Transfer": {
      label: "Bank Transfer",
      icon: "🏦",
      color: "bg-purple-100 text-purple-800",
    },
    Check: {
      label: "Check",
      icon: "📄",
      color: "bg-orange-100 text-orange-800",
    },
  };

  return (
    channelMap[channel as keyof typeof channelMap] || {
      label: channel,
      icon: "💳",
      color: "bg-gray-100 text-gray-800",
    }
  );
}

// Format payment reference
export function formatPaymentReference(
  channel: string,
  mobileMoneyRef: string | null
) {
  if (channel === "Mobile Money" && mobileMoneyRef) {
    return mobileMoneyRef;
  }
  return `${channel.toUpperCase()}-${Date.now().toString().slice(-6)}`;
}

// Get loan status from balance
export function getLoanStatusFromBalance(
  outstandingBalance: number,
  dueDate: Date
) {
  const isOverdue = new Date() > new Date(dueDate);

  if (outstandingBalance <= 0) {
    return {
      label: "Fully Paid",
      icon: "✅",
      color: "bg-green-100 text-green-800",
    };
  }

  if (isOverdue) {
    return {
      label: "Overdue",
      icon: "⚠️",
      color: "bg-red-100 text-red-800",
    };
  }

  return {
    label: "Active",
    icon: "🔄",
    color: "bg-blue-100 text-blue-800",
  };
}

// Calculate repayment impact
export function calculateRepaymentImpact(
  paymentAmount: number,
  outstandingBalance: number
) {
  const newBalance = Math.max(0, outstandingBalance - paymentAmount);
  const overpayment = Math.max(0, paymentAmount - outstandingBalance);
  const isFullyPaid = newBalance === 0;
  const percentagePaid = (paymentAmount / outstandingBalance) * 100;

  return {
    newBalance,
    overpayment,
    isFullyPaid,
    percentagePaid: Math.min(percentagePaid, 100),
  };
}

// Get payment channel options
export function getPaymentChannelOptions() {
  return [
    { label: "Cash", value: "Cash" },
    { label: "Mobile Money", value: "Mobile Money" },
    { label: "Bank Transfer", value: "Bank Transfer" },
    { label: "Check", value: "Check" },
  ];
}
