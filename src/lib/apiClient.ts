import { auth } from "./firebase";

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const user = auth.currentUser;
  
  const headers = new Headers(init?.headers);

  if (user) {
    try {
      const token = await user.getIdToken();
      headers.set("Authorization", `Bearer ${token}`);
    } catch (e) {
      console.warn("Failed to get Firebase ID token:", e);
    }
  } else {
    console.warn("No authenticated user found for request to", input);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}


