// Find continuous-effect fields that are WRITTEN BUT NEVER READ.
//
//   node tools/checkderived.js
//
// The continuous layer is a plain object of sets, maps and arrays that every
// constant ability contributes to, and that the engine then consults. A card
// that writes into one of those fields LOOKS implemented — it has a constant,
// the constant runs, it touches `derived` — and tools/verify-abilities.js will
// pass it, because that file judges a card against its printed text by
// exercising it, and a passive whose only effect is a write has nothing
// observable to exercise.
//
// So a field nobody reads is a silent hole: every card that writes into it is
// doing nothing at all, and everything downstream reports green. That is
// exactly how Veil Shroud shipped inert — `voidSquares` was written by two
// cards and read only by an `isVoid()` helper that was never called from
// anywhere.
//
// This checks the one thing verify-abilities structurally cannot: not "does
// this card do what it says", but "could this card possibly do anything".

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = [];
for (const dir of ['js', 'js/rules']) {
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const path = join(dir, f);
    SRC.push({ path, text: readFileSync(path, 'utf8') });
  }
}

const derive = SRC.find((s) => s.path.endsWith('rules/derive.js'));
if (!derive) {
  console.error('cannot find js/rules/derive.js');
  process.exit(1);
}

// The shape of the layer is declared in one place, so read the field names off
// it rather than keeping a second list here that would drift.
const body = derive.text.slice(derive.text.indexOf('emptyDerived'));
const block = body.slice(body.indexOf('{'), body.indexOf('\n}'));
const fields = [...block.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]);

if (fields.length < 5) {
  console.error('could not read the derived fields out of emptyDerived()');
  process.exit(1);
}

/** Writes look like `.add(`, `.set(`, `.push(`, or an assignment to the field. */
const WRITE = (f) => new RegExp(
  `\\.${f}\\s*(?:\\[[^\\]]*\\])?\\s*\\.\\s*(?:add|set|push)\\s*\\(`
  + `|\\.${f}\\s*(?:\\[[^\\]]*\\])?\\s*=[^=]`, 'g');

/**
 * A read is any mention that is not a write.
 *
 * Enumerating the shapes a read can take does not work: the first version of
 * this listed `.has(`, `.get(`, iteration and so on, and reported
 * `globalPowerSet` as dead when it is read by a bare `!= null` two lines
 * before it is assigned from. A tool that cries wolf about a healthy field is
 * worse than no tool, because the next person turns it off.
 */
const MENTION = (f) => new RegExp(`\\.${f}\\b`, 'g');

const problems = [];
const ok = [];

for (const f of fields) {
  let writes = 0, reads = 0;
  const readers = new Set(), writers = new Set();
  for (const { path, text } of SRC) {
    // The initialiser in emptyDerived() is neither a read nor a write of
    // anything meaningful — it is the declaration.
    const scrubbed = path.endsWith('rules/derive.js')
      ? text.replace(block, '') : text;
    const w = scrubbed.match(WRITE(f)) || [];
    const all = scrubbed.match(MENTION(f)) || [];
    const r = Math.max(0, all.length - w.length);
    writes += w.length; reads += r;
    if (w.length) writers.add(path);
    if (r) readers.add(path);
  }

  // A field read ONLY by a helper that nobody calls is still unread. Find
  // exported helpers whose body is the only reader, and check they are used.
  let deadHelper = null;
  if (reads > 0 && readers.size === 1 && [...readers][0].endsWith('rules/derive.js')) {
    const fnNames = [...derive.text.matchAll(/export function (\w+)\([^)]*\)\s*\{([^}]*)\}/g)]
      .filter((m) => new RegExp(`\\.${f}\\b`).test(m[2]))
      .map((m) => m[1]);
    for (const name of fnNames) {
      const used = SRC.some(({ path, text }) => !path.endsWith('rules/derive.js')
        && new RegExp(`\\b${name}\\s*\\(`).test(text));
      if (!used) deadHelper = name;
    }
  }

  if (writes > 0 && reads === 0) {
    problems.push({ f, why: 'written, never read', writers: [...writers] });
  } else if (writes > 0 && deadHelper) {
    problems.push({
      f, why: `read only by ${deadHelper}(), which nothing calls`, writers: [...writers],
    });
  } else {
    ok.push(f);
  }
}

console.log(`${fields.length} continuous-effect fields declared`);
console.log(`  ${ok.length} are both written and consumed`);

if (!problems.length) {
  console.log('\nOK — every field something writes into is read by something');
  process.exit(0);
}

console.log(`\nFAIL — ${problems.length} field(s) nothing acts on:`);
for (const p of problems) {
  console.log(`  ${p.f}: ${p.why}`);
  for (const w of p.writers) console.log(`      written in ${w}`);
}
console.log('\nEvery card whose only effect is one of these writes is INERT,');
console.log('and tools/verify-abilities.js will still report it healthy.');
process.exit(1);
