// Excludes 0/O/1/I/L — easy to misread or mistype when a customer reads it
// off their screen or a confirmation email.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generatePublicIdCandidate(prefix = "SL", length = 4): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}-${code}`;
}

export class PublicIdExhaustedError extends Error {
  constructor(attempts: number) {
    super(`Could not generate a unique public ID after ${attempts} attempts`);
    this.name = "PublicIdExhaustedError";
  }
}

export async function generateUniquePublicId(
  exists: (code: string) => Promise<boolean>,
  options?: { prefix?: string; length?: number; maxAttempts?: number }
): Promise<string> {
  const maxAttempts = options?.maxAttempts ?? 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generatePublicIdCandidate(
      options?.prefix,
      options?.length
    );
    if (!(await exists(candidate))) {
      return candidate;
    }
  }
  throw new PublicIdExhaustedError(maxAttempts);
}
