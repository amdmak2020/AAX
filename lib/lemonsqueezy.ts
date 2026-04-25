import crypto from "node:crypto";
import { getEnv } from "@/lib/env";

const apiBase = "https://api.lemonsqueezy.com/v1";

type LemonSqueezyResponse<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

type CheckoutResponse = {
  id: string;
  attributes: {
    url: string;
  };
};

type SubscriptionResponse = {
  id: string;
  attributes: {
    customer_id: number | string;
    variant_id: number | string;
    status: string;
    renews_at: string | null;
    ends_at: string | null;
    cancelled: boolean;
    urls?: {
      customer_portal?: string | null;
    };
  };
};

function getHeaders() {
  const apiKey = getEnv("LEMONSQUEEZY_API_KEY");
  if (!apiKey) {
    throw new Error("Missing LEMONSQUEEZY_API_KEY.");
  }

  return {
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    Authorization: `Bearer ${apiKey}`
  };
}

async function parseResponse<T>(response: Response) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Lemon Squeezy request failed with ${response.status}.`);
  }

  return (await response.json()) as LemonSqueezyResponse<T>;
}

export async function createLemonSqueezyCheckout(params: {
  storeId: string;
  variantId: string;
  planName: string;
  email?: string | null;
  name?: string | null;
  userId: string;
  redirectUrl: string;
}) {
  const response = await fetch(`${apiBase}/checkouts`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: params.email ?? undefined,
            name: params.name ?? undefined,
            custom: {
              user_id: params.userId,
              plan_name: params.planName
            }
          },
          checkout_options: {
            embed: false,
            media: false,
            logo: true,
            desc: true,
            discount: true,
            subscription_preview: true
          },
          product_options: {
            redirect_url: params.redirectUrl,
            enabled_variants: [Number(params.variantId)]
          }
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: String(params.storeId)
            }
          },
          variant: {
            data: {
              type: "variants",
              id: String(params.variantId)
            }
          }
        }
      }
    })
  });

  const parsed = await parseResponse<CheckoutResponse>(response);
  return parsed.data.attributes.url;
}

export async function getLemonSqueezySubscription(subscriptionId: string) {
  const response = await fetch(`${apiBase}/subscriptions/${subscriptionId}`, {
    method: "GET",
    headers: getHeaders()
  });

  const parsed = await parseResponse<SubscriptionResponse>(response);
  return parsed.data;
}

export function verifyLemonSqueezySignature(payload: string, signature: string | null, secret: string) {
  if (!signature) {
    return false;
  }

  const digest = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const digestBuffer = Buffer.from(digest, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  if (digestBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuffer, signatureBuffer);
}
