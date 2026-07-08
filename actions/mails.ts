"use server";

import { Statement } from "@/types/statements";
// import { Statement } from "@prisma/client";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
export async function sendStatement(
  statement: Statement,
  fileName: string,
  base64String: string,
) {
  try {
    const recipientEmail =
      statement.member?.user.email ||
      statement.institution?.institutionEmail ||
      null;
    const recipientName =
      statement.member?.user.name ||
      statement.institution?.institutionName ||
      "Customer";

    const recipients = ["iradtu22@gmail.com", recipientEmail].filter(
      (e): e is string => !!e,
    );
    const { data, error } = await resend.emails.send({
      from: "SACCO Statement <info@maripatechagency.com>",
      to: recipients,
      subject: `Your BUTSACCO Statement (${statement.startDate} to ${statement.endDate})`,
      text: `Dear ${recipientName},\n\nPlease find your account statement attached.\n\nBest regards,\nBUTSACCO Team`,
      attachments: [
        {
          filename: fileName,
          content: base64String,
        },
      ],
    });
    console.log(data);
    if (error) {
      return {
        success: false,
        error: "Failed to send",
      };
    }
    return {
      success: true,
      error: "",
    };
  } catch (error) {
    console.log(error);
    return {
      success: false,
      error: "Something went wrong",
    };
  }
}
