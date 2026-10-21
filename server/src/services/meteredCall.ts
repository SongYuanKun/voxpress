/** Reserves quota before an outbound provider callback can begin. */
export async function runMeteredCall<T>(reserve: () => void, outbound: () => Promise<T>) {
  reserve();
  return outbound();
}
