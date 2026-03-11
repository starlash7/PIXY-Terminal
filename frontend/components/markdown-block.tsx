"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownBlockProps = {
  content: string;
};

type CodeBlockProps = {
  children?: React.ReactNode;
  className?: string;
};

function CodeBlock({ children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const code = String(children ?? "").replace(/\n$/, "");
  const inline = !className;

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  if (inline) {
    return <code>{children}</code>;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-3 top-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-muted)] transition-all duration-150 hover:text-[var(--text-primary)]"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <code>{code}</code>
    </div>
  );
}

export function MarkdownBlock({ content }: MarkdownBlockProps) {
  return (
    <div className="markdown-copy text-sm leading-7 text-[var(--text-primary)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ children, className }) {
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
