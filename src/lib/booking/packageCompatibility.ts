/**
 * Package ↔ class compatibility for self-booked group classes.
 *
 * Single source of truth shared by:
 *   - the reservations POST validator (validatePackageAllowsClass), and
 *   - GET /api/user/bookable-purchases.
 *
 * Rules (mirrors the original validatePackageAllowsClass):
 *   1. Private packages (isPrivate) can never self-book group classes.
 *   2. If a package lists disciplines explicitly, the class discipline must be
 *      in that list. An empty list means unrestricted.
 */
export type PackageClassCompatibility =
  | 'OK'
  | 'PRIVATE_ONLY'
  | 'DISCIPLINE_NOT_COVERED'

export interface PackageForCompatibility {
  isPrivate: boolean
  disciplines: { disciplineId: string }[]
}

export function checkPackageClassCompatibility(
  pkg: PackageForCompatibility,
  classDisciplineId: string
): PackageClassCompatibility {
  if (pkg.isPrivate) return 'PRIVATE_ONLY'

  if (pkg.disciplines.length > 0) {
    const allowed = new Set(pkg.disciplines.map((d) => d.disciplineId))
    if (!allowed.has(classDisciplineId)) return 'DISCIPLINE_NOT_COVERED'
  }

  return 'OK'
}

export function isPackageCompatibleWithClass(
  pkg: PackageForCompatibility,
  classDisciplineId: string
): boolean {
  return checkPackageClassCompatibility(pkg, classDisciplineId) === 'OK'
}
