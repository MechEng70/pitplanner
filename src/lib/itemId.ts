// Ids for the foods on a plan. An id only has to differ from the others on the plan and from ids used
// before (alarm keys and history carry them), so it is the time it was made, plus a counter when two are
// made in the same millisecond. Pure: the time is passed in.
export function newItemId(inUse: readonly string[], now: number): string {
  const base = `i${now.toString(36)}`;
  let id = base;
  for (let n = 1; inUse.includes(id); n++) id = `${base}${n.toString(36).padStart(2, '0')}x`;
  return id;
}
