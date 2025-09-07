'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ padding: 24 }}>
      <h1>エラーが発生しました</h1>
      <pre>{error.message}</pre>
      <button onClick={reset}>再試行</button>
    </main>
  );
}
