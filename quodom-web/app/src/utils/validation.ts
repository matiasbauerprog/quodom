export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
export function nonEmpty(v: string): boolean {
  return v.trim().length > 0;
}
export function minLen(v: string, n: number): boolean {
  return v.length >= n;
}
