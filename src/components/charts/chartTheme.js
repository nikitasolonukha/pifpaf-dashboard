export const CHART = {
  axis: '#9A928E',
  grid: '#F0EEEC',
  pink: '#F3C9D4',
  pinkDark: '#E8A8B8',
  lavender: '#C9B8E8',
  peach: '#E8C4A8',
  sage: '#B8D4BC',
  tooltipBg: '#FFFFFF',
  tooltipBorder: 'rgba(25, 23, 22, 0.08)',
};

export function sparseTicks(data, maxTicks = 6) {
  if (!data?.length) return [];
  if (data.length <= maxTicks) return data.map((_, i) => i);
  const step = Math.ceil(data.length / maxTicks);
  const indices = [];
  for (let i = 0; i < data.length; i += step) indices.push(i);
  if (indices[indices.length - 1] !== data.length - 1) indices.push(data.length - 1);
  return indices;
}
