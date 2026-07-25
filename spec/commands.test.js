import { describe, it, expect, beforeEach } from 'vitest';
import { loadAddon } from './wow.js';

let vm;
beforeEach(() => {
  vm = loadAddon();
  vm.exec('ensureDB_forTests()');
});

const slash = (args) => vm.exec(`SlashCmdList['BISWATCHER']([[${args}]])`);
const chat = () => vm.eval('return _G.__calls.chat').join('\n');
const soundCount = () => vm.eval('return #_G.__calls.sound');

describe('/biswatch sound', () => {
  it('turns the sound off', () => {
    slash('sound off');
    expect(vm.eval('return BisWatcherDB.sound')).toBe(false);
  });

  it('turns it back on', () => {
    slash('sound off');
    slash('sound on');
    expect(vm.eval('return BisWatcherDB.sound')).toBe(true);
  });

  it('plays a sample on request, so you can pick one by ear', () => {
    slash('sound test');
    expect(soundCount()).toBe(1);
  });

  it('sets a named sound and plays it immediately', () => {
    slash('sound RaidWarning');
    expect(vm.eval('return BisWatcherDB.soundName')).toBe('RaidWarning');
    expect(soundCount()).toBe(1);
  });

  it('reports the current state when asked with no argument', () => {
    slash('sound');
    expect(chat()).toMatch(/sound is/i);
  });
});

// These exercise the real frame-building path. A typo in the config window
// would throw here rather than in front of you at a raid invite.
describe('config window', () => {
  it('opens without error', () => {
    expect(() => slash('config')).not.toThrow();
  });

  it('opens focused on the paste box', () => {
    expect(() => slash('paste')).not.toThrow();
    expect(chat()).toMatch(/paste your import string/i);
  });

  it('survives being opened twice', () => {
    slash('config');
    expect(() => slash('config')).not.toThrow();
  });
});

describe('/biswatch help', () => {
  it('mentions the new commands', () => {
    slash('help');
    expect(chat()).toMatch(/paste/);
    expect(chat()).toMatch(/sound/);
  });
});

describe('/biswatch import', () => {
  const V2 = 'BISWATCH2~wowhead~mage~frost~1~naxx-25~40255|top|Trinkets';

  it('accepts a pasted string', () => {
    slash(`import ms ${V2}`);
    expect(vm.eval('return BisWatcher._test.countItems(BisWatcherDB.ms)')).toBe(1);
  });

  it('tolerates the whole slash command being pasted back in', () => {
    slash(`import ms /biswatch import ms ${V2}`);
    expect(vm.eval('return BisWatcher._test.countItems(BisWatcherDB.ms)')).toBe(1);
  });

  it('names the raid and spec in the confirmation, not just a count', () => {
    slash(`import ms ${V2}`);
    expect(chat()).toMatch(/naxx-25/);
    expect(chat()).toMatch(/frost/);
  });

  it('appends OS lists rather than replacing them', () => {
    slash(`import os ${V2}`);
    slash('import os BISWATCH2~wowhead~mage~arcane~1~os-25~40260|top|Waist');
    expect(vm.eval('return #BisWatcherDB.os')).toBe(2);
  });

  it('refuses a v3 string and says why', () => {
    slash('import ms BISWATCH3~a~b~c~d~e~1|top|Head');
    expect(chat()).toMatch(/version/i);
    expect(vm.eval('return BisWatcher._test.countItems(BisWatcherDB.ms)')).toBe(0);
  });
});
