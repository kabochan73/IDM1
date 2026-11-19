"use client";

import { useEffect, useRef, useState } from "react";

let idCounter = 0;

export function MermaidDiagram({ source }: { source: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setError(null);
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            // アプリの配色(インディゴ系)に合わせる。デフォルトのピンク系テーマを上書き。
            primaryColor: "#eef2ff", // brand-50
            primaryBorderColor: "#4f46e5", // brand-600
            primaryTextColor: "#1e1b4b",
            lineColor: "#6b7280", // gray-500
            secondaryColor: "#eef2ff",
            tertiaryColor: "#ffffff",
          },
        });
        const id = `mermaid-${idCounter++}`;
        const { svg } = await mermaid.render(id, source);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "図の描画に失敗しました。");
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (error) {
    return <pre className="whitespace-pre-wrap rounded-md bg-red-50 p-3 text-xs text-red-700">構文エラー: {error}</pre>;
  }

  return <div ref={containerRef} className="overflow-auto" />;
}
