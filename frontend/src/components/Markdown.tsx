// Renders the light markdown Gemini returns (bold, headings, bullets, numbered lists)
// so students never see raw ** or * in the UI. Input is escaped before formatting,
// so it is safe to set as HTML. Styled neutrally for normal cards (text-ink/muted).

function toHtml(content: string): string {
  const html = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^#### (.*$)/gim, "<h4>$1</h4>")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^\s*[-*]\s+(.*$)/gim, "<li>$1</li>")
    .replace(/^\s*\d+\.\s+(.*$)/gim, "<li>$1</li>");

  const lines = html.split("\n");
  let inList = false;
  const out: string[] = [];
  for (const line of lines) {
    const isLi = line.startsWith("<li>");
    if (isLi && !inList) {
      inList = true;
      out.push("<ul>" + line);
    } else if (!isLi && inList) {
      inList = false;
      out.push("</ul>");
      if (line.trim() && !line.startsWith("<h")) out.push(`<p>${line}</p>`);
      else if (line.trim()) out.push(line);
    } else if (!line.trim()) {
      continue;
    } else if (!isLi && !line.startsWith("<h")) {
      out.push(`<p>${line}</p>`);
    } else {
      out.push(line);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}

// Inline variant: only bold/italic, no block/list wrapping. Use inside an existing
// <li>, heading, or sentence where the AI string may contain ** or *.
function toInlineHtml(content: string): string {
  return (content ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^\s*[-*]\s+/, "") // drop a leading bullet marker if the string carries one
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
}

export default function Markdown({
  children,
  className = "",
  inline = false,
}: {
  children: string;
  className?: string;
  inline?: boolean;
}) {
  if (inline) {
    return <span className={className} dangerouslySetInnerHTML={{ __html: toInlineHtml(children ?? "") }} />;
  }
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: toHtml(children ?? "") }} />;
}
