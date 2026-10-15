export interface Rect { x: number; y: number; width: number; height: number }
export interface ComparisonLayout { pair: Rect; text: Rect; logWidth: number; compact: boolean; soloOffset: number }
const ratio = 1470 / 3000;

export function comparisonLayout(width: number, height: number, logProgress: number): ComparisonLayout {
  const compact = width < 960;
  const gap = compact ? 12 : 20;
  const caption = 36;
  if (compact) {
    // Reserve the same upper slot for one or two phones. Copy gets the
    // remaining space below it, including its fixed navigation controls.
    const phoneArea = Math.min(height * .5, Math.max(116, height - 260));
    const phoneWidth = Math.min((width - gap) / 2, (phoneArea - caption) * ratio);
    const pairWidth = phoneWidth * 2 + gap;
    const pairHeight = phoneWidth / ratio + caption;
    const textTop = 12 + pairHeight + 24;
    return {
      pair: { x: (width - pairWidth) / 2, y: 12, width: pairWidth, height: pairHeight },
      text: { x: 0, y: textTop, width, height: height - textTop - 16 },
      logWidth: width, compact, soloOffset: -(phoneWidth + gap) / 2,
    };
  }
  const phoneWidth = Math.min(300, (width * .53 - gap) / 2, (height - 84) * ratio);
  const pairWidth = phoneWidth * 2 + gap;
  const pairHeight = phoneWidth / ratio + caption;
  const copyWidth = Math.min(520, width - pairWidth - 64);
  return {
    pair: { x: (width - pairWidth) * logProgress, y: Math.max(20, (height - pairHeight) / 2), width: pairWidth, height: pairHeight },
    text: { x: width - copyWidth, y: 64, width: copyWidth, height: height - 128 },
    logWidth: width - pairWidth - 64, compact, soloOffset: -(phoneWidth + gap) / 2,
  };
}
