import { describe, it, expect } from 'vitest';
import { cleanExtractedName, extractEntitiesFromOCR } from '../src/hooks/useOCR';

describe('OCR Name Cleaning and Entity Extraction', () => {
  it('cleanExtractedName cleans leading noise and Devanagari transliteration artifacts', () => {
    expect(cleanExtractedName('i py Vilas Rakhe')).toBe('Vilas Rakhe');
    expect(cleanExtractedName('s Vilas Rakhe')).toBe('Vilas Rakhe');
    expect(cleanExtractedName('Vilas Rakhe')).toBe('Vilas Rakhe');
    expect(cleanExtractedName('VILAS RAKHE')).toBe('VILAS RAKHE');
    expect(cleanExtractedName('s Ramesh Kumar Sharma')).toBe('Ramesh Kumar Sharma');
    expect(cleanExtractedName('RAMESH KUMAR SHARMA')).toBe('RAMESH KUMAR SHARMA');
  });

  it('cleanExtractedName ignores government and boilerplate keywords', () => {
    expect(cleanExtractedName('Government of India')).toBe('');
    expect(cleanExtractedName('Unique Identification Authority')).toBe('');
    expect(cleanExtractedName('Mera Aadhaar')).toBe('');
  });

  it('extractEntitiesFromOCR correctly extracts clean name from uploaded Aadhaar image text', () => {
    const rawOcrText = `w Cama wR AW
2 wl Ree
i py Vilas Rakhe
SIR | = aw/DOB: 30/05/1995
$ | MALE
H 52
H] SMUR TT Sire QE AR, Arie far sera AT.
Aadhaar is proof of identity, not of citizenship
7730 0889 2163
Unique Identification Authority of India`;

    const result = extractEntitiesFromOCR(rawOcrText, 'aadhaar');
    expect(result.isValidDocument).toBe(true);
    expect(result.extractedName).toBe('Vilas Rakhe');
    expect(result.extractedDOB).toBe('1995-05-30');
    expect(result.extractedNumber).toBe('773008892163');
  });

  it('extractEntitiesFromOCR detects invalid/wrong document', () => {
    const receiptText = `SUPERMARKET GROCERY STORE RECEIPT
1. Organic Dairy Milk ₹65.00
2. Brown Wheat Loaf ₹45.00
Total: ₹110.00`;

    const result = extractEntitiesFromOCR(receiptText, 'aadhaar');
    expect(result.isValidDocument).toBe(false);
    expect(result.errorMessage).toContain('Aadhaar not detected');
  });
});
