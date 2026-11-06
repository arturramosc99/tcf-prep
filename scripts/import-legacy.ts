// Manual use: npx tsx scripts/import-legacy.ts (the app also imports by itself when the database is empty)
import { sql } from '../lib/db';
import { importLegacy } from '../lib/legacy';

importLegacy(sql).then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
