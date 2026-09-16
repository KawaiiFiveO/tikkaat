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

/** True when `steps` holds distinct integers from 0 … length-1 (any subset, in any order). */
export function isIndexSubset(steps: unknown, length: number): steps is number[] {
  return (
    Array.isArray(steps) &&
    steps.length <= length &&
    new Set(steps).size === steps.length &&
    steps.every((s) => Number.isInteger(s) && s >= 0 && s < length)
  );
}
