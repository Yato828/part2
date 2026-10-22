/** Fixed decimal labels: tiny token prices must not collapse to $0.00. */
export function chartPrecision(price: number) {
  if (!Number.isFinite(price) || price <= 0) return 2;
  return Math.max(2, Math.min(12, 5 - Math.floor(Math.log10(price))));
}
export function chartPrice(price: number, precision = chartPrecision(Math.abs(price))) {
  if (!Number.isFinite(price)) return "—";
  if (price !== 0 && Math.abs(price) < 1e-12) return "$" + price.toExponential(3);
  return "$" + price.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
    useGrouping: Math.abs(price) >= 1000,
  });
}
