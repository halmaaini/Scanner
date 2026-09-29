/**
 * Saves text as a file. The byte-order mark makes Excel read the file as
 * UTF-8, which matters for Arabic names.
 */
export function downloadTextFile(
  filename: string,
  text: string,
  type = "text/csv;charset=utf-8",
): void {
  const url = URL.createObjectURL(new Blob(["\ufeff", text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
