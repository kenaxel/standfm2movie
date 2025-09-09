'use client'

import Link from 'next/link'

export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <h1>StandFM2movie</h1>
      <p>トップページ表示テスト (App Router)</p>
      <p>
        <Link href="/generator">動画生成ツールへ</Link>
      </p>
      <p>
        <Link href="/api/hello">API テスト</Link>
      </p>
    </main>
  );
}





