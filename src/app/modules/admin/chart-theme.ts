/** Shared emerald chart theme for admin dashboard / reports */

export const BMS_CHART_COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  teal: '#14b8a6',
  cyan: '#22d3ee',
  amber: '#f59e0b',
  rose: '#f43f5e',
  violet: '#8b5cf6',
  slate: '#64748b',
  sky: '#0ea5e9'
};

export const BMS_PALETTE = [
  BMS_CHART_COLORS.emerald,
  BMS_CHART_COLORS.teal,
  BMS_CHART_COLORS.cyan,
  BMS_CHART_COLORS.amber,
  BMS_CHART_COLORS.violet,
  BMS_CHART_COLORS.sky,
  BMS_CHART_COLORS.rose
];

export function isDarkTheme(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

export function baseChartOptions(partial: Record<string, any> = {}): any {
  const dark = isDarkTheme();
  const chart = {
    fontFamily: 'Source Sans 3, Segoe UI, system-ui, sans-serif',
    foreColor: dark ? '#a7f3d0' : '#334155',
    toolbar: {
      show: true,
      tools: {
        download: true,
        selection: false,
        zoom: false,
        zoomin: false,
        zoomout: false,
        pan: false,
        reset: false
      }
    },
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 900,
      animateGradually: { enabled: true, delay: 120 },
      dynamicAnimation: { enabled: true, speed: 400 }
    },
    background: 'transparent',
    ...(partial['chart'] || {})
  };

  return {
    ...partial,
    chart,
    colors: partial['colors'] || BMS_PALETTE,
    grid: {
      borderColor: dark ? '#1f3d32' : '#e2e8f0',
      strokeDashArray: 4,
      ...(partial['grid'] || {})
    },
    dataLabels: { enabled: false, ...(partial['dataLabels'] || {}) },
    stroke: { curve: 'smooth', width: 3, ...(partial['stroke'] || {}) },
    legend: {
      labels: { colors: dark ? '#a7f3d0' : '#475569' },
      ...(partial['legend'] || {})
    },
    tooltip: {
      theme: dark ? 'dark' : 'light',
      ...(partial['tooltip'] || {})
    }
  };
}

export function lastNMonthsLabels(n = 6): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleString('en-US', { month: 'short' }));
  }
  return labels;
}

export function countByMonth(dates: (string | Date | undefined | null)[], n = 6): number[] {
  const now = new Date();
  const buckets = Array.from({ length: n }, () => 0);
  dates.forEach((raw) => {
    if (!raw) return;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return;
    for (let i = 0; i < n; i++) {
      const m = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
      if (d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth()) {
        buckets[i]++;
        break;
      }
    }
  });
  return buckets;
}
