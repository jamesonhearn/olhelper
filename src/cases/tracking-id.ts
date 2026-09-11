const trackingIdPattern = /\bTrackingID#(\d{16,19})(?!\d)/i;

export function extractTrackingId(subject: string): string | null {
  const match = trackingIdPattern.exec(subject);
  return match?.[1] ?? null;
}

export function trackingToken(trackingId: string): string {
  return `TrackingID#${trackingId}`;
}

export function caseFolderName(trackingId: string): string {
  if (!/^\d{16,19}$/.test(trackingId)) {
    throw new Error("Tracking ID must contain 16 to 19 digits.");
  }

  return trackingId;
}