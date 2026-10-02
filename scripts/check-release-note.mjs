#!/usr/bin/env node
/* «نسيت تضيف إعلان ما الجديد» — the guard on CLAUDE.md's rule.

   Given a git range, fails when it changes what a supervisor, teacher or
   student sees (pages, layouts, components, styles) without touching
   content/releases.ts — unless a commit in the range says `[no-release]`.

     node scripts/check-release-note.mjs <base> <head>
     node scripts/check-release-note.mjs origin/main HEAD    # before pushing

   Run by .github/workflows/release-note.yml on every push and pull request. */
import { execFileSync } from 'node:child_process';

const [base, head = 'HEAD'] = process.argv.slice(2);
if (!base || /^0+$/.test(base)) {
  console.log('No base to compare against (a new branch) — nothing to check.');
  process.exit(0);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

let files;
try {
  files = git('diff', '--name-only', `${base}...${head}`).split('\n').filter(Boolean);
} catch {
  files = git('diff', '--name-only', base, head).split('\n').filter(Boolean);
}

/* What users see. API routes and lib/ change behaviour too, but most of those
   commits are fixes nobody notices; the screens are where a change is visible. */
const visible = (f) =>
  (/^app\/.*\/(page|layout)\.tsx$/.test(f) || /^app\/(page|layout)\.tsx$/.test(f)
    || /^components\/.+\.tsx$/.test(f) || f === 'app/globals.css')
  && !f.startsWith('components/whatsnew/')
  && !f.startsWith('app/print/');

const touched = files.filter(visible);
const announced = files.includes('content/releases.ts');
const messages = git('log', '--format=%B', `${base}..${head}`);
const optedOut = /\[no-release\]/i.test(messages);

if (!touched.length || announced || optedOut) {
  console.log(touched.length
    ? (announced ? '✓ «ما الجديد» updated with the change.' : '✓ Marked [no-release].')
    : '✓ No user-facing screens changed.');
  process.exit(0);
}

console.error(`
✗ نسيت تضيف إعلان «ما الجديد».

هذه التعديلات تغيّر ما يراه المستخدمون:
${touched.map((f) => `  · ${f}`).join('\n')}

لكن content/releases.ts لم يتغيّر. أضف إعلانًا كما في CLAUDE.md،
أو اكتب [no-release] في رسالة الـ commit إن كان التعديل لا يلاحظه أحد.
`);
process.exit(1);
