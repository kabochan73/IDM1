"use client";

import type { WireframeElement, LeafElement } from "@/lib/schemas/wireframe";

const TYPE_LABEL: Record<LeafElement["type"], string> = {
  header: "見出し",
  text: "テキスト",
  button: "ボタン",
  input: "入力欄",
  image: "画像",
  list: "リスト",
  nav: "ナビ",
  container: "コンテナ",
  table: "テーブル",
};

function LeafBox({ element }: { element: LeafElement }) {
  return (
    <div
      className={`rounded-md border px-2 py-1.5 text-xs ${
        element.type === "button"
          ? "inline-block border-gray-400 bg-gray-100 text-gray-800"
          : "border-gray-200 bg-white text-gray-700"
      }`}
    >
      <span className="mr-1 rounded bg-gray-100 px-1 text-[10px] text-gray-500">{TYPE_LABEL[element.type]}</span>
      {element.label}
    </div>
  );
}

function ElementBox({ element }: { element: WireframeElement }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700">
      <span className="mr-1 rounded bg-gray-100 px-1 text-[10px] text-gray-500">{TYPE_LABEL[element.type]}</span>
      {element.label}
      {element.children.length > 0 && (
        <div className="mt-1.5 space-y-1.5 border-l-2 border-gray-100 pl-2">
          {element.children.map((child, i) => (
            <LeafBox key={i} element={child} />
          ))}
        </div>
      )}
    </div>
  );
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
      <div className="space-y-2">
        {active.elements.map((el, i) => (
          <ElementBox key={i} element={el} />
        ))}
        {active.elements.length === 0 && <p className="text-sm text-gray-400">この画面にはまだ要素がありません。</p>}
      </div>
    </div>
  );
}
