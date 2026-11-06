import Link from 'next/link';
import { LogoutButton } from '@/components/LogoutButton';
import { Nav } from '@/components/Nav';
import { requirePage } from '@/lib/auth';
import { dbProblem } from '@/lib/db';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const problem = await dbProblem();
  if (problem) return <DbProblem message={problem} />;
  await requirePage();
  return (
    <>
      <header className="top wrap">
        <div className="top-row">
          <Link href="/" className="brand">TCF Prep</Link>
          <div className="row" style={{ gap: 16 }}>
            <Link href="/settings" className="menu-btn">Settings</Link>
            <LogoutButton />
          </div>
        </div>
        <Nav />
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}

function DbProblem({ message }: { message: string }) {
  return (
    <main className="wrap" style={{ paddingTop: 48 }}>
      <section className="card stack reading">
        <h1 className="title">Database not connected</h1>
        <p>The app needs a Postgres database to store simulations, errors and keys. In Vercel: your project → Storage → Create Database → Neon → Connect. Then Redeploy. Step by step: <a href="https://github.com/arturramosc99/tcf-prep/blob/main/docs/install.md#database">install guide</a>.</p>
        <p className="label">{message}</p>
      </section>
    </main>
  );
}
