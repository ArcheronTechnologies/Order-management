import type { Team } from "../engine/teams";

/**
 * Real clubs of the Swedish Allsvenskan (2026), split North/South. Ratings are an
 * approximate strength order (Stockholm Exiles were the 2025 champions); colours
 * are club-flavoured. Division 1 clubs are added with the season layer (M3).
 */
export const CLUBS: Team[] = [
  // --- North ---
  { name: "Stockholm Exiles RFC", short: "EXI", city: "Stockholm", tier: "allsvenskan", region: "north", rating: 16, reputation: 82, facilities: 4, university: true, colors: { primary: "#1f7a44", secondary: "#ffffff" } },
  { name: "Hammarby IF Rugby", short: "HAM", city: "Stockholm", tier: "allsvenskan", region: "north", rating: 14, reputation: 72, facilities: 4, university: true, colors: { primary: "#1ca64c", secondary: "#0a0a0a" } },
  { name: "Uppsala RFC", short: "UPP", city: "Uppsala", tier: "allsvenskan", region: "north", rating: 13, reputation: 66, facilities: 3, university: true, colors: { primary: "#13315c", secondary: "#c8a24a" } },
  { name: "Enköpings RK", short: "ENK", city: "Enköping", tier: "allsvenskan", region: "north", rating: 12, reputation: 60, facilities: 3, colors: { primary: "#1565c0", secondary: "#ffd233" } },
  { name: "Erikslunds KF", short: "ERK", city: "Täby", tier: "allsvenskan", region: "north", rating: 12, reputation: 58, facilities: 3, colors: { primary: "#b22222", secondary: "#0a0a0a" } },
  { name: "IKSU Rugby", short: "IKS", city: "Umeå", tier: "allsvenskan", region: "north", rating: 11, reputation: 54, facilities: 2, university: true, colors: { primary: "#ef7d00", secondary: "#0a0a0a" } },

  // --- South ---
  { name: "Göteborg RF", short: "GBG", city: "Göteborg", tier: "allsvenskan", region: "south", rating: 14, reputation: 73, facilities: 4, university: true, colors: { primary: "#1769aa", secondary: "#ffffff" } },
  { name: "Lugi Rugbyklubb", short: "LUG", city: "Lund", tier: "allsvenskan", region: "south", rating: 14, reputation: 71, facilities: 3, university: true, colors: { primary: "#7a1f3d", secondary: "#ffffff" } },
  { name: "Malmö RC", short: "MAL", city: "Malmö", tier: "allsvenskan", region: "south", rating: 13, reputation: 65, facilities: 3, university: true, colors: { primary: "#4aa3df", secondary: "#ffffff" } },
  { name: "Pingvin RC", short: "PIN", city: "Trelleborg", tier: "allsvenskan", region: "south", rating: 12, reputation: 59, facilities: 2, colors: { primary: "#0a0a0a", secondary: "#ffffff" } },
  { name: "Vänersborgs RK", short: "VAN", city: "Vänersborg", tier: "allsvenskan", region: "south", rating: 12, reputation: 57, facilities: 2, colors: { primary: "#2e7d32", secondary: "#ffffff" } },
  { name: "Spartacus RC", short: "SPA", city: "Partille", tier: "allsvenskan", region: "south", rating: 11, reputation: 53, facilities: 2, colors: { primary: "#c62828", secondary: "#0a0a0a" } },

  // ===== Division 1 (tier below the Allsvenskan) =====
  // --- North ---
  { name: "Attila RK", short: "ATT", city: "Norrköping", tier: "div1", region: "north", rating: 11, reputation: 48, facilities: 3, colors: { primary: "#0a3d62", secondary: "#f6b93b" } },
  { name: "Örebro RK", short: "ORE", city: "Örebro", tier: "div1", region: "north", rating: 10, reputation: 44, facilities: 2, colors: { primary: "#000000", secondary: "#e6b800" } },
  { name: "Västerås RK", short: "VST", city: "Västerås", tier: "div1", region: "north", rating: 10, reputation: 41, facilities: 2, colors: { primary: "#005bac", secondary: "#ffffff" } },
  { name: "Linköping RK", short: "LIN", city: "Linköping", tier: "div1", region: "north", rating: 9, reputation: 39, facilities: 2, university: true, colors: { primary: "#1b5e20", secondary: "#cddc39" } },
  { name: "Gävle RK", short: "GAV", city: "Gävle", tier: "div1", region: "north", rating: 9, reputation: 35, facilities: 1, colors: { primary: "#8e24aa", secondary: "#ffffff" } },
  { name: "Södertälje RK", short: "SOD", city: "Södertälje", tier: "div1", region: "north", rating: 8, reputation: 31, facilities: 1, colors: { primary: "#d84315", secondary: "#0a0a0a" } },

  // --- South ---
  { name: "Trojan RC", short: "TRO", city: "Kungsbacka", tier: "div1", region: "south", rating: 11, reputation: 47, facilities: 3, colors: { primary: "#283593", secondary: "#c62828" } },
  { name: "Halmstad RK", short: "HMS", city: "Halmstad", tier: "div1", region: "south", rating: 10, reputation: 43, facilities: 2, colors: { primary: "#0277bd", secondary: "#ffeb3b" } },
  { name: "Jönköping RK", short: "JON", city: "Jönköping", tier: "div1", region: "south", rating: 10, reputation: 40, facilities: 2, university: true, colors: { primary: "#00695c", secondary: "#ffffff" } },
  { name: "Helsingborg RK", short: "HBG", city: "Helsingborg", tier: "div1", region: "south", rating: 9, reputation: 37, facilities: 2, colors: { primary: "#c2185b", secondary: "#0a0a0a" } },
  { name: "Kalmar RK", short: "KAL", city: "Kalmar", tier: "div1", region: "south", rating: 9, reputation: 34, facilities: 1, colors: { primary: "#ef6c00", secondary: "#1b5e20" } },
  { name: "Borås RK", short: "BOR", city: "Borås", tier: "div1", region: "south", rating: 8, reputation: 30, facilities: 1, colors: { primary: "#4527a0", secondary: "#ffd600" } },
];

export function clubByShort(short: string): Team | undefined {
  return CLUBS.find((c) => c.short === short);
}
