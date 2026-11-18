import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizeInternationalPhone(value) {
  const parsed = parsePhoneNumberFromString(String(value || "").trim(), {
    extract: false,
  });
  return parsed?.isValid() ? parsed.number : null;
}
