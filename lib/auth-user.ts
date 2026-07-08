import { db } from "@/prisma/db";

type SessionLikeUser = {
  id?: string | null;
  email?: string | null;
  phone?: string | null;
};

export async function resolveAuthenticatedUser(sessionUser: SessionLikeUser) {
  if (sessionUser.id) {
    const byId = await db.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        member: true,
      },
    });

    if (byId) {
      return byId;
    }

    const byMemberId = await db.member.findUnique({
      where: { id: sessionUser.id },
      include: {
        user: {
          include: {
            member: true,
          },
        },
      },
    });

    if (byMemberId?.user) {
      return byMemberId.user;
    }
  }

  const email = sessionUser.email?.trim();
  const normalizedEmail = email?.toLowerCase();
  const phone = sessionUser.phone?.trim();
  const normalizedPhone = phone?.replace(/\D/g, "");
  const phoneTail = normalizedPhone && normalizedPhone.length >= 9
    ? normalizedPhone.slice(-9)
    : normalizedPhone;

  if (!email && !phone) {
    return null;
  }

  return db.user.findFirst({
    where: {
      OR: [
        ...(email
          ? [
              { email },
              ...(normalizedEmail && normalizedEmail !== email
                ? [{ email: normalizedEmail }]
                : []),
              { email: { contains: email } },
              ...(normalizedEmail && normalizedEmail !== email
                ? [{ email: { contains: normalizedEmail } }]
                : []),
            ]
          : []),
        ...(phone
          ? [
              { phone },
              ...(normalizedPhone ? [{ phone: { contains: normalizedPhone } }] : []),
              ...(phoneTail ? [{ phone: { contains: phoneTail } }] : []),
            ]
          : []),
      ],
    },
    include: {
      member: true,
    },
  });
}
