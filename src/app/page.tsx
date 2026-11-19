import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
        <span className="font-semibold text-gray-900">Idea Design Machine</span>
        <Link
          href="/login"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          ログイン
        </Link>
      </header>

      <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">AIと一緒に、優れた要件定義を。</h1>
        <p className="mb-10 text-gray-600">
          企画から要件定義、機能設計、画面設計、DB設計、詳細設計、テスト設計、そして実装TODOまで。
          <br />
          実装は一切しない、設計に集中するためのアプリです。
        </p>
        <ul className="mb-10 space-y-2 text-left text-sm text-gray-700">
          <li>・8つの工程を一本道で、抜け漏れなく</li>
          <li>・成果物間の矛盾をAIが自動検出</li>
          <li>・設計から実装TODOへの橋渡し</li>
        </ul>
        <Link
          href="/login"
          className="rounded-md bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          ログインして始める
        </Link>
      </main>
    </div>
  );
}
