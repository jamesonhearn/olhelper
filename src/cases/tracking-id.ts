const maximumTrackingIdLength = 64;
const trackingIdPattern =
  /\bTrackingID#([A-Za-z0-9-]{1,64})(?![A-Za-z0-9-])/i;

export function extractTrackingId(subject: string): string | null {
  const match = trackingIdPattern.exec(subject);
  return match?.[1] ?? null;
}

export function trackingToken(trackingId: string): string {
  return `TrackingID#${trackingId}`;
}

export function caseFolderName(trackingId: string): string {
  if (
    trackingId.length > maximumTrackingIdLength ||
    !/^[A-Za-z0-9-]+$/.test(trackingId)
  ) {
    throw new Error("Tracking ID contains unsupported folder characters.");
  }

  return trackingId;
}