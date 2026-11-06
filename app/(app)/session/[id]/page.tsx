import { requirePage } from '@/lib/auth';
import { SessionView } from '@/components/SessionView';

export default async function SessionPage({ params }: PageProps<'/session/[id]'>) {
  const o = await requirePage();
  return <SessionView id={Number((await params).id)} target={o.target} />;
}
