/**
 * The address of a student's card. The ID is encoded twice because the router
 * decodes the address once before it hands out the parts, and one round of
 * decoding leaves `/`, `?`, `#` and friends encoded (and would mangle a `%`):
 * with two, an ID with any of them comes back exactly as typed.
 */
export const cardPath = (studentId: string) =>
  `/card/${encodeURIComponent(encodeURIComponent(studentId))}`;

/**
 * The student ID in a card address's parameter (what `cardPath` made, after the
 * router's decoding). Also reads a link that was encoded only once; an ID that
 * is not valid encoding is taken as it is.
 */
export function studentIdFromParam(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}
