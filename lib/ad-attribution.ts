/** Canonical ad attribution fields stored on conversations.metadata */
export type AdAttributionMetadata = {
  source: 'meta_ads' | 'google_ads' | 'kalyo_web' | 'organic';
  ad_channel?: 'meta' | 'google';
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  gclid?: string;
  ad_campaign_id?: string;
  ad_headline?: string;
  ad_referral_body?: string;
  ad_referral_source_type?: string;
  referral_ctwa_clid?: string;
  paid_at?: string;
  subscription_id?: string;
};

export type GoogleAdsAttributionInput = {
  gclid?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
};

const TWILIO_REFERRAL_KEYS = [
  'ReferralBody',
  'ReferralHeadline',
  'ReferralSourceId',
  'ReferralSourceType',
  'ReferralCtwaClid',
] as const;

function cleanString(value: unknown, maxLen = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

export function hasExistingAdAttribution(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata) return false;
  const channel = metadata.ad_channel;
  if (channel === 'meta' || channel === 'google') return true;
  const source = metadata.source;
  return source === 'meta_ads' || source === 'google_ads';
}

/** Meta Click-to-WhatsApp referral params from Twilio inbound webhook. */
export function parseTwilioMetaReferral(
  params: Record<string, string>,
): Partial<AdAttributionMetadata> | null {
  const sourceId = cleanString(params.ReferralSourceId, 120);
  const sourceType = cleanString(params.ReferralSourceType, 40);
  if (!sourceId && !sourceType) return null;

  const headline = cleanString(params.ReferralHeadline, 300);
  const body = cleanString(params.ReferralBody, 500);
  const ctwaClid = cleanString(params.ReferralCtwaClid, 500);

  return {
    source: 'meta_ads',
    ad_channel: 'meta',
    utm_source: 'facebook',
    utm_medium: 'paid_social',
    ad_campaign_id: sourceId,
    ad_headline: headline,
    ad_referral_body: body,
    ad_referral_source_type: sourceType,
    referral_ctwa_clid: ctwaClid,
  };
}

export function twilioParamsHaveReferral(params: Record<string, string>): boolean {
  return TWILIO_REFERRAL_KEYS.some((key) => Boolean(cleanString(params[key])));
}

/** Build google_ads metadata from landing/enroll UTMs. */
export function buildGoogleAdsMetadata(
  input: GoogleAdsAttributionInput,
): Partial<AdAttributionMetadata> | null {
  const gclid = cleanString(input.gclid, 200);
  const utmSource = cleanString(input.utm_source, 80)?.toLowerCase();
  const utmMedium = cleanString(input.utm_medium, 80);
  const utmCampaign = cleanString(input.utm_campaign, 200);

  const isGoogle =
    Boolean(gclid) ||
    utmSource === 'google' ||
    utmMedium === 'cpc' ||
    utmMedium === 'ppc';

  if (!isGoogle) return null;

  return {
    source: 'google_ads',
    ad_channel: 'google',
    utm_source: utmSource ?? 'google',
    utm_medium: utmMedium ?? 'cpc',
    utm_campaign: utmCampaign,
    gclid,
  };
}

/** Merge attribution into metadata without overwriting existing ad attribution. */
export function mergeAttributionMetadata(
  existing: Record<string, unknown> | null | undefined,
  patch: Partial<AdAttributionMetadata>,
): Record<string, unknown> {
  const base = { ...(existing ?? {}) };
  if (hasExistingAdAttribution(base)) return base;
  return { ...base, ...patch };
}

export type AdChannelBucket = 'meta' | 'google' | 'web' | 'organic';

export function bucketAdChannel(metadata: Record<string, unknown> | null | undefined): AdChannelBucket {
  if (!metadata) return 'organic';
  const channel = metadata.ad_channel;
  if (channel === 'meta') return 'meta';
  if (channel === 'google') return 'google';
  const source = metadata.source;
  if (source === 'meta_ads') return 'meta';
  if (source === 'google_ads') return 'google';
  if (source === 'kalyo_web' || source === 'kalyo_web_direct') return 'web';
  return 'organic';
}

/** Conversation metadata for trial enroll — preserves existing ad attribution. */
export function buildConversationMetadataForEnroll(
  existing: Record<string, unknown> | null | undefined,
  fields: {
    email: string;
    name: string;
    source: string;
    googleAds?: GoogleAdsAttributionInput;
  },
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    ...(existing ?? {}),
    customer_email: fields.email,
    customer_name: fields.name,
  };

  const googlePatch = fields.googleAds ? buildGoogleAdsMetadata(fields.googleAds) : null;
  if (googlePatch) {
    return mergeAttributionMetadata(base, googlePatch);
  }

  if (hasExistingAdAttribution(base)) {
    return base;
  }

  return { ...base, source: fields.source };
}
