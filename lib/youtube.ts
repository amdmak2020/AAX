import { randomUUID } from "node:crypto";
import { createSignedState, decryptSecret, encryptSecret, verifySignedState } from "@/lib/secrets";

const youtubeScope = "https://www.googleapis.com/auth/youtube.upload";
const oauthStateScope = "youtube-oauth";
const oauthStateMaxAgeMs = 10 * 60 * 1000;
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const channelsEndpoint = "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";
const uploadEndpoint = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status";

export type YouTubeConnectionRecord = {
  user_id: string;
  channel_id: string | null;
  channel_title: string | null;
  channel_thumbnail_url: string | null;
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  access_token_expires_at: string | null;
  scope: string | null;
  created_at?: string;
  updated_at?: string;
  last_used_at?: string | null;
};

export type YouTubeConnectionSummary = {
  connected: boolean;
  channelId: string | null;
  channelTitle: string | null;
  channelThumbnailUrl: string | null;
  updatedAt: string | null;
};

export type YouTubePublishInput = {
  title: string;
  description: string;
  tags: string[];
  privacyStatus: "private" | "unlisted" | "public";
  publishAt?: string | null;
};

function getYouTubeClientId() {
  return process.env.YOUTUBE_CLIENT_ID?.trim() ?? null;
}

function getYouTubeClientSecret() {
  return process.env.YOUTUBE_CLIENT_SECRET?.trim() ?? null;
}

export function hasYouTubeConfig() {
  return Boolean(getYouTubeClientId() && getYouTubeClientSecret() && process.env.APP_ENCRYPTION_KEY);
}

export function getYouTubeRedirectUri(appUrl: string) {
  return `${appUrl.replace(/\/$/, "")}/api/youtube/callback`;
}

export function createYouTubeOAuthUrl(input: { appUrl: string; userId: string; returnTo: string }) {
  const clientId = getYouTubeClientId();
  if (!clientId) {
    throw new Error("YOUTUBE_CLIENT_ID is not configured.");
  }

  const state = createSignedState(oauthStateScope, {
    userId: input.userId,
    returnTo: input.returnTo
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getYouTubeRedirectUri(input.appUrl));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", youtubeScope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export function verifyYouTubeOAuthState(value: string) {
  return verifySignedState<{ userId: string; returnTo: string }>(value, oauthStateScope, oauthStateMaxAgeMs);
}

export async function exchangeYouTubeCode(input: { appUrl: string; code: string }) {
  const clientId = getYouTubeClientId();
  const clientSecret = getYouTubeClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("YouTube OAuth is not configured.");
  }

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code: input.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getYouTubeRedirectUri(input.appUrl),
      grant_type: "authorization_code"
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Google token exchange failed (${response.status}).`);
  }

  return (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
  };
}

export async function refreshYouTubeAccessToken(input: { appUrl: string; refreshToken: string }) {
  const clientId = getYouTubeClientId();
  const clientSecret = getYouTubeClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("YouTube OAuth is not configured.");
  }

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: input.refreshToken,
      grant_type: "refresh_token"
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Google token refresh failed (${response.status}).`);
  }

  return (await response.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
    token_type?: string;
  };
}

export async function fetchYouTubeChannel(accessToken: string) {
  const response = await fetch(channelsEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Could not fetch YouTube channel (${response.status}).`);
  }

  const payload = (await response.json()) as {
    items?: Array<{
      id?: string;
      snippet?: {
        title?: string;
        thumbnails?: {
          default?: { url?: string };
          medium?: { url?: string };
          high?: { url?: string };
        };
      };
    }>;
  };

  const first = payload.items?.[0];
  return {
    channelId: first?.id ?? null,
    channelTitle: first?.snippet?.title ?? null,
    channelThumbnailUrl: first?.snippet?.thumbnails?.high?.url ?? first?.snippet?.thumbnails?.medium?.url ?? first?.snippet?.thumbnails?.default?.url ?? null
  };
}

export function buildStoredYouTubeConnection(input: {
  userId: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresIn: number;
  scope?: string | null;
  channelId?: string | null;
  channelTitle?: string | null;
  channelThumbnailUrl?: string | null;
}) {
  return {
    user_id: input.userId,
    channel_id: input.channelId ?? null,
    channel_title: input.channelTitle ?? null,
    channel_thumbnail_url: input.channelThumbnailUrl ?? null,
    encrypted_access_token: encryptSecret(input.accessToken),
    encrypted_refresh_token: input.refreshToken ? encryptSecret(input.refreshToken) : null,
    access_token_expires_at: new Date(Date.now() + input.expiresIn * 1000).toISOString(),
    scope: input.scope ?? youtubeScope,
    updated_at: new Date().toISOString(),
    last_used_at: new Date().toISOString()
  } satisfies Partial<YouTubeConnectionRecord>;
}

export function getAccessTokenFromConnection(connection: YouTubeConnectionRecord) {
  return decryptSecret(connection.encrypted_access_token);
}

export function getRefreshTokenFromConnection(connection: YouTubeConnectionRecord) {
  return connection.encrypted_refresh_token ? decryptSecret(connection.encrypted_refresh_token) : null;
}

function buildMultipartBody(metadata: Record<string, unknown>, videoBytes: Uint8Array, mimeType: string) {
  const boundary = `aax_${randomUUID().replace(/-/g, "")}`;
  const metadataPart = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`, "utf8");
  const mediaHeader = Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: binary\r\n\r\n`, "utf8");
  const footer = Buffer.from(`\r\n--${boundary}--`, "utf8");

  return {
    boundary,
    body: Buffer.concat([metadataPart, mediaHeader, Buffer.from(videoBytes), footer])
  };
}

export async function uploadVideoToYouTube(input: {
  accessToken: string;
  videoBytes: Uint8Array;
  mimeType: string;
  metadata: YouTubePublishInput;
}) {
  const statusPayload: Record<string, unknown> = {
    privacyStatus: input.metadata.publishAt ? "private" : input.metadata.privacyStatus,
    selfDeclaredMadeForKids: false
  };

  if (input.metadata.publishAt) {
    statusPayload.publishAt = input.metadata.publishAt;
  }

  const requestMetadata = {
    snippet: {
      title: input.metadata.title,
      description: input.metadata.description,
      tags: input.metadata.tags,
      categoryId: "22"
    },
    status: statusPayload
  };

  const multipart = buildMultipartBody(requestMetadata, input.videoBytes, input.mimeType);
  const response = await fetch(uploadEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": `multipart/related; boundary=${multipart.boundary}`
    },
    body: multipart.body,
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `YouTube upload failed (${response.status}).`);
  }

  return (await response.json()) as {
    id?: string;
  };
}
