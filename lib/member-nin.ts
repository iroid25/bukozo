import { Gender } from "@prisma/client";
import { normalizeNin } from "@/lib/identity";

export function normalizeMemberNin(value?: string | null): string | null {
  const normalized = normalizeNin(value);
  if (!normalized) return null;
  return normalized.slice(0, 14);
}

export function getMemberNinPrefix(
  dateOfBirth?: string | Date | null,
  gender?: Gender | string | null,
): string | null {
  if (!dateOfBirth || !gender) return null;

  const parsedDate = new Date(dateOfBirth);
  if (Number.isNaN(parsedDate.getTime())) return null;

  const yearSuffix = String(parsedDate.getFullYear()).slice(-2);
  const genderPrefix =
    gender === Gender.FEMALE || gender === "FEMALE"
      ? "CF"
      : gender === Gender.MALE || gender === "MALE"
        ? "CM"
        : null;

  return genderPrefix ? `${genderPrefix}${yearSuffix}` : null;
}

export function isMemberNinPrefixValid(
  nin?: string | null,
  dateOfBirth?: string | Date | null,
  gender?: Gender | string | null,
): boolean {
  const normalizedNin = normalizeMemberNin(nin);
  const expectedPrefix = getMemberNinPrefix(dateOfBirth, gender);

  if (!normalizedNin || !expectedPrefix) return false;

  return normalizedNin.startsWith(expectedPrefix);
}
