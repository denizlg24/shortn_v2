export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function detectImageType(bytes: Uint8Array) {
  const matches = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ext: "png", contentType: "image/png" };
  }
  if (matches([0xff, 0xd8, 0xff])) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (
    matches([0x47, 0x49, 0x46, 0x38]) &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return { ext: "gif", contentType: "image/gif" };
  }
  if (
    bytes.length >= 16 &&
    matches([0x52, 0x49, 0x46, 0x46]) &&
    matches([0x57, 0x45, 0x42, 0x50], 8) &&
    matches([0x56, 0x50, 0x38], 12) &&
    [0x20, 0x4c, 0x58].includes(bytes[15])
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}
