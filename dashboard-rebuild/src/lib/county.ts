export function normalizeCountyFips(value: unknown): string | null {
  if (value == null || value === '') return null;

  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;

  return digits.padStart(5, '0');
}
