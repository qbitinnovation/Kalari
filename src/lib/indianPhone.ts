export const INDIAN_MOBILE_ERROR = "Enter a valid 10-digit mobile number starting with 6-9.";

export const getIndianMobileDigits = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) return digits.slice(2, 12);
  return digits.slice(0, 10);
};

export const isValidIndianMobileDigits = (value: string) =>
  /^[6-9]\d{9}$/.test(getIndianMobileDigits(value));

export const formatIndianMobileForStorage = (value: string) => {
  const mobile = getIndianMobileDigits(value);
  if (!isValidIndianMobileDigits(mobile)) {
    throw new Error(INDIAN_MOBILE_ERROR);
  }
  return `+91${mobile}`;
};

export const formatIndianMobileDisplay = (value: string) => {
  const digits = getIndianMobileDigits(value);
  return digits ? `+91 ${digits}` : "";
};

export const getIndianMobileValidationError = (value: string, required = false) => {
  const digits = getIndianMobileDigits(value);
  if (!digits) return required ? "Mobile number is required." : "";
  if (!isValidIndianMobileDigits(digits)) return INDIAN_MOBILE_ERROR;
  return "";
};
