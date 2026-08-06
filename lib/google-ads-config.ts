import googleAdsJson from '@/config/google-ads.json';

export type GoogleAdsAccountConfig = {
  active_customer_id: string;
  historical_customer_id: string;
  login_customer_id: string;
  conversion_tag_colombia: string;
  composio_account_alias?: string;
  composio_connected_account_id?: string;
};

const DEFAULTS = googleAdsJson as GoogleAdsAccountConfig;

function normalizeCustomerId(raw: string | undefined | null): string {
  return (raw ?? '').replace(/\D/g, '');
}

function assertCustomerId(id: string, label: string): string {
  if (!/^\d{10}$/.test(id)) {
    throw new Error(`Invalid ${label}: expected 10 digits, got "${id}"`);
  }
  return id;
}

/** Active account — campaign mutations and new operational queries. */
export function getActiveCustomerId(): string {
  const fromEnv = normalizeCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID);
  const id = fromEnv || DEFAULTS.active_customer_id;
  return assertCustomerId(id, 'active_customer_id');
}

/** Legacy account — read-only history for rolling metrics windows. */
export function getHistoricalCustomerId(): string {
  const fromEnv = normalizeCustomerId(process.env.GOOGLE_ADS_HISTORICAL_CUSTOMER_ID);
  const id = fromEnv || DEFAULTS.historical_customer_id;
  return assertCustomerId(id, 'historical_customer_id');
}

/** MCC login customer for OAuth requests under a manager account. */
export function getLoginCustomerId(): string {
  const fromEnv = normalizeCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  const id = fromEnv || DEFAULTS.login_customer_id;
  return assertCustomerId(id, 'login_customer_id');
}

/** Customer IDs to query for LAST_30_DAYS (and similar rolling metrics). */
export function getMetricsCustomerIds(): string[] {
  const active = getActiveCustomerId();
  const historical = getHistoricalCustomerId();
  return active === historical ? [active] : [active, historical];
}

export function getGoogleAdsConfig(): GoogleAdsAccountConfig {
  return {
    ...DEFAULTS,
    active_customer_id: getActiveCustomerId(),
    historical_customer_id: getHistoricalCustomerId(),
    login_customer_id: getLoginCustomerId(),
  };
}

/** @deprecated Prefer getActiveCustomerId() */
export const GOOGLE_ADS_CUSTOMER_ID = getActiveCustomerId();
