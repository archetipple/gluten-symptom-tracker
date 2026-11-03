/** Digits only. */
export const digits = (s: string) => s.replace(/\D/g, '');

/** Same product, ignoring leading zeros (UPC-A 12 digits vs EAN-13 with a leading 0). */
export const sameBarcode = (a?: string, b?: string) => !!a && !!b && digits(a).replace(/^0+/, '') === digits(b).replace(/^0+/, '');

/**
 * Check-digit test for EAN-8, UPC-A (12) and EAN-13: rejects misreads before
 * any lookup. UPC-E (8 digits starting 0/1) is accepted as read.
 */
export function validGtin(code: string): boolean {
  const d = digits(code);
  if (![8, 12, 13, 14].includes(d.length)) return false;
  const nums = d.split('').map(Number);
  const check = nums.pop()!;
  const sum = nums.reverse().reduce((t, n, i) => t + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Forms to try in the food databases, most likely first. Canadian and US
 * products carry 12-digit UPC-A codes that some databases store as 13-digit
 * EAN with a leading zero, and the other way round.
 */
export function barcodeCandidates(code: string): string[] {
  const d = digits(code);
  const out = [d];
  if (d.length === 12) out.push('0' + d);
  if (d.length === 13 && d.startsWith('0')) out.push(d.slice(1));
  return out;
}
