export const metadata = { 
  title: 'StandFM2movie',
  description: '音声から記事や動画を自動生成！'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
