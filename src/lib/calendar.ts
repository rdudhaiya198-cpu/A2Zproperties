/**
 * Generate a Google Calendar event URL with a 1-hour reminder
 */
export function generateGoogleCalendarUrl(params: {
  title: string;
  date: string; // yyyy-MM-dd
  timeSlot: string; // e.g. "10:00 AM"
  description?: string;
  location?: string;
}): string {
  const { title, date, timeSlot, description, location } = params;

  // Parse time slot to 24h format
  const match = timeSlot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return "";

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3].toUpperCase();

  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  // Create start and end times (30 min visit)
  const startDate = new Date(`${date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
  const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

  const formatDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", title);
  url.searchParams.set("dates", `${formatDate(startDate)}/${formatDate(endDate)}`);
  if (description) url.searchParams.set("details", description);
  if (location) url.searchParams.set("location", location);
  // 1 hour reminder
  url.searchParams.set("crm", "DISPLAY:popup:60");

  return url.toString();
}

export function generateIcsEvent(params: {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
}): string {
  const { uid, title, start, end, description, location } = params;
  const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//AtoZProperties//EN\nCALSCALE:GREGORIAN\nBEGIN:VEVENT\nUID:${uid}\nSUMMARY:${title}\nDTSTAMP:${formatDate(new Date())}Z\nDTSTART:${formatDate(start)}Z\nDTEND:${formatDate(end)}Z\nDESCRIPTION:${(description || "").replace(/\n/g, '\\n')}\nLOCATION:${location || ""}\nBEGIN:VALARM\nTRIGGER:-PT30M\nACTION:DISPLAY\nDESCRIPTION:Reminder\nEND:VALARM\nEND:VEVENT\nEND:VCALENDAR`;
}
