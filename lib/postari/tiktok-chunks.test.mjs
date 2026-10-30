// Testele bucăților TikTok. Rulează cu: npm run test:postari   (node --test, fără dependențe noi)
//
// Verificatorul de mai jos aplică regulile din „Media Transfer Guide” independent de implementare:
// dacă planul și codul ar greși la fel, testul tot ar pica.
import assert from "node:assert/strict";
import test from "node:test";
import { SINGLE_CHUNK_MAX, chunkPlan, chunkRange, contentRange } from "./tiktok-chunks.ts";

const MB = 1_000_000;
const MIB = 1024 * 1024;

/** Ce spune ghidul, pe rând. Întoarce lista încălcărilor (goală = bine). */
function violations(size, plan) {
  const bad = [];
  const { chunkSize, total } = plan;
  if (!(total >= 1 && total <= 1000)) bad.push(`total_chunk_count ${total} nu e între 1 și 1000`);
  if (size <= 64 * MB) {
    if (total !== 1 || chunkSize !== size) bad.push(`sub 64 MB trebuie o singură bucată (chunk_size = video_size), dar e ${chunkSize} × ${total}`);
  } else {
    // „5 MB … 64 MB”, citit strâns în ambele sensuri ale lui MB: cel puțin 5 MiB, cel mult 64 · 10^6.
    if (chunkSize < 5 * MIB || chunkSize > 64 * MB) bad.push(`chunk_size ${chunkSize} nu e între 5 MB și 64 MB`);
    if (total !== Math.floor(size / chunkSize)) bad.push(`total_chunk_count ${total} ≠ floor(${size} / ${chunkSize}) = ${Math.floor(size / chunkSize)}`);
    if (total < 2) bad.push("peste 64 MB trebuie cel puțin două bucăți");
  }

  // Bucățile, în ordine, fără goluri, până la ultimul octet.
  let expectedStart = 0;
  for (let i = 0; i < total; i += 1) {
    const r = chunkRange(i, plan, size);
    if (r.start !== expectedStart) bad.push(`bucata ${i} începe la ${r.start}, nu la ${expectedStart}`);
    const length = r.end - r.start + 1;
    const last = i === total - 1;
    if (!last && length !== chunkSize) bad.push(`bucata ${i} are ${length} octeți, nu ${chunkSize}`);
    if (last && length < chunkSize) bad.push(`ultima bucată (${length}) e mai mică decât chunk_size (${chunkSize})`);
    if (last && length > 128 * MB) bad.push(`ultima bucată (${length}) trece de 128 MB`);
    if (contentRange(r, size) !== `bytes ${r.start}-${r.end}/${size}`) bad.push(`Content-Range greșit la bucata ${i}`);
    expectedStart = r.end + 1;
  }
  if (expectedStart !== size) bad.push(`bucățile acoperă ${expectedStart} octeți din ${size}`);
  return bad;
}

const CAZURI = [
  ["3 MB (10^6)", 3 * MB],
  ["3 MB (2^20)", 3 * MIB],
  ["10,73 MB, clipul din proba reală", 10_732_246],
  ["64 MB (10^6): încă o singură bucată", 64 * MB],
  ["64 MB (2^20)", 64 * MIB],
  ["100 MB (10^6)", 100 * MB],
  ["100 MB (2^20)", 100 * MIB],
];

for (const [nume, size] of CAZURI) {
  test(`planul pentru ${nume} (${size} octeți) respectă ghidul`, () => {
    assert.deepEqual(violations(size, chunkPlan(size)), []);
  });
}

test("clipul din proba reală: o singură bucată, chunk_size = video_size (cauza lui „The chunk size is invalid”)", () => {
  const size = 10_732_246;
  assert.deepEqual(chunkPlan(size), { chunkSize: size, total: 1 });
  assert.equal(contentRange(chunkRange(0, chunkPlan(size), size), size), "bytes 0-10732245/10732246");
});

test("sub 64 MB: o singură bucată, la orice mărime", () => {
  for (const size of [1, 4 * MB, 5 * MIB, 10 * MIB, 10 * MIB + 1, 30 * MB, 64 * MB - 1, 64 * MB]) {
    assert.deepEqual(chunkPlan(size), { chunkSize: size, total: 1 }, `${size}`);
  }
  assert.equal(SINGLE_CHUNK_MAX, 64 * MB);
});

test("100 MB (10^6): două bucăți de 50 MB", () => {
  const size = 100 * MB;
  assert.deepEqual(chunkPlan(size), { chunkSize: 50 * MB, total: 2 });
  assert.deepEqual(chunkRange(0, chunkPlan(size), size), { start: 0, end: 50 * MB - 1 });
  assert.deepEqual(chunkRange(1, chunkPlan(size), size), { start: 50 * MB, end: size - 1 });
  assert.equal(contentRange(chunkRange(1, chunkPlan(size), size), size), "bytes 50000000-99999999/100000000");
});

test("100 MB (2^20): trei bucăți, ultima preia restul", () => {
  const size = 100 * MIB;
  const plan = chunkPlan(size);
  assert.equal(plan.total, 3);
  const last = chunkRange(2, plan, size);
  assert.equal(last.end, size - 1);
  assert.ok(last.end - last.start + 1 >= plan.chunkSize);
});

test("tocmai peste 64 MB: două bucăți, nu una mai mică decât clipul", () => {
  for (const size of [64 * MB + 1, 66 * MB, 64 * MIB - 1, 64 * MIB, 64 * MIB + 1]) {
    const plan = chunkPlan(size);
    assert.equal(plan.total, 2, `${size}`);
    assert.deepEqual(violations(size, plan), [], `${size}`);
  }
});

test("clipuri foarte mari: până la 1000 de bucăți, niciuna peste 64 MB", () => {
  for (const size of [300 * MB, 1000 * MB, 4_000 * MB, 4 * 1024 * MIB, 20_000 * MB, 31_999 * MB, 64_000 * MB]) {
    assert.deepEqual(violations(size, chunkPlan(size)), [], `${size}`);
  }
});

test("mărimi aleatoare (sămânță fixă): toate respectă ghidul", () => {
  let seed = 20261030;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const intervale = [[1, 5 * MB], [5 * MB, 64 * MB], [64 * MB, 300 * MB], [300 * MB, 4_000 * MB]];
  for (const [a, b] of intervale) {
    for (let i = 0; i < 1500; i += 1) {
      const size = Math.floor(a + rand() * (b - a));
      const bad = violations(size, chunkPlan(size));
      assert.deepEqual(bad, [], `${size}: ${bad.join("; ")}`);
    }
  }
});

test("mărimi imposibile sunt refuzate cu o eroare, nu trimise la TikTok", () => {
  assert.throws(() => chunkPlan(0), RangeError);
  assert.throws(() => chunkPlan(-5), RangeError);
  assert.throws(() => chunkPlan(10.5), RangeError);
  assert.throws(() => chunkPlan(Number.NaN), RangeError);
  assert.throws(() => chunkPlan(200_000 * MB), RangeError);
});

test("chunkRange refuză o bucată care nu există", () => {
  const plan = chunkPlan(100 * MB);
  assert.throws(() => chunkRange(-1, plan, 100 * MB), RangeError);
  assert.throws(() => chunkRange(plan.total, plan, 100 * MB), RangeError);
});
