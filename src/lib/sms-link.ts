export function buildOwnerSmsUrl(
  contactPhone: string,
  publicId: string
): string {
  const body = `Hi, this is about Starlink rental ${publicId}`;
  return `sms:${contactPhone}?&body=${encodeURIComponent(body)}`;
}

// Plain-text blurb appended to renter emails — emails have no HTML, so both
// a human-readable number and the raw sms: link are included; some clients
// auto-linkify the sms: URI, some don't, but the number always works.
export function textOwnerEmailBlurb(
  contactPhone: string | null,
  publicId: string
): string {
  if (!contactPhone) return "";
  return `\n\nQuestions? Text us and mention your code ${publicId}: ${buildOwnerSmsUrl(contactPhone, publicId)}`;
}
