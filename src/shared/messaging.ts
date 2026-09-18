// Reloading an unpacked extension invalidates old content-script contexts.
// Catch synchronous throws as well as rejected/empty worker responses.
export async function sendMessage<T>(message: unknown): Promise<T | undefined> {
  try { return await chrome.runtime.sendMessage(message) as T | undefined; }
  catch { return undefined; }
}
