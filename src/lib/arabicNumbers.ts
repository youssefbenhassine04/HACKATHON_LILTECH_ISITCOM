/**
 * Arabic Number to Words Converter (Tafqeet)
 * Specifically handles years (e.g. 2026 -> ألفان وستة وعشرون)
 * and serial numbers (e.g. 1 -> واحد, 25 -> خمسة وعشرون, 142 -> مائة واثنان وأربعون)
 */

const ones = [
  '',
  'واحد',
  'اثنان',
  'ثلاثة',
  'أربعة',
  'خمسة',
  'ستة',
  'سبعة',
  'ثمانية',
  'تسعة',
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];

const tens = [
  '',
  'عشرة',
  'عشرون',
  'ثلاثون',
  'أربعون',
  'خمسون',
  'ستون',
  'سبعون',
  'ثمانون',
  'تسعون',
];

const hundreds = [
  '',
  'مائة',
  'مائتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة',
];

function convertBelowThousand(n: number): string {
  if (n === 0) return '';
  const parts: string[] = [];

  const h = Math.floor(n / 100);
  const remainder = n % 100;

  if (h > 0) {
    parts.push(hundreds[h]);
  }

  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(ones[remainder]);
    } else {
      const o = remainder % 10;
      const t = Math.floor(remainder / 10);
      if (o > 0) {
        parts.push(ones[o] + ' و' + tens[t]);
      } else {
        parts.push(tens[t]);
      }
    }
  }

  return parts.join(' و');
}

export function numberToArabicWords(num: number): string {
  if (num === 0) return 'صفر';
  if (num < 0) return 'سالب ' + numberToArabicWords(Math.abs(num));

  const parts: string[] = [];

  // Thousands
  const th = Math.floor(num / 1000);
  const rem = num % 1000;

  if (th > 0) {
    if (th === 1) {
      parts.push('ألف');
    } else if (th === 2) {
      parts.push('ألفان');
    } else if (th >= 3 && th <= 10) {
      parts.push(ones[th] + ' آلاف');
    } else {
      parts.push(convertBelowThousand(th) + ' ألف');
    }
  }

  if (rem > 0) {
    const remText = convertBelowThousand(rem);
    if (remText) {
      parts.push(remText);
    }
  }

  return parts.join(' و');
}

/**
 * Generates the official Arabic legal reference string
 * Example: "ألفان وستة وعشرون - سيدي بوعلي - واحد"
 */
export function generateArabicReference(year: number, municipalityName: string, serial: number): string {
  const yearWords = numberToArabicWords(year);
  const serialWords = numberToArabicWords(serial);
  return `${yearWords} - ${municipalityName} - ${serialWords}`;
}
