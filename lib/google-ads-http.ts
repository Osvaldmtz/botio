import { formatUnknownError } from '@/lib/format-error';

type GaqlSearchResponse = {
  results?: unknown[];
  error?: { message?: string; code?: number; status?: string };
};

type GoogleAdsFailureJson = GaqlSearchResponse & {
  message?: string;
  error?: {
    message?: string;
    code?: number;
    status?: string;
    details?: Array<{
      errors?: Array<{
        message?: string;
        details?: {
          quotaErrorDetails?: { retryDelay?: string };
        };
      }>;
    }>;
  };
};

function parseRetryMinutes(body: GoogleAdsFailureJson): number | null {
  const retryDelay =
    body.error?.details?.[0]?.errors?.[0]?.details?.quotaErrorDetails?.retryDelay;
  if (!retryDelay) return null;
  const match = retryDelay.match(/^(\d+)s$/);
  if (!match) return null;
  return Math.max(1, Math.ceil(Number(match[1]) / 60));
}

function extractGoogleAdsErrorMessage(body: GoogleAdsFailureJson, httpStatus: number): string {
  if (httpStatus === 429) {
    const retryMinutes = parseRetryMinutes(body);
    if (retryMinutes != null) {
      return `Google Ads rate limit — reintentar en ~${retryMinutes} min`;
    }
    return 'Google Ads rate limit — reintentar más tarde';
  }

  if (body.error?.status === 'UNAUTHENTICATED' || body.error?.status === 'PERMISSION_DENIED') {
    return `Google Ads auth error: ${body.error.message ?? body.error.status}`;
  }

  return body.error?.message ?? body.message ?? `Google Ads HTTP ${httpStatus}`;
}

/** Parse Google Ads HTTP body; rejects HTML error pages before JSON.parse. */
export function parseGoogleAdsHttpBody(
  httpStatus: number,
  contentType: string,
  bodyText: string,
): GoogleAdsFailureJson {
  const trimmed = bodyText.trimStart();
  const isHtml =
    contentType.includes('text/html') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html');

  if (isHtml) {
    if (httpStatus === 404) {
      throw new Error('Google Ads API endpoint not found (API version may be deprecated)');
    }
    throw new Error(`Google Ads API returned HTML instead of JSON (HTTP ${httpStatus})`);
  }

  let parsed: GoogleAdsFailureJson;
  try {
    parsed = JSON.parse(bodyText) as GoogleAdsFailureJson;
  } catch {
    throw new Error(`Google Ads API returned invalid JSON (HTTP ${httpStatus})`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Google Ads API returned unexpected payload (HTTP ${httpStatus})`);
  }

  if (httpStatus >= 400) {
    throw new Error(extractGoogleAdsErrorMessage(parsed, httpStatus));
  }

  return parsed;
}

export function shouldFallbackToComposio(error: unknown): boolean {
  const message = formatGoogleAdsApiError(error).toLowerCase();
  if (message.includes('missing composio')) return false;
  if (message.includes('oauth credentials incomplete')) return false;
  return (
    message.includes('rate limit') ||
    message.includes('html') ||
    message.includes('auth error') ||
    message.includes('invalid_grant') ||
    message.includes('endpoint not found') ||
    message.includes('invalid json') ||
    message.includes('http 4') ||
    message.includes('http 5')
  );
}

export function formatGoogleAdsApiError(error: unknown): string {
  if (error instanceof SyntaxError && error.message.includes('Unexpected token')) {
    return 'Google Ads API returned HTML instead of JSON (check API version or auth headers)';
  }
  return formatUnknownError(error);
}

export async function readHttpResponseBody(
  res: Response,
): Promise<{ contentType: string; bodyText: string }> {
  const contentType = res.headers.get('content-type') ?? '';
  const bodyText = await res.text();
  return { contentType, bodyText };
}
