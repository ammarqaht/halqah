/* The development database.
 *
 * Signing in needs a real row in `admin_users`, so development wants a Postgres
 * of its own. This starts one that needs nothing installed on the machine: the
 * binaries come from `embedded-postgres`, the cluster lives outside the
 * repository, and deleting that folder deletes the database with it.
 *
 *   npm run db:dev        initialise if needed, start, stay up until Ctrl-C
 *
 * `embedded-postgres` is deliberately NOT in package.json. It carries ~100 MB
 * of Postgres binaries, and `npm ci` in the Dockerfile installs devDependencies
 * too — so listing it would pull a Linux Postgres into every CranL build to be
 * used by nothing. It is a tool for one machine, fetched by the one line the
 * error below prints. Anyone who already runs a Postgres can ignore this file
 * and point DATABASE_URL at theirs.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { arch, homedir, platform } from 'node:os';
import { join } from 'node:path';

/* 5433, not 5432: a developer may already run Postgres on the default port,
   and this cluster must never be mistaken for — or collide with — that one. */
const PORT = 5433;
const USER = 'admin';
const PASSWORD = '12345';
const DATABASE = 'halqah';

/** Where a throwaway cluster belongs on this platform — never inside the repo. */
function dataHome() {
  if (process.env.LOCALAPPDATA) return process.env.LOCALAPPDATA;      // Windows
  if (process.env.XDG_DATA_HOME) return process.env.XDG_DATA_HOME;    // Linux
  return join(homedir(), '.local', 'share');                          // macOS, fallback
}

const databaseDir = join(dataHome(), 'halqah-pg', 'data');
const URL = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}`;

/** Paths to initdb / pg_ctl / postgres, the same way the library resolves them.
    The platform package puts them on named exports, not on `default`. */
const binaries = async () => {
  const os = platform() === 'win32' ? 'windows' : platform();
  return import(`@embedded-postgres/${os}-${arch()}`);
};

let EmbeddedPostgres;
try {
  ({ default: EmbeddedPostgres } = await import('embedded-postgres'));
} catch {
  console.error(`
  ✗ ينقص «embedded-postgres» — وهو الذي يحمل ثنائيّات بوستجرس.

    npm i --no-save embedded-postgres

  و«--no-save» مقصودة: أداة جهازٍ واحد لا اعتمادية مشروع، فلا تدخل في
  package.json ولا في بناء CranL. والثمن أن «npm install» و«npm ci» كليهما
  يحذفانها، فأعِد السطر أعلاه بعد أيّهما — والعنقود متوقّف، فويندوز لا يسمح
  باستبدال مكتبة يفتحها بوستجرس يعمل.
`);
  process.exit(1);
}

const pg = new EmbeddedPostgres({
  databaseDir,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
  /* Without this the cluster initialises under the Windows locale, which makes
     WIN1252 its default encoding — and WIN1252 cannot represent a single Arabic
     letter, so the first migration dies on the first Arabic default value in the
     schema. Setting it HERE makes template1 itself UTF-8, so every database made
     from it is UTF-8 and there is no repair step to remember. */
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

/* `npm run db:dev stop`.
 *
 * Postgres is not a child of this script — `pg_ctl` starts a detached server —
 * so closing the window or killing this process leaves the cluster listening,
 * and the next `npm i` then fails to replace a DLL that Postgres still holds
 * open. Ctrl-C is handled below, but only a live terminal delivers it. This is
 * the way that always works.
 *
 * It shells out to `pg_ctl` rather than calling the library's own `stop()`,
 * which begins `if (!this.process) return;` — in a FRESH node process there is
 * no handle to the server another process started, so that call returns having
 * done nothing, and reports success. `pg_ctl` addresses the cluster by its data
 * directory, which is the only identity that survives across processes. */
if (process.argv[2] === 'stop') {
  const { pg_ctl } = await binaries();
  const r = spawnSync(pg_ctl, ['stop', '-D', databaseDir, '-m', 'fast'], { encoding: 'utf8' });
  const said = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  if (r.status === 0) {
    console.log(`  ✓ توقّف العنقود (${PORT}).`);
    process.exit(0);
  }
  /* Never a silent success: «لم يكن يعمل» and «رفض التوقّف» send you to two
     different places. */
  console.error(`  ✗ لم يتوقّف العنقود.\n${said || r.error?.message || ''}`);
  process.exit(1);
}

/* `PG_VERSION` is written by initdb and by nothing else, so its presence is the
   honest test of whether this cluster already exists. */
if (!existsSync(join(databaseDir, 'PG_VERSION'))) {
  console.log(`  … تهيئة عنقود جديد في ${databaseDir}`);
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DATABASE);
  console.log('  ✓ العنقود جاهز. والخطوة التالية في نافذة أخرى:');
  console.log('      npx prisma migrate deploy && npm run db:bootstrap\n');
} else {
  await pg.start();
}

console.log(`READY ${URL}`);
console.log('  (اتركه يعمل. Ctrl-C يوقفه — أو «npm run db:dev stop» من نافذة أخرى.)');

const stop = async () => { try { await pg.stop(); } catch {} process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);      // stay up until killed
