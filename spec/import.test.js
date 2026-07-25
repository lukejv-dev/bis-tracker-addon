import { describe, it, expect, beforeEach } from 'vitest';
import { loadAddon } from './wow.js';

let vm;
beforeEach(() => {
  vm = loadAddon();
  vm.exec('ensureDB_forTests()');
});

const V2 = 'BISWATCH2~wowhead~mage~frost~1~naxx-25~40255|top|Trinkets;40260|top|Waist|sr';
const V1 = 'BISWATCH1~wowhead~mage~frost~1~40255|top|Trinkets;40260|top|Waist|sr';

// `ok` is coerced to false rather than left nil: Lua omits nil fields, so an
// absent key would arrive as `undefined` and read as a marshalling accident
// instead of a deliberate rejection.
const parse = (str) =>
  vm.eval(`local ok, err = BisWatcher._test.parseImport([[${str}]]) return { ok = ok or false, err = err }`);

describe('parseImport — BISWATCH2', () => {
  it('accepts a v2 string', () => {
    expect(parse(V2).ok).toBeTruthy();
  });

  it('reads the raid out of the header', () => {
    expect(parse(V2).ok.header.raid).toBe('naxx-25');
  });

  it('keeps class, spec and phase', () => {
    expect(parse(V2).ok.header).toMatchObject({ class: 'mage', spec: 'frost', phase: '1', source: 'wowhead' });
  });

  it('counts the items', () => {
    expect(parse(V2).ok.count).toBe(2);
  });

  it('carries rank, slot and the SR flag per item', () => {
    const result = parse(V2).ok;
    expect(result.items['40255']).toMatchObject({ rank: 'top', slot: 'Trinkets' });
    expect(result.items['40260'].sr).toBe(true);
    expect(result.items['40255'].sr).toBe(false);
  });
});

describe('parseImport — v1 compatibility', () => {
  // Anyone with a list saved before the bump must not lose it on upgrade.
  it('still accepts a v1 string', () => {
    expect(parse(V1).ok).toBeTruthy();
  });

  it('reports the raid as "all" for v1, which had no raid field', () => {
    expect(parse(V1).ok.header.raid).toBe('all');
  });

  it('parses v1 items identically', () => {
    expect(parse(V1).ok.items['40260']).toMatchObject({ rank: 'top', slot: 'Waist', sr: true });
  });
});

describe('parseImport — rejection', () => {
  it('rejects a newer format rather than guessing', () => {
    const result = parse('BISWATCH3~a~b~c~d~e~1|top|Head');
    expect(result.ok).toBe(false);
    expect(result.err).toMatch(/version/i);
  });

  it('rejects an empty string', () => {
    expect(parse('').ok).toBe(false);
  });

  it('rejects a header with too few fields', () => {
    expect(parse('BISWATCH2~wowhead~mage').ok).toBe(false);
  });

  it('leaves no partial state behind when it rejects', () => {
    vm.exec(`BisWatcher._test.applyImport('ms', select(1, BisWatcher._test.parseImport([[${V2}]])))`);
    const before = vm.eval('return BisWatcher._test.countItems(BisWatcherDB.ms)');
    vm.exec(`local p = BisWatcher._test.parseImport('BISWATCH3~x~y~z~w~v~1|top|Head') if p then BisWatcher._test.applyImport('ms', p) end`);
    expect(vm.eval('return BisWatcher._test.countItems(BisWatcherDB.ms)')).toBe(before);
  });
});

describe('findMatches', () => {
  beforeEach(() => {
    vm.exec(`
      BisWatcherDB.ms = BisWatcher._test.parseImport([[${V2}]])
      local os1 = BisWatcher._test.parseImport('BISWATCH2~wowhead~mage~arcane~1~os-25~40255|alt|Trinkets')
      BisWatcherDB.os = { os1 }
    `);
  });

  it('finds an item on the MS list', () => {
    const matches = vm.eval('return BisWatcher._test.findMatches(40260)');
    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe('ms');
  });

  it('returns every list an item appears on', () => {
    const matches = vm.eval('return BisWatcher._test.findMatches(40255)');
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.kind).sort()).toEqual(['ms', 'os']);
  });

  it('keeps two specs of the same character distinct', () => {
    const matches = vm.eval('return BisWatcher._test.findMatches(40255)');
    const specs = matches.map((m) => m.header.spec).sort();
    expect(specs).toEqual(['arcane', 'frost']);
  });

  it('returns nothing for an unwatched item', () => {
    // An empty Lua table is indistinguishable from an empty map, so assert on
    // length rather than baking an ambiguous marshalling convention into a test.
    expect(Object.keys(vm.eval('return BisWatcher._test.findMatches(99999)'))).toHaveLength(0);
  });
});
