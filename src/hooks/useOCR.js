import { useState } from 'react';
import { createWorker } from 'tesseract.js';

export function useOCR() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ocrText, setOcrText] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);

  const processDocument = async (imageSource, docType = 'aadhaar') => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    let worker = null;
    try {
      worker = await createWorker('eng');
      
      const ret = await worker.recognize(imageSource);
      const text = ret.data.text || '';
      setOcrText(text);

      const parsed = extractEntitiesFromOCR(text, docType);
      setExtractedData(parsed);

      await worker.terminate();
      setIsProcessing(false);
      return { rawText: text, ...parsed };
    } catch (err) {
      console.error('OCR processing error:', err);
      setError(err.message || 'Failed to perform OCR on image');
      setIsProcessing(false);
      if (worker) {
        await worker.terminate().catch(() => {});
      }
      return null;
    }
  };

  return {
    processDocument,
    isProcessing,
    progress,
    ocrText,
    extractedData,
    error
  };
}

// Helper to sanitize extracted name by stripping OCR noise, stray Devanagari transliteration fragments, etc.
export function cleanExtractedName(str) {
  if (!str) return '';
  const s = str.replace(/[^a-zA-Z\s.]/g, ' ').trim();
  const words = s.split(/\s+/).filter(Boolean);

  const ignoredKeywords = /^(India|Government|Govt|Authority|Enrollment|Unique|Identification|Mera|Meri|Pehchan|Male|Female|Gender|Birth|Date|Year|Help|Www|Uidai|Address|Income|Tax|Department|Card|Signature|Father|Name|Aadhaar|Aadhar)$/i;

  const validWords = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/\.+$/, '');
    if (!w) continue;
    if (ignoredKeywords.test(w)) continue;

    // Names in official Indian identity documents are TitleCase (e.g. 'Vilas') or UPPERCASE (e.g. 'VILAS').
    // Stray OCR noise (like 's', 'i', 'py', 'wl', 'w') is typically lowercase or single lowercase letters.
    const isCapitalized = /^[A-Z][a-zA-Z]*$/.test(w);
    const isSingleInitial = /^[A-Z]$/.test(w);

    if (isCapitalized && w.length >= 2) {
      validWords.push(w);
    } else if (isSingleInitial && (i + 1 < words.length || validWords.length > 0)) {
      validWords.push(w);
    } else if (validWords.length > 0 && /^[a-zA-Z]{2,}$/.test(w)) {
      validWords.push(w);
    }
  }

  let result = validWords.join(' ').trim();
  if (ignoredKeywords.test(result)) return '';
  return result;
}

