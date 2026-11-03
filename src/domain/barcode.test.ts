import { describe, expect, it } from 'vitest';
import { barcodeCandidates, sameBarcode, validGtin } from './barcode';

describe('barcodes', () => {
  it('check digits catch misreads', () => {
    expect(validGtin('3017624010701')).toBe(true); // EAN-13
    expect(validGtin('3017624010702')).toBe(false);
    expect(validGtin('064200116459')).toBe(true); // UPC-A
    expect(validGtin('96385074')).toBe(true); // EAN-8
    expect(validGtin('12345')).toBe(false);
  });
  it('tries both UPC-A and EAN-13 forms', () => {
    expect(barcodeCandidates('064200116459')).toEqual(['064200116459', '0064200116459']);
    expect(barcodeCandidates('0064200116459')).toEqual(['0064200116459', '064200116459']);
    expect(barcodeCandidates('3017624010701')).toEqual(['3017624010701']);
  });
  it('matches saved foods regardless of leading zeros', () => {
    expect(sameBarcode('0064200116459', '64200116459')).toBe(true);
    expect(sameBarcode('3017624010701', '3017624010702')).toBe(false);
  });
});
