// Save a text file. Phones (iOS home-screen apps especially) can't always download a file, so
// they get the share sheet ("Save to Files"); everywhere else, a normal download.
// Resolves false if the person closed the share sheet without saving.
export async function saveTextFile(name: string, text: string, type = "text/plain"): Promise<boolean> {
  const file = new File([text], name, { type });
  const touch = matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return false;
      throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

// "cube-timer-main-2026-11-12.txt": a safe file name from a label and today's date.
export function exportFileName(label?: string, ext = "txt"): string {
  const slug = (label ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `cube-timer-${slug ? slug + "-" : ""}${new Date().toISOString().slice(0, 10)}.${ext}`;
}
