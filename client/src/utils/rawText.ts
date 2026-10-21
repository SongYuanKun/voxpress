export const MAX_RAW_TEXT_CHARS = 1000;

export type RawTextValidation =
  | { valid: true; value: string }
  | { valid: false; message: string };

export function validateRawText(value: string): RawTextValidation {
  const text = value.trim();
  if (!text) return { valid: false, message: '不能为空，请先补充原文' };
  if (text.length > MAX_RAW_TEXT_CHARS) {
    return { valid: false, message: `超过 ${MAX_RAW_TEXT_CHARS} 字，请编辑后再解析或保存` };
  }
  return { valid: true, value: text };
}
