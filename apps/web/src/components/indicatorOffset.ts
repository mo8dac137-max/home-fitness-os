/**
 * Calculates the exact transform style string for the sliding pill indicator.
 *
 * In LTR (isRtl = false): translateX(calc(1 * index * 100%))
 * In RTL (isRtl = true):  translateX(calc(-1 * index * 100%))
 *
 * When CSS variables are active, this evaluates to: translateX(calc(var(--dir) * <index> * 100%))
 */
export function indicatorOffset(index: number, isRtl: boolean): string {
  if (index === 0) {
    return 'translateX(calc(0%))';
  }
  const dir = isRtl ? -1 : 1;
  return `translateX(calc(${dir * index * 100}%))`;
}

/**
 * Returns the CSS variable formula for runtime CSS transform styling.
 */
export function indicatorCssVarTransform(index: number): string {
  return `translateX(calc(var(--dir) * ${index} * 100%))`;
}
