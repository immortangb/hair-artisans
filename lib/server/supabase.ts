type SupabaseRpcResult<T> = {
  data: T | null;
  error: { message?: string } | null;
};

/** Calls a Supabase RPC from the server with the service-role key. Never import this in client code. */
export async function callSupabaseRpc<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const result = (await response.json().catch(() => null)) as SupabaseRpcResult<T> | null;

  if (!response.ok || result?.error) {
    throw new Error(result?.error?.message || "Supabase request failed.");
  }

  return result as T;
}


