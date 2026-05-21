export const VISIT_CHARGE = 200;
export const MAX_PROPERTIES_PER_VISIT = 3;
export const PHONE_NUMBER = "6353388626";
export const UPI_ID = "6353388626@amazonpay";
export const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbyplFjo_wcM_3yYOsTI07uQxrR7dPapOb8ttc-zSFdz1W48R0GLXui8aSbbHox1Y76y5Q/exec";

export const TIME_SLOTS_MORNING = [
  "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM"
];

export const TIME_SLOTS_EVENING = [
  "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
  "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM",
  "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM"
];

export const ALL_TIME_SLOTS = [...TIME_SLOTS_MORNING, ...TIME_SLOTS_EVENING];

export function formatPrice(price: number): string {
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)} Lac`;
  return `₹${price.toLocaleString("en-IN")}`;
}
