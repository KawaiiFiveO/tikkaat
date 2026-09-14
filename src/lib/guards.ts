export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

/** True when `order` contains each of 0 … length-1 exactly once. */
export function isPermutation(order: unknown, length: number): order is number[] {
  return (
    Array.isArray(order) &&
    order.length === length &&
    new Set(order).size === length &&
    order.every((s) => Number.isInteger(s) && s >= 0 && s < length)
  );
}
