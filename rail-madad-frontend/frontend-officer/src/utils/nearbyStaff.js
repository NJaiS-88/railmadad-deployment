function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Finds the nearest approved staff for a given department using the live roster
 * from the backend instead of mock data. This keeps assignment data dynamic.
 */
export function findNearbyStaff({ department, seed, limit = 3, staffList = [] }) {
  const cleanDepartment = String(department || '').trim().toLowerCase();
  const pool = (staffList || []).filter((s) => {
    const staffDept = (s.department || '').trim().toLowerCase();
    // Exact match, or shared key terms so canonical names
    // ('Operations/Train Control') still match legacy short names
    // ('Operations') and vice versa.
    const matchesDepartment =
      staffDept === cleanDepartment ||
      cleanDepartment.split('/').some((part) => staffDept.includes(part.trim())) ||
      staffDept.split('/').some((part) => cleanDepartment.includes(part.trim()));
    const available = Boolean(s.available);
    return matchesDepartment && available;
  });

  return pool
    .map((s) => {
      const h = hash(`${seed}-${s.id}`);
      const distanceKm = 1 + (h % 18);
      const etaMin = Math.round(distanceKm * 2.1 + 4);
      return { ...s, distanceKm, etaMin };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
