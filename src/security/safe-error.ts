const sensitiveErrorPattern =
  /access[_ ]token|refresh[_ ]token|authorization\s*:|oneauth|wam_telemetry/i;

export function getSafeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unexpected error";
  }

  if (
    error.message.length > 300 ||
    sensitiveErrorPattern.test(error.message)
  ) {
    return "Authentication or mailbox access failed. Retry the operation or contact the OLHelper support owner.";
  }

  return error.message;
}
