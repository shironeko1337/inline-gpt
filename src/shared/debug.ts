/** Set to false to silence debug logs. Filter the DevTools console by "[inline-chatgpt]". */
export const DEBUG = true;

export function debug(...args: unknown[]): void {
  if (DEBUG) console.log('[inline-chatgpt]', ...args);
}
