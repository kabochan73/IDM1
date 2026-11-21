"use client";

import type { WireframeElement, LeafElement } from "@/lib/schemas/wireframe";

function LeafVisual({ element }: { element: LeafElement }) {
  switch (element.type) {
    case "header":
      return <p className="text-sm font-bold text-gray-900">{element.label}</p>;
    case "text":
      return <p className="text-xs text-gray-500">{element.label}</p>;
    case "button":
      return (
        <span className="inline-block rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white">
          {element.label}
        </span>
      );
    case "input":
      return (
        <div className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-400">
          {element.label}
        </div>
      );
    case "image":
      return (
        <div className="flex h-12 w-full items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-[11px] text-gray-400">
          🖼 {element.label}
        </div>
      );
    case "nav":
      return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">{element.label}</span>;
    case "list":
      return (
        <div className="flex items-center gap-1.5 text-xs text-gray-700">
          <span className="text-gray-300">•</span>
          {element.label}
        </div>
      );
    case "table":
      return <div className="text-xs text-gray-700">{element.label}</div>;
    case "container":
      return (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600">
          {element.label}
        </div>
      );
  }
}

function ElementBox({ element }: { element: WireframeElement }) {
  const children = element.children;

  switch (element.type) {
    case "nav":
      return (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-gray-900 px-3 py-2">
          <span className="text-xs font-semibold text-white">{element.label}</span>
          {children.map((c, i) => (
            <span key={i} className="rounded-full bg-gray-700 px-2.5 py-1 text-xs text-gray-100">
              {c.label}
            </span>
          ))}
        </div>
      );
    case "header":
      return (
        <div className="border-b border-gray-200 pb-2">
          <p className="text-base font-bold text-gray-900">{element.label}</p>
          {children.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {children.map((c, i) => (
                <LeafVisual key={i} element={c} />
              ))}
            </div>
          )}
        </div>
      );
    case "list":
      return (
        <div className="rounded-md border border-gray-200 bg-white">
          <p className="border-b border-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500">{element.label}</p>
          <div className="divide-y divide-gray-100">
            {children.length > 0 ? (
              children.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700">
                  <span className="text-gray-300">•</span>
                  {c.label}
                </div>
              ))
            ) : (
              <p className="px-3 py-1.5 text-xs text-gray-400">(項目なし)</p>
            )}
          </div>
        </div>
      );
    case "table":
      return (
        <div className="overflow-hidden rounded-md border border-gray-200">
          <p className="border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-500">
            {element.label}
          </p>
          <div className="divide-y divide-gray-100">
            {children.length > 0 ? (
              children.map((c, i) => (
                <div key={i} className="px-3 py-1.5 text-xs text-gray-700">
                  {c.label}
                </div>
              ))
            ) : (
              <p className="px-3 py-1.5 text-xs text-gray-400">(列なし)</p>
            )}
          </div>
        </div>
      );
    case "container":
      return (
        <div className="rounded-md border border-gray-200 bg-gray-50/60 p-3">
          <p className="mb-2 text-xs font-semibold text-gray-500">{element.label}</p>
          <div className="flex flex-wrap gap-2">
            {children.map((c, i) => (
              <LeafVisual key={i} element={c} />
            ))}
          </div>
        </div>
      );
    case "text":
      return <p className="text-sm text-gray-600">{element.label}</p>;
    case "button":
      return (
        <span className="inline-block rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">
          {element.label}
        </span>
      );
    case "input":
      return (
        <div className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-400">
          {element.label}
        </div>
      );
    case "image":
      return (
        <div className="flex h-20 w-full items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
          🖼 {element.label}
        </div>
      );
  }
}

export function WireframeView({
  screens,
  activeIndex,
  onActiveIndexChange,
}: {
  screens: { name: string; elements: WireframeElement[] }[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
}) {
  if (screens.length === 0) {
    return <p className="text-sm text-gray-400">まだ画面が登録されていません。</p>;
  }

  const active = screens[activeIndex] ?? screens[0];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1 border-b border-gray-200 pb-2">
        {screens.map((screen, i) => (
          <button
            key={screen.name + i}
            onClick={() => onActiveIndexChange(i)}
            className={`rounded-md px-2.5 py-1 text-xs ${
              i === activeIndex ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {screen.name}
          </button>
        ))}
      </div>
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        {active.elements.map((el, i) => (
          <ElementBox key={i} element={el} />
        ))}
        {active.elements.length === 0 && <p className="text-sm text-gray-400">この画面にはまだ要素がありません。</p>}
      </div>
    </div>
  );
}
