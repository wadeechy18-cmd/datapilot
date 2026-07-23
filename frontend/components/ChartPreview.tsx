// Local, client-side chart approximation shown before a native Excel chart is
// committed server-side (the reader endpoint has no way to reflect an embedded
// chart object at all, so this is drawn from the same preview data the form
// is pointed at). Colors are the validated dark-mode categorical palette from
// the dataviz skill (references/palette.md), checked with
// scripts/validate_palette.js --mode dark --surface #1a1a19 (all checks pass).
const SERIES_1 = "#3987e5";
const CATEGORICAL = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const GRIDLINE = "#2c2c2a";
const AXIS = "#383835";
const MUTED = "#898781";

const WIDTH = 360;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 16 };

export type ChartPreviewData =
  | { kind: "categorical"; chartType: "bar" | "line" | "area"; categories: string[]; values: number[] }
  | { kind: "pie"; categories: string[]; values: number[] }
  | { kind: "scatter"; xValues: number[]; yValues: number[] };

function formatLabel(value: string, max = 10): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function CategoricalChart({
  chartType,
  categories,
  values,
}: {
  chartType: "bar" | "line" | "area";
  categories: string[];
  values: number[];
}) {
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);
  const span = maxValue - minValue || 1;

  const xFor = (i: number) => PAD.left + (values.length === 1 ? plotWidth / 2 : (i / (values.length - 1)) * plotWidth);
  const yFor = (v: number) => PAD.top + plotHeight - ((v - minValue) / span) * plotHeight;
  const baselineY = yFor(0);

  const points = values.map((v, i) => [xFor(i), yFor(v)] as const);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full">
      <line x1={PAD.left} y1={baselineY} x2={WIDTH - PAD.right} y2={baselineY} stroke={AXIS} strokeWidth={1} />

      {chartType === "bar"
        ? points.map(([x, y], i) => {
            const barWidth = Math.min(36, plotWidth / values.length - 8);
            return (
              <rect
                key={i}
                x={x - barWidth / 2}
                y={Math.min(y, baselineY)}
                width={barWidth}
                height={Math.abs(baselineY - y)}
                rx={2}
                fill={SERIES_1}
              />
            );
          })
        : null}

      {chartType === "area" ? (
        <polygon
          points={[`${PAD.left},${baselineY}`, ...points.map(([x, y]) => `${x},${y}`), `${WIDTH - PAD.right},${baselineY}`].join(
            " "
          )}
          fill={SERIES_1}
          fillOpacity={0.25}
          stroke="none"
        />
      ) : null}

      {chartType === "line" || chartType === "area" ? (
        <polyline points={points.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke={SERIES_1} strokeWidth={2} />
      ) : null}
      {chartType === "line" || chartType === "area"
        ? points.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill={SERIES_1} />)
        : null}

      {categories.map((label, i) => (
        <text key={i} x={xFor(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={9} fill={MUTED}>
          {formatLabel(label)}
        </text>
      ))}
    </svg>
  );
}

function PieChart({ categories, values }: { categories: string[]; values: number[] }) {
  const total = values.reduce((sum, v) => sum + Math.max(v, 0), 0) || 1;
  const cx = 70;
  const cy = HEIGHT / 2;
  const r = 60;

  let angle = -90;
  const slices = values.map((v, i) => {
    const fraction = Math.max(v, 0) / total;
    const startAngle = angle;
    const endAngle = angle + fraction * 360;
    angle = endAngle;

    const toXY = (deg: number) => {
      const rad = (deg * Math.PI) / 180;
      return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
    };
    const [x1, y1] = toXY(startAngle);
    const [x2, y2] = toXY(endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return {
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: CATEGORICAL[i % CATEGORICAL.length],
    };
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full max-w-[220px]">
        {slices.map((slice, i) => (
          <path key={i} d={slice.path} fill={slice.color} stroke="#0f172a" strokeWidth={1} />
        ))}
      </svg>
      <ul className="space-y-1 text-xs text-slate-300">
        {categories.slice(0, 8).map((label, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: CATEGORICAL[i % CATEGORICAL.length] }} />
            {formatLabel(label, 14)} ({values[i]})
          </li>
        ))}
        {categories.length > 8 ? <li className="text-slate-500">+{categories.length - 8} more</li> : null}
      </ul>
    </div>
  );
}

function ScatterChart({ xValues, yValues }: { xValues: number[]; yValues: number[] }) {
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const xFor = (v: number) => PAD.left + ((v - minX) / spanX) * plotWidth;
  const yFor = (v: number) => PAD.top + plotHeight - ((v - minY) / spanY) * plotHeight;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full">
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={HEIGHT - PAD.bottom} stroke={GRIDLINE} strokeWidth={1} />
      <line
        x1={PAD.left}
        y1={HEIGHT - PAD.bottom}
        x2={WIDTH - PAD.right}
        y2={HEIGHT - PAD.bottom}
        stroke={AXIS}
        strokeWidth={1}
      />
      {xValues.map((x, i) => (
        <circle key={i} cx={xFor(x)} cy={yFor(yValues[i])} r={4} fill={SERIES_1} />
      ))}
    </svg>
  );
}

export function ChartPreview({ data }: { data: ChartPreviewData }) {
  if (data.kind === "pie") return <PieChart categories={data.categories} values={data.values} />;
  if (data.kind === "scatter") return <ScatterChart xValues={data.xValues} yValues={data.yValues} />;
  return <CategoricalChart chartType={data.chartType} categories={data.categories} values={data.values} />;
}
