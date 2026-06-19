// Copyright © 2026 Workforce. All rights reserved.
// Thai PromptPay EMV TLV QR parser — shared utility

export interface ParsedThaiQR {
  merchantName: string | null;
  amount: number | null;
  accountId: string | null;
}

export function parseThaiQR(raw: string): ParsedThaiQR {
  let merchantName: string | null = null;
  let amount: number | null = null;
  let accountId: string | null = null;

  try {
    let i = 0;
    while (i + 4 <= raw.length) {
      const tag = raw.slice(i, i + 2);
      const lenStr = raw.slice(i + 2, i + 4);
      const len = parseInt(lenStr, 10);
      if (isNaN(len) || i + 4 + len > raw.length) break;
      const value = raw.slice(i + 4, i + 4 + len);

      if (tag === "59") merchantName = value;
      if (tag === "54") amount = parseFloat(value);
      if (tag === "29" || tag === "30") {
        let j = 0;
        while (j + 4 <= value.length) {
          const st = value.slice(j, j + 2);
          const sl = parseInt(value.slice(j + 2, j + 4), 10);
          if (isNaN(sl) || j + 4 + sl > value.length) break;
          const sv = value.slice(j + 4, j + 4 + sl);
          if (st === "02") accountId = sv;
          j += 4 + sl;
        }
      }
      i += 4 + len;
    }
  } catch {}

  return { merchantName, amount, accountId };
}
