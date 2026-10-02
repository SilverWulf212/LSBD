import { sanitizePostHtml } from "@/lib/sanitize-post-html";

interface PostContentProps {
  html: string;
}

export function PostContent({ html }: PostContentProps) {
  return (
    <div
      className="prose-content"
      dangerouslySetInnerHTML={{ __html: sanitizePostHtml(html) }}
    />
  );
}
