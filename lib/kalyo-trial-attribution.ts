/** Canonical trial attribution written to psychologists.attribution (+ attribution_source). */

export type KalyoTrialAttribution = {
  source: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  attribution_source: string;
  first_seen_at: string;
};

export function formatTrialAttributionSource(
  source?: string | null,
  medium?: string | null,
): string {
  const s = source?.trim().toLowerCase();
  const m = medium?.trim().toLowerCase();
  if (!s && !m) return 'directo / desconocido';
  return `${s || 'directo'} / ${m || 'desconocido'}`;
}

export function buildTrialAttribution(params: {
  source: string;
  medium: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
}): KalyoTrialAttribution {
  const source = params.source.trim().toLowerCase();
  const medium = params.medium.trim().toLowerCase();
  return {
    source,
    utm_source: (params.utm_source || source).trim().toLowerCase(),
    utm_medium: (params.utm_medium || medium).trim().toLowerCase(),
    utm_campaign: params.utm_campaign?.trim() || undefined,
    utm_content: params.utm_content?.trim() || undefined,
    utm_term: params.utm_term?.trim() || undefined,
    gclid: params.gclid?.trim() || undefined,
    fbclid: params.fbclid?.trim() || undefined,
    attribution_source: formatTrialAttributionSource(source, medium),
    first_seen_at: new Date().toISOString(),
  };
}

export function attributionWhatsappOrganic(): KalyoTrialAttribution {
  return buildTrialAttribution({ source: 'whatsapp', medium: 'organic' });
}

/** Map conversation.metadata ad fields → psychologist attribution. */
export function attributionFromConversationMetadata(
  metadata: Record<string, unknown> | null | undefined,
): KalyoTrialAttribution | null {
  if (!metadata) return null;

  const adChannel = metadata.ad_channel;
  const source = typeof metadata.source === 'string' ? metadata.source : '';
  const utmSource =
    typeof metadata.utm_source === 'string' ? metadata.utm_source.trim().toLowerCase() : '';
  const utmMedium =
    typeof metadata.utm_medium === 'string' ? metadata.utm_medium.trim().toLowerCase() : '';
  const utmCampaign =
    typeof metadata.utm_campaign === 'string' ? metadata.utm_campaign.trim() : undefined;
  const gclid = typeof metadata.gclid === 'string' ? metadata.gclid.trim() : undefined;

  if (adChannel === 'meta' || source === 'meta_ads') {
    return buildTrialAttribution({
      source: 'meta',
      medium: utmMedium === 'leads' ? 'leads' : utmMedium || 'paid',
      utm_source: utmSource || 'meta',
      utm_medium: utmMedium || 'paid',
      utm_campaign: utmCampaign,
    });
  }

  if (adChannel === 'google' || source === 'google_ads' || gclid) {
    return buildTrialAttribution({
      source: 'google',
      medium: utmMedium || 'cpc',
      utm_source: utmSource || 'google',
      utm_medium: utmMedium || 'cpc',
      utm_campaign: utmCampaign,
      gclid,
    });
  }

  if (utmSource || utmMedium) {
    return buildTrialAttribution({
      source: utmSource || 'directo',
      medium: utmMedium || 'desconocido',
      utm_source: utmSource || undefined,
      utm_medium: utmMedium || undefined,
      utm_campaign: utmCampaign,
      gclid,
    });
  }

  return null;
}

export function attributionFromEnrollBody(input: {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  attribution_source?: string;
  gclid?: string;
  source?: string;
}): KalyoTrialAttribution | null {
  if (input.attribution_source?.trim()) {
    const label = input.attribution_source.trim().toLowerCase();
    const [src, ...rest] = label.split('/');
    const medium = rest.join('/').trim() || 'desconocido';
    const built = buildTrialAttribution({
      source: (src || 'directo').trim(),
      medium,
      utm_source: input.utm_source,
      utm_medium: input.utm_medium,
      utm_campaign: input.utm_campaign,
      gclid: input.gclid,
    });
    built.attribution_source = label;
    return built;
  }

  if (input.gclid || input.utm_source || input.utm_medium) {
    if (input.gclid || input.utm_source?.toLowerCase() === 'google') {
      return buildTrialAttribution({
        source: 'google',
        medium: input.utm_medium || 'cpc',
        utm_source: input.utm_source || 'google',
        utm_medium: input.utm_medium || 'cpc',
        utm_campaign: input.utm_campaign,
        gclid: input.gclid,
      });
    }
    return buildTrialAttribution({
      source: (input.utm_source || 'directo').toLowerCase(),
      medium: (input.utm_medium || 'desconocido').toLowerCase(),
      utm_source: input.utm_source,
      utm_medium: input.utm_medium,
      utm_campaign: input.utm_campaign,
      gclid: input.gclid,
    });
  }

  if (input.source === 'kaly_admin' || input.source === 'admin_via_botio') {
    return buildTrialAttribution({ source: 'admin', medium: 'manual' });
  }
  if (input.source === 'botio_whatsapp' || input.source === 'trial_enroll') {
    return attributionWhatsappOrganic();
  }

  return null;
}

export type TrialAttributionOrigin = {
  utm_source?: string | null;
  utm_medium?: string | null;
  attribution_source?: string | null;
};

export function formatAttributionOriginLine(
  attribution: TrialAttributionOrigin | null | undefined,
): string {
  if (attribution?.attribution_source?.trim()) {
    return `📊 Origen: ${attribution.attribution_source.trim().toLowerCase()}`;
  }
  const source = attribution?.utm_source?.trim();
  const medium = attribution?.utm_medium?.trim();
  if (source && medium) return `📊 Origen: ${source.toLowerCase()} / ${medium.toLowerCase()}`;
  if (source) return `📊 Origen: ${source.toLowerCase()} / desconocido`;
  if (medium) return `📊 Origen: directo / ${medium.toLowerCase()}`;
  return '📊 Origen: directo / desconocido';
}
