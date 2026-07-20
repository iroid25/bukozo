const AT_API_KEY = process.env.AFRICASTALKING_API_KEY;
const AT_USERNAME = process.env.AFRICASTALKING_USERNAME || "sandbox";
const AT_SENDER_ID = process.env.AFRICASTALKING_SENDER_ID || "";

export async function sendSMS(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!AT_API_KEY) {
    return { success: false, error: "SMS provider not configured" };
  }

  try {
    const params = new URLSearchParams();
    params.append("username", AT_USERNAME);
    params.append("to", phone);
    params.append("message", message);
    if (AT_SENDER_ID) params.append("from", AT_SENDER_ID);

    const res = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        apiKey: AT_API_KEY,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { success: false, error: `SMS API error ${res.status}: ${text}` };
    }

    const data = await res.json();
    const recipients: any[] = data?.SMSMessageData?.Recipients ?? [];
    const first = recipients[0];
    if (first && first.statusCode === 101) {
      return { success: true };
    }
    return { success: false, error: first?.status || "SMS delivery failed" };
  } catch (error: any) {
    return { success: false, error: error?.message || "SMS send failed" };
  }
}

export async function sendWithdrawalVerificationSMS(
  phone: string,
  memberName: string,
  verificationCode: string,
  amount: number,
): Promise<{ success: boolean; error?: string }> {
  const message = `Dear ${memberName}, your withdrawal verification code is: ${verificationCode}. Amount: UGX ${amount.toLocaleString()}. Valid for 10 minutes. Do not share this code. - Bukonzo Teachers SACCO`;
  return sendSMS(phone, message);
}

export async function sendWithdrawalSuccessSMS(
  phone: string,
  memberName: string,
  amount: number,
  newBalance: number,
): Promise<{ success: boolean; error?: string }> {
  const message = `Dear ${memberName}, your withdrawal of UGX ${amount.toLocaleString()} was successful. New balance: UGX ${newBalance.toLocaleString()}. - Bukonzo Teachers SACCO`;
  return sendSMS(phone, message);
}
