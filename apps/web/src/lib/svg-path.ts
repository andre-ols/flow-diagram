/**
 * Horizontal cubic bezier between two points. When the target sits to the left
 * of the source, the curve loops below so the line stays readable.
 */
export function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  if (x2 >= x1) {
    const dx = Math.max((x2 - x1) * 0.5, 50);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  }
  const midY = Math.max(y1, y2) + 90;
  return `M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x1 + 80} ${midY}, ${(x1 + x2) / 2} ${midY} S ${x2 - 80} ${y2}, ${x2} ${y2}`;
}
