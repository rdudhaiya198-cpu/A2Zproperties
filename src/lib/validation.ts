export const normalizePhone = (value: string) => value.replace(/\D/g, "");

export const isValidPhone = (value: string) => {
  const digits = normalizePhone(value);
  return digits.length >= 10;
};

export const isValidEmail = (value: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};
