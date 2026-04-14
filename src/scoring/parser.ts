import type { Labels, MetricSample } from "./types";

export function parseLabels(rawLabels?: string): Labels {
  const labels: Labels = {};
  if (!rawLabels) return labels;

  const pairRegex = /(\w+)="((?:\\.|[^"])*)"/g;
  let match: RegExpExecArray | null = pairRegex.exec(rawLabels);
  while (match) {
    const [, key, value] = match;
    if (!key || value === undefined) {
      match = pairRegex.exec(rawLabels);
      continue;
    }

    labels[key] = value.replace(/\\"/g, '"');
    match = pairRegex.exec(rawLabels);
  }
  return labels;
}

export function parseMetrics(metricsText: string): MetricSample[] {
  const lineRegex =
    /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)$/;
  const samples: MetricSample[] = [];

  for (const rawLine of metricsText.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(lineRegex);
    if (!match) continue;

    const [, name, rawLabels = "", rawValue] = match;
    if (!name || rawValue === undefined) continue;

    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;

    samples.push({ name, labels: parseLabels(rawLabels), value });
  }

  return samples;
}

export function selectMetric(
  samples: MetricSample[],
  metricName: string,
  labels: Labels,
): number {
  const sample = samples.find((item) => {
    if (item.name !== metricName) return false;
    return Object.entries(labels).every(([key, value]) => item.labels[key] === value);
  });
  return sample?.value ?? 0;
}