// Regex Parsing rules for Indian Aadhaar and PAN Cards
export function extractEntitiesFromOCR(text, docType) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Detection flags for Aadhaar and PAN cards
  const hasAadhaarKeywords = /aadhaar|aadhar|uidai|unique identification|mera aadhaar|meri pehchan|enrollment|मेरा आधार|मेरी पहचान|भारत सरकार/i.test(text);
  const hasAadhaarNumber = /\b([0-9]{4}\s[0-9]{4}\s[0-9]{4})\b/.test(text) || (/\b([0-9]{12})\b/.test(text) && !/phone|mobile|tel|contact/i.test(text));
  const hasGovtIndia = /government of india|govt\.?\s*of\s*india/i.test(text);
  const isAadhaarDetected = hasAadhaarKeywords || hasAadhaarNumber || (hasGovtIndia && /dob|birth|gender|male|female|year|father/i.test(text));

  const hasPanKeywords = /income tax|permanent account number|pan card/i.test(text);
  const hasPanNumber = /[A-Z]{5}[0-9]{4}[A-Z]{1}/.test(text);
  const isPanDetected = hasPanKeywords || hasPanNumber;

  let isValidDocument = false;
  let errorMessage = '';

  if (docType === 'aadhaar') {
    if (isAadhaarDetected) {
      isValidDocument = true;
    } else if (isPanDetected) {
      isValidDocument = false;
      errorMessage = 'Aadhaar not detected: You uploaded a PAN Card instead. Please switch to PAN Card or upload an Aadhaar Card.';
    } else {
      isValidDocument = false;
      errorMessage = 'Aadhaar not detected: The uploaded photo does not appear to be a valid Aadhaar card. Please upload a clear photo of an Aadhaar Card (Front).';
    }
  } else if (docType === 'pan') {
    if (isPanDetected) {
      isValidDocument = true;
    } else if (isAadhaarDetected) {
      isValidDocument = false;
      errorMessage = 'PAN Card not detected: You uploaded an Aadhaar Card instead. Please switch to Aadhaar Card or upload a PAN Card.';
    } else {
      isValidDocument = false;
      errorMessage = 'PAN Card not detected: The uploaded photo does not appear to be a valid PAN card. Please upload a clear photo of a PAN Card.';
    }
  }

  // If document was not recognized as the selected type, fail gracefully
  if (!isValidDocument) {
    return {
      isValidDocument: false,
      docTypeDetected: isAadhaarDetected ? 'aadhaar' : isPanDetected ? 'pan' : 'unknown',
      errorMessage,
      extractedName: null,
      extractedDOB: null,
      extractedNumber: null
    };
  }

  // 2. If valid document, extract fields:
  let extractedName = '';
  let extractedDOB = '';
  let extractedNumber = '';

  // DOB Extraction Pattern (dd/mm/yyyy or dd-mm-yyyy or YYYY)
  const dobMatch = text.match(/(?:DOB|D\.O\.B|Birth|Year of Birth)[:\s]*([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.][1-2][0-9]{3})/i)
    || text.match(/([0-3][0-9][\/\-\.][0-1][0-9][\/\-\.][1-2][0-9]{3})/);
  
  if (dobMatch) {
    const rawDob = dobMatch[1];
    const parts = rawDob.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      extractedDOB = `${year}-${month}-${day}`;
    }
  }

  // PAN Card Details Extraction
  if (docType === 'pan' || isPanDetected) {
    const panMatch = text.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
    if (panMatch) extractedNumber = panMatch[0];

    for (let i = 0; i < lines.length; i++) {
      if (/INCOME TAX|GOVT OF INDIA/i.test(lines[i])) {
        for (let j = 1; j <= 3 && (i + j) < lines.length; j++) {
          if (!/Father|Name|DOB|Birth|Permanent|Account/i.test(lines[i + j])) {
            const candidate = cleanExtractedName(lines[i + j]);
            if (candidate && candidate.length >= 3) {
              extractedName = candidate;
              break;
            }
          }
        }
        if (extractedName) break;
      }
    }
  }

  // Aadhaar Card Details Extraction
  if (docType === 'aadhaar' || isAadhaarDetected) {
    const aadhaarMatch = text.match(/\b([0-9]{4}\s[0-9]{4}\s[0-9]{4})\b/) || text.match(/\b([0-9]{12})\b/);
    if (aadhaarMatch) {
      extractedNumber = aadhaarMatch[0].replace(/\s/g, '');
    }

    for (let i = 0; i < lines.length; i++) {
      if (/DOB|Birth|Year/i.test(lines[i])) {
        const candidates = [];
        for (let j = 1; j <= 3 && (i - j) >= 0; j++) {
          const candidate = cleanExtractedName(lines[i - j]);
          if (candidate && candidate.length >= 3 && !/India|Government|Authority|Enrollment|MALE|FEMALE/i.test(candidate)) {
            candidates.push(candidate);
          }
        }
        // Prefer candidate with at least 2 words (e.g. "Vilas Rakhe" over single-word noise like "Ree")
        const multiWord = candidates.find(c => c.split(' ').length >= 2);
        const bestCandidate = multiWord || candidates[0] || '';
        if (bestCandidate) {
          extractedName = bestCandidate;
          break;
        }
      }
    }
  }

  // Fallback candidate name search if not detected on standard line
  if (!extractedName && lines.length > 0) {
    for (const l of lines) {
      const candidate = cleanExtractedName(l);
      if (candidate && candidate.split(' ').length >= 2 && !/INDIA|GOVERNMENT|TAX|AADHAAR|UNIQUE|AUTHORITY/i.test(candidate)) {
        extractedName = candidate;
        break;
      }
    }
  }

  return {
    isValidDocument: true,
    docTypeDetected: docType,
    errorMessage: '',
    extractedName: extractedName || 'Name unverified',
    extractedDOB: extractedDOB || '',
    extractedNumber: extractedNumber || ''
  };
}
