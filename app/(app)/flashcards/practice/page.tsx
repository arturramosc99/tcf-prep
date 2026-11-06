import { requirePage } from '@/lib/auth';
import { Practice } from './Practice';

export const dynamic = 'force-dynamic';

export default async function PracticePage(props: PageProps<'/flashcards/practice'>) {
  await requirePage();
  const { pattern } = await props.searchParams;
  return <Practice pattern={typeof pattern === 'string' ? pattern : null} />;
}
