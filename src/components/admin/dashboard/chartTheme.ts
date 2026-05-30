export const getChartTheme = (darkMode: boolean) => ({
  grid: darkMode ? "#334155" : "#e2e8f0",
  axis: darkMode ? "#94a3b8" : "#64748b",
  tooltipBg: darkMode ? "#0f172a" : "#ffffff",
  tooltipBorder: darkMode ? "#334155" : "#e2e8f0",
  tooltipText: darkMode ? "#f1f5f9" : "#0f172a",
  primary: "#d6841e",
  primaryFill: darkMode ? "rgba(214, 132, 30, 0.25)" : "rgba(214, 132, 30, 0.15)",
  bar: darkMode ? "#e1a233" : "#d6841e",
  donut: {
    due: "#f59e0b",
    pending: "#3b82f6",
    paid: "#10b981",
  },
});

export const formatChartCurrency = (value: number) => {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
  return `₹${value}`;
};
