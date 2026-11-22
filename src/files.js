import { Linking, Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { buildIcs, icsFileName } from "./models.js";
import { getWebUrl } from "./apiConfig.js";

// Ticket PDF (server-rendered A4, FS-18) and event .ics (calendar export) on the phone:
// the file is saved to the app cache and handed to the system share sheet
// (Save to Files, Print, Calendar, Mail, ...).

async function share(file, mimeType, uti) {
  if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: file.name });
}

export async function shareTicketPdf(client, ticketId, lang) {
  const path = client.ticketPdfPath(ticketId, lang);
  if (Platform.OS === "web") {
    // browser preview: let the browser download it with the session token in a new tab is not possible;
    // fall back to the web app's ticket page
    const web = getWebUrl();
    if (web) await Linking.openURL(`${web}/tickets/${ticketId}`);
    return;
  }
  const token = await client.freshToken();
  const target = new File(Paths.cache, `biletflow-ticket-${String(ticketId).slice(0, 8)}.pdf`);
  try { if (target.exists) target.delete(); } catch { /* ignore */ }
  const file = await File.downloadFileAsync(client.url(path), target, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" },
    idempotent: true
  });
  if (!file.exists || !file.size) throw new Error("Empty PDF");
  await share(file, "application/pdf", "com.adobe.pdf");
}

export async function shareEventIcs(event) {
  const web = getWebUrl();
  const url = web ? `${web}/events/${event.id}` : `https://biletflow.kz/events/${event.id}`;
  const text = buildIcs(event, url);
  if (Platform.OS === "web") {
    const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = icsFileName(event.title);
    a.click();
    URL.revokeObjectURL(href);
    return;
  }
  const file = new File(Paths.cache, icsFileName(event.title));
  try { if (file.exists) file.delete(); } catch { /* ignore */ }
  file.write(text);
  await share(file, "text/calendar", "public.calendar-event");
}

/** Maps (web VenueMap): Google and Yandex deep links. */
export function mapLinks(venueName, venueAddress) {
  const q = encodeURIComponent([venueName, venueAddress].filter(Boolean).join(", "));
  if (!q) return null;
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    yandex: `https://yandex.kz/maps/?text=${q}`,
    native: Platform.OS === "ios" ? `maps:0,0?q=${q}` : `geo:0,0?q=${q}`
  };
}
