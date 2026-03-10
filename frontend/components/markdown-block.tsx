"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownBlockProps = {
  content: string;
};

export function MarkdownBlock({ content }: MarkdownBlockProps) {
  return (
    <div className="markdown-copy text-sm leading-7 text-[var(--fg)]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
