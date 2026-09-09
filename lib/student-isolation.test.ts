/* The load-bearing rule of the student portal, enforced mechanically.
   A student's browser must never receive another boy's row — so no screen on
   that surface may reach the shared client store, which holds all 117 of them.
   Everything it renders comes from /api/student/*, which resolves who is
   asking from the cookie before it reads anything. */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('the student portal cannot reach the shared store', () => {
  const files = walk('app/student').filter((f) => /\.tsx?$/.test(f));

  it('has screens to check', () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it.each(files)('%s does not import lib/store', (file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(/from\s+['"]@\/lib\/store['"]/);
    expect(src).not.toMatch(/\buseDB\b/);
    /* `store.` would be the singleton; `Store` the lucide icon, which is fine. */
    expect(src).not.toMatch(/\bstore\.\w/);
  });

  it.each(files)('%s reads only from /api/student', (file) => {
    const src = readFileSync(file, 'utf8');
    const calls = [...src.matchAll(/fetch\(\s*[`'"]([^`'"$]*)/g)].map((m) => m[1]);
    for (const url of calls) {
      if (!url.startsWith('/api/')) continue;
      expect(url.startsWith('/api/student/')).toBe(true);
    }
  });

  it('StudentGate and its localStorage key are gone', () => {
    /* Excluding this file, which necessarily names what it forbids. */
    const all = [...walk('app'), ...walk('components'), ...walk('lib')]
      .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('student-isolation.test.ts'));
    for (const f of all) {
      const src = readFileSync(f, 'utf8');
      expect(src).not.toContain('StudentGate');
      expect(src).not.toContain('halqah.student.id');
    }
  });
});
