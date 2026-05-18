export type ArenaSide = "top" | "right" | "bottom" | "left";

export const ARENA_TOP_LABEL = "All eyes over here";

/** Row 1 = closest to center (7 seats), then increasing outward. */
export const DEFAULT_ARENA_ROW_CONFIG: { seats: number }[] = [{ seats: 7 }, { seats: 10 }, { seats: 10 }];

export const DEFAULT_ARENA_SECTIONS = [
  { name: "North", rows: [...DEFAULT_ARENA_ROW_CONFIG] },
  { name: "East", rows: [...DEFAULT_ARENA_ROW_CONFIG] },
  { name: "South", rows: [...DEFAULT_ARENA_ROW_CONFIG] },
  { name: "West", rows: [...DEFAULT_ARENA_ROW_CONFIG] },
];

const SECTION_TO_SIDE: Record<string, ArenaSide> = {
  north: "top",
  front: "top",
  top: "top",
  east: "right",
  right: "right",
  south: "bottom",
  back: "bottom",
  bottom: "bottom",
  west: "left",
  left: "left",
};

const LEGACY_SECTION_ORDER: ArenaSide[] = ["top", "right", "bottom", "left"];

export function getArenaSideForSection(sectionName: string): ArenaSide | null {
  return SECTION_TO_SIDE[sectionName.trim().toLowerCase()] ?? null;
}

export function isArenaLayout(sections: { name?: string }[] = []): boolean {
  return sections.some((section) => getArenaSideForSection(String(section.name || "")) !== null);
}

export function getDefaultArenaStructure(): {
  sections: { name: string; rows: { seats: number; rowNumber?: number }[] }[];
  blockedSeats: string[];
} {
  return {
    sections: DEFAULT_ARENA_SECTIONS.map((section) => ({
      name: section.name,
      rows: section.rows.map((row, index) => ({ rowNumber: index + 1, seats: row.seats })),
    })),
    blockedSeats: [],
  };
}

/** First row in data is nearest the arena center; flip order on top so 7 seats sit by the stage. */
export function orderRowsForArenaSide<T>(rows: T[][], side: ArenaSide): T[][] {
  if (rows.length === 0) return rows;
  if (side === "top") return [...rows].reverse();
  return rows;
}

export function alignClassForArenaSide(side: ArenaSide): string {
  if (side === "left") return "justify-end";
  if (side === "right") return "justify-start";
  return "justify-center";
}

export function arrowForArenaSide(side: ArenaSide): string {
  if (side === "top") return "↓";
  if (side === "bottom") return "↑";
  if (side === "left") return "→";
  if (side === "right") return "←";
  return "";
}

export function groupSeatsByArenaSide<T extends { section: string; row: string }>(
  seats: T[],
  getRowsForSection: (section: string) => Record<string, T[]>
): Record<ArenaSide, T[][]> {
  const grouped: Record<ArenaSide, T[][]> = { top: [], right: [], bottom: [], left: [] };
  const sectionNames = Array.from(new Set(seats.map((seat) => seat.section)));

  sectionNames.forEach((sectionName) => {
    const side = getArenaSideForSection(sectionName);
    if (!side) return;

    const rowMap = getRowsForSection(sectionName);
    const rowLetters = Object.keys(rowMap).sort();
    const rows = rowLetters.map((letter) => rowMap[letter] || []);
    grouped[side] = orderRowsForArenaSide(rows, side);
  });

  const unmappedSections = sectionNames.filter((name) => !getArenaSideForSection(name));
  unmappedSections.forEach((sectionName, index) => {
    const side = LEGACY_SECTION_ORDER[index];
    if (!side || grouped[side].length > 0) return;

    const rowMap = getRowsForSection(sectionName);
    const rowLetters = Object.keys(rowMap).sort();
    const rows = rowLetters.map((letter) => rowMap[letter] || []);
    grouped[side] = orderRowsForArenaSide(rows, side);
  });

  return grouped;
}
