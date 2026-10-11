import { getNextPageParam } from "./pagination";
import { Paginated } from "../types";

// Phase 4 (itération 81) — première suite de tests unitaires mobile
// (voir mobile/README.md, section Tests). Couvre la logique extraite de
// students.ts/personnel.ts (Phase 2d) : avancer tant qu'il reste des pages,
// s'arrêter sur la dernière — y compris les cas limites (une seule page,
// page courante = totalPages).
function page(current: number, totalPages: number): Paginated<unknown> {
  return {
    data: [],
    pagination: { page: current, pageSize: 20, total: totalPages * 20, totalPages },
  };
}

describe("getNextPageParam", () => {
  it("avance à la page suivante tant que page < totalPages", () => {
    expect(getNextPageParam(page(1, 3))).toBe(2);
    expect(getNextPageParam(page(2, 3))).toBe(3);
  });

  it("s'arrête (undefined) sur la dernière page", () => {
    expect(getNextPageParam(page(3, 3))).toBeUndefined();
  });

  it("s'arrête dès la première page quand il n'y en a qu'une seule", () => {
    expect(getNextPageParam(page(1, 1))).toBeUndefined();
  });
});
