// Intake / academic-year choices for a student, e.g. "2026-2027".
// `current` is the value already saved on the student: older records hold a
// single year such as "2026", so it is always kept in the list.
export function intakeYearOptions(current = '') {
  const y = new Date().getFullYear();
  const list = [];
  for (let start = y - 2; start <= y + 3; start++) list.push(`${start}-${start + 1}`);
  const all = current && !list.includes(String(current)) ? [...list, String(current)] : list;
  return all.sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.length - b.length);
}
