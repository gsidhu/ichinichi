export const SESSION_EXPIRED_EVENT = "ichinichi:session-expired";

interface ApiFetchOptions extends RequestInit {
  notifyOnUnauthorized?: boolean;
}

export async function apiFetch(
  input: RequestInfo | URL,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const { notifyOnUnauthorized = true, ...init } = options;
  const response = await fetch(input, {
    credentials: "include",
    ...init,
  });

  if (
    notifyOnUnauthorized &&
    response.status === 401 &&
    typeof window !== "undefined"
  ) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }

  return response;
}
