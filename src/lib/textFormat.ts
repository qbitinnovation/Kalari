export function toDisplayTitle(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return fallback;

  return text
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (/^[A-Z]{2,}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function toDisplayInitial(value: unknown, fallback = "A") {
  return toDisplayTitle(value, fallback).charAt(0).toUpperCase();
}
