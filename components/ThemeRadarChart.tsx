type ThemePoint = { theme: string; average?: number | null };
type ThemeSeries = { label: string; color: string; values: ThemePoint[] };

type Props = {
  themes: string[];
  series: ThemeSeries[];
  max?: number;
};

function polarPoint(index: number, total: number, radius: number, center: number) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
}

function polygonPoints(themes: string[], values: ThemePoint[], max: number, center: number, radius: number) {
  return themes.map((theme, index) => {
    const value = values.find((item) => item.theme === theme)?.average ?? 0;
    const point = polarPoint(index, themes.length, radius * Math.max(0, Math.min(max, value)) / max, center);
    return point.x.toFixed(1) + "," + point.y.toFixed(1);
  }).join(" ");
}

function labelForTheme(theme: string) {
  return theme.length > 8 ? theme.slice(0, 8) + "…" : theme;
}

export function ThemeRadarChart({ themes, series, max = 5 }: Props) {
  const size = 360;
  const center = size / 2;
  const radius = 118;
  const rings = [1, 2, 3, 4, 5];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox="0 0 360 390" className="mx-auto h-auto w-full max-w-[440px]" role="img" aria-label="評価レーダーチャート">
        <g>
          {rings.map((ring) => (
            <polygon key={ring} points={themes.map((_, index) => {
              const point = polarPoint(index, themes.length, radius * ring / max, center);
              return point.x.toFixed(1) + "," + point.y.toFixed(1);
            }).join(" ")} fill="none" stroke="#dbe5e1" strokeWidth="1" />
          ))}
          {themes.map((_, index) => {
            const end = polarPoint(index, themes.length, radius, center);
            return <line key={index} x1={center} y1={center} x2={end.x} y2={end.y} stroke="#dbe5e1" strokeWidth="1" />;
          })}
          {series.map((entry) => (
            <g key={entry.label}>
              <polygon points={polygonPoints(themes, entry.values, max, center, radius)} fill={entry.color} fillOpacity="0.16" stroke={entry.color} strokeWidth="3" />
              <polygon points={polygonPoints(themes, entry.values, max, center, radius)} fill="none" stroke={entry.color} strokeWidth="3" />
            </g>
          ))}
          {themes.map((theme, index) => {
            const point = polarPoint(index, themes.length, radius + 34, center);
            return <text key={theme} x={point.x} y={point.y} textAnchor="middle" dominantBaseline="middle" className="fill-slate-700 text-[12px] font-bold">{labelForTheme(theme)}</text>;
          })}
        </g>
        <g transform="translate(20 350)">
          {series.map((entry, index) => (
            <g key={entry.label} transform={"translate(" + index * 118 + " 0)"}>
              <rect width="14" height="14" rx="3" fill={entry.color} />
              <text x="20" y="12" className="fill-slate-700 text-[12px] font-bold">{entry.label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
