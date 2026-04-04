const WHATSAPP_BOOKING_NUMBER = "6353388626";

const toWaNumber = (raw: string) => {
  const digits = (raw || "").replace(/\D/g, "");
  const noLeadingZero = digits.replace(/^0+/, "");

  if (noLeadingZero.length === 10) return `91${noLeadingZero}`;
  if (noLeadingZero.length === 12 && noLeadingZero.startsWith("91")) return noLeadingZero;
  return noLeadingZero;
};

export interface WhatsAppBookingPayload {
  bookingId?: string;
  name: string;
  phone: string;
  date: string;
  slot: string;
  propertyTitles: string[];
  location?: string;
  caste?: string;
  charge?: number;
  brokerage?: number;
  total?: number;
  notes?: string;
}

export const buildBookingWhatsAppMessage = (payload: WhatsAppBookingPayload) => {
  const lines = [
    "New Booking Request",
    payload.bookingId ? `Booking ID: ${payload.bookingId}` : "",
    `Name: ${payload.name}`,
    `Phone: ${payload.phone}`,
    `Visit Date: ${payload.date}`,
    `Time Slot: ${payload.slot}`,
    payload.propertyTitles?.length > 0 ? `Properties: ${payload.propertyTitles.join(", ")}` : "Properties: -",
    payload.location ? `Location: ${payload.location}` : "",
    payload.caste ? `Caste/Community: ${payload.caste}` : "",
    typeof payload.charge === "number" ? `Visit Charge: Rs ${payload.charge}` : "",
    typeof payload.brokerage === "number" && payload.brokerage > 0 ? `Brokerage: Rs ${payload.brokerage}` : "",
    typeof payload.total === "number" ? `Total Payable: Rs ${payload.total}` : "",
    payload.notes ? `Notes: ${payload.notes}` : "",
  ].filter(Boolean);

  return lines.join("\n");
};

export const openBookingWhatsApp = (payload: WhatsAppBookingPayload) => {
  if (typeof window === "undefined") return false;
  const phone = toWaNumber(WHATSAPP_BOOKING_NUMBER);
  const text = encodeURIComponent(buildBookingWhatsAppMessage(payload));
  const url = `https://wa.me/${phone}?text=${text}`;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  return Boolean(opened);
};
