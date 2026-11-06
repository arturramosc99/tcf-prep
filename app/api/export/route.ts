import { guard } from '@/lib/auth';
import { exportMarkdown } from '@/lib/errors';

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return new Response(await exportMarkdown(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="recurring-errors-${new Date().toISOString().slice(0, 10)}.md"`,
    },
  });
}
