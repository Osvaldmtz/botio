const COMPOSIO_API_BASE = 'https://backend.composio.dev/api/v3.1';

export type ComposioExecuteResponse = {
  data?: {
    results?: unknown[];
    successful?: boolean;
    error?: string;
  };
  successful?: boolean;
  error?: string | { message?: string };
  message?: string;
};

/** Project API keys (ak_*) for backend.composio.dev REST — NOT MCP consumer keys (ck_*). */
export function getComposioApiKey(): string {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Missing COMPOSIO_API_KEY for Composio');
  }
  if (apiKey.startsWith('ck_')) {
    throw new Error(
      'COMPOSIO_API_KEY looks like an MCP consumer key (ck_*). ' +
        'Botio uses the REST API at backend.composio.dev and needs a Project API key (ak_*) ' +
        'from Composio → Settings → Project Settings → API Keys.',
    );
  }
  return apiKey;
}

export function isComposioConfigured(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY?.trim());
}

export function composioExecuteUrl(toolSlug: string): string {
  return `${COMPOSIO_API_BASE}/tools/execute/${toolSlug}`;
}

/** Standard Composio REST auth — x-api-key (not x-consumer-api-key, which is MCP-only). */
export function composioAuthHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  };
}

export function composioUserId(): string {
  return process.env.COMPOSIO_USER_ID?.trim() || 'botio-kalyo';
}
