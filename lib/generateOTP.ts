export function generateOTP(): string {
  // Generate a random number between 0 and 999999
  const otp = Math.floor(Math.random() * 1000000);

  // Convert to string and pad with leading zeros if necessary to ensure 6 digits
  return otp.toString().padStart(6, "0");
}
