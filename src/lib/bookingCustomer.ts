import {
  formatIndianMobileForStorage,
  getIndianMobileValidationError,
  isValidIndianMobileDigits,
} from "@/lib/indianPhone";

export const BOOKING_NAME_REQUIRED = "Customer name is required.";

export const getBookingNameError = (name: string) =>
  !String(name || "").trim() ? BOOKING_NAME_REQUIRED : "";

export const getBookingEmailError = (email: string) => {
  const value = String(email || "").trim();
  if (!value) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address.";
  return "";
};

export const getBookingPhoneError = (phone: string, required = true) =>
  getIndianMobileValidationError(phone, required);

export const normalizeBookingPhone = (phone: string) => formatIndianMobileForStorage(phone);

export const isValidBookingPhoneDigits = (phone: string) => isValidIndianMobileDigits(phone);

export const getBookingCustomerErrors = (input: {
  name: string;
  phone: string;
  email?: string;
}) => ({
  name: getBookingNameError(input.name),
  phone: getBookingPhoneError(input.phone, true),
  email: getBookingEmailError(input.email || ""),
});

export const hasBookingCustomerErrors = (errors: ReturnType<typeof getBookingCustomerErrors>) =>
  Boolean(errors.name || errors.phone || errors.email);
