export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="wrap" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', paddingBlock: 32 }}>
      {children}
    </main>
  );
}
