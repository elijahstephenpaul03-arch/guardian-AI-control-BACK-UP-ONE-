import React from "react";
import { ExternalLink } from "lucide-react";

/**
 * Normalizes a URL so that it is guaranteed to have a valid protocol (https://)
 * and strips trailing stray punctuation (like . , ) ] ; ) that often get captured
 * when users or models paste links into chat.
 */
export function ensureAbsoluteUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  let clean = rawUrl.trim();
  // Strip trailing punctuation
  clean = clean.replace(/[.,;:!?)\]]+$/, "");

  // If it starts with standard protocols, return clean
  if (/^https?:\/\//i.test(clean) || /^mailto:/i.test(clean)) {
    return clean;
  }

  // If it starts with www. or looks like domain.tld
  return `https://${clean}`;
}

/**
 * Checks if a string looks like a web URL or domain name.
 */
export function isWebUrlOrDomain(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  // Domain with valid TLD pattern
  return /^[a-zA-Z0-9.-]+\.(com|org|net|edu|gov|io|ai|co|ru|xyz|app|dev|me|uk|ca|de|fr|info|online)(\/[^\s]*)?$/i.test(trimmed);
}

/**
 * Robustly opens an external link in a new browser tab/window,
 * preserving native browser anchor click behavior and handling
 * iframe sandbox restrictions without blocking.
 */
export function openExternalLink(rawUrl: string, e?: React.MouseEvent | any): boolean {
  const destination = ensureAbsoluteUrl(rawUrl);
  if (!destination) return false;

  // CRITICAL: If this event was dispatched on an anchor tag (<a>), do NOT preventDefault!
  // Allowing native anchor tag navigation with target="_blank" and rel="noopener noreferrer"
  // is the most reliable way to open links in all browsers, mobile devices, and iframe sandboxes.
  const targetTag = (e?.currentTarget?.tagName || e?.target?.tagName || "").toUpperCase();
  if (targetTag === "A") {
    // Native browser click handler will open the destination in a new tab
    return true;
  }

  if (e && typeof e.stopPropagation === "function") {
    e.stopPropagation();
  }

  try {
    const newWin = window.open(destination, "_blank", "noopener,noreferrer");
    if (newWin && !newWin.closed) {
      return true;
    }
  } catch (err) {
    console.warn("Guardian AI: window.open blocked by environment:", err);
  }

  // Fallback: create an anchor element, set attributes, and trigger click
  try {
    const a = document.createElement("a");
    a.href = destination;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (err) {
    console.warn("Guardian AI: fallback anchor click failed:", err);
    return false;
  }
}

/**
 * Copies a link to clipboard with modern API and fallback support.
 */
export async function copyLinkToClipboard(rawUrl: string): Promise<boolean> {
  const destination = ensureAbsoluteUrl(rawUrl);
  if (!destination) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(destination);
      return true;
    }
  } catch {
    // Fallback to execCommand
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = destination;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

/**
 * Extracts all web URLs and markdown links from any text string.
 */
export function extractUrlsFromText(text: string): { label: string; url: string }[] {
  if (!text) return [];
  const results: { label: string; url: string }[] = [];
  const seen = new Set<string>();

  // 1. Markdown links: [label](url)
  const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s)]*)\)/g;
  let mdMatch: RegExpExecArray | null;
  while ((mdMatch = mdRegex.exec(text)) !== null) {
    const label = mdMatch[1].trim();
    const url = ensureAbsoluteUrl(mdMatch[2]);
    if (url && !seen.has(url)) {
      seen.add(url);
      results.push({ label, url });
    }
  }

  // 2. Raw URLs: https?://...
  const rawRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  let rawMatch: RegExpExecArray | null;
  while ((rawMatch = rawRegex.exec(text)) !== null) {
    const url = ensureAbsoluteUrl(rawMatch[1]);
    if (url && !seen.has(url)) {
      seen.add(url);
      const displayLabel = rawMatch[1].replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
      results.push({ label: displayLabel, url });
    }
  }

  return results;
}

/**
 * Parses a string of text containing markdown links `[label](url)` and raw URLs
 * (`https://...` or `http://...`) and converts them into interactive, accessible,
 * clickable links that open safely in a new tab.
 */
export function renderTextWithLinks(
  text: string,
  linkClass?: string,
  keyPrefix: string = "link"
): React.ReactNode[] {
  if (!text) return [];

  // Combined regex matching markdown links [text](url) OR raw URLs https?://...
  const combinedRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s)]*)\))|(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(text)) !== null) {
    // Push preceding text if any
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    if (match[1]) {
      // Markdown link: [text](url)
      const label = match[2];
      const rawUrl = match[3];
      const safeUrl = ensureAbsoluteUrl(rawUrl);

      elements.push(
        <a
          key={`${keyPrefix}-md-${match.index}`}
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={
            linkClass ||
            "inline-flex items-center gap-1 font-bold text-teal-400 hover:text-teal-300 underline underline-offset-2 hover:underline-offset-4 transition-all duration-200 cursor-pointer break-all"
          }
          title={`Open ${label} (${safeUrl}) in new tab`}
        >
          <span>{label}</span>
          <ExternalLink className="h-3 w-3 inline-block shrink-0 opacity-80" />
        </a>
      );
    } else if (match[4]) {
      // Raw URL: https?://...
      const rawUrl = match[4];
      const safeUrl = ensureAbsoluteUrl(rawUrl);
      const displayUrl = rawUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

      elements.push(
        <a
          key={`${keyPrefix}-raw-${match.index}`}
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={
            linkClass ||
            "inline-flex items-center gap-1 font-bold text-teal-400 hover:text-teal-300 underline underline-offset-2 hover:underline-offset-4 transition-all duration-200 cursor-pointer break-all font-mono text-[11px]"
          }
          title={`Open ${safeUrl} in new tab`}
        >
          <span>{displayUrl}</span>
          <ExternalLink className="h-3 w-3 inline-block shrink-0 opacity-80" />
        </a>
      );
    }

    lastIndex = combinedRegex.lastIndex;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements.length > 0 ? elements : [text];
}
