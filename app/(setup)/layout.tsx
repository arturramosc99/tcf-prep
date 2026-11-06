import { LogoutButton } from '@/components/LogoutButton';

/** The setup guide: no navigation, just the steps. */
export default function SetupLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <header className="top wrap">
        <div className="top-row">
          <span className="brand">TCF Prep</span>
          <LogoutButton />
        </div>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}
