/** Current page URL without the hash. */
export function pageUrl(): string {
  return window.location.href.split('#')[0] ?? '';
}

/** Replaces the URL hash without adding a history entry or firing hashchange. */
export function setUrlHash(code: string | null): void {
  const url = code ? `${pageUrl()}#${code}` : pageUrl();
  if (url !== window.location.href) window.history.replaceState(null, '', url);
}

export function downloadTextFile(fileName: string, text: string, mimeType = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers or contexts without the async clipboard API.
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }
}
