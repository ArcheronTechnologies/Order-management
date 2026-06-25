import type { Team } from "../engine/teams";

/**
 * Real clubs of the Swedish Allsvenskan (2026), split North/South. Ratings are an
 * approximate strength order (Stockholm Exiles were the 2025 champions); colours
 * are club-flavoured. Division 1 clubs are added with the season layer (M3).
 */
export const CLUBS: Team[] = [
  // --- North ---
  { name: "Stockholm Exiles RFC", short: "EXI", city: "Stockholm", tier: "allsvenskan", region: "north", rating: 16, colors: { primary: "#1f7a44", secondary: "#ffffff" } },
  { name: "Hammarby IF Rugby", short: "HAM", city: "Stockholm", tier: "allsvenskan", region: "north", rating: 14, colors: { primary: "#1ca64c", secondary: "#0a0a0a" } },
  { name: "Uppsala RFC", short: "UPP", city: "Uppsala", tier: "allsvenskan", region: "north", rating: 13, colors: { primary: "#13315c", secondary: "#c8a24a" } },
  { name: "Enköpings RK", short: "ENK", city: "Enköping", tier: "allsvenskan", region: "north", rating: 12, colors: { primary: "#1565c0", secondary: "#ffd233" } },
  { name: "Erikslunds KF", short: "ERK", city: "Täby", tier: "allsvenskan", region: "north", rating: 12, colors: { primary: "#b22222", secondary: "#0a0a0a" } },
  { name: "IKSU Rugby", short: "IKS", city: "Umeå", tier: "allsvenskan", region: "north", rating: 11, colors: { primary: "#ef7d00", secondary: "#0a0a0a" } },

  // --- South ---
  { name: "Göteborg RF", short: "GBG", city: "Göteborg", tier: "allsvenskan", region: "south", rating: 14, colors: { primary: "#1769aa", secondary: "#ffffff" } },
  { name: "Lugi Rugbyklubb", short: "LUG", city: "Lund", tier: "allsvenskan", region: "south", rating: 14, colors: { primary: "#7a1f3d", secondary: "#ffffff" } },
  { name: "Malmö RC", short: "MAL", city: "Malmö", tier: "allsvenskan", region: "south", rating: 13, colors: { primary: "#4aa3df", secondary: "#ffffff" } },
  { name: "Pingvin RC", short: "PIN", city: "Trelleborg", tier: "allsvenskan", region: "south", rating: 12, colors: { primary: "#0a0a0a", secondary: "#ffffff" } },
  { name: "Vänersborgs RK", short: "VAN", city: "Vänersborg", tier: "allsvenskan", region: "south", rating: 12, colors: { primary: "#2e7d32", secondary: "#ffffff" } },
  { name: "Spartacus RC", short: "SPA", city: "Partille", tier: "allsvenskan", region: "south", rating: 11, colors: { primary: "#c62828", secondary: "#0a0a0a" } },
];

export function clubByShort(short: string): Team | undefined {
  return CLUBS.find((c) => c.short === short);
}
