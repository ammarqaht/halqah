export const cx = (...v: (string | false | null | undefined)[]) => v.filter(Boolean).join(' ');
