export function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 3) | 8;
    return v.toString(16);
  });
}

export function formatCount(value?: number) {
  if (value === undefined) return "";
  if (value >= 1000000) return (value / 1000000).toFixed(value >= 10000000 ? 0 : 1) + "M";
  if (value >= 1000) return (value / 1000).toFixed(value >= 100000 ? 0 : 1) + "K";
  return String(value);
}
