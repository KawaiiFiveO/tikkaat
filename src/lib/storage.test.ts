import { describe, expect, it } from 'vitest';
import { clearSiteData, STORAGE_KEYS } from './storage';
import { createMemoryStorage, storageKeys } from './testUtils';

describe('clearSiteData', () => {
  it('removes every Tikkaat key and leaves other sites on the same origin alone', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.legacyDraft]: '{}',
      [STORAGE_KEYS.drafts]: '[]',
      [STORAGE_KEYS.currentDraft]: '"abc"',
      [STORAGE_KEYS.draft('abc')]: '{}',
      [STORAGE_KEYS.active]: '{}',
      [STORAGE_KEYS.progress('abc123')]: '{}',
      [STORAGE_KEYS.progress('def456')]: '{}',
      'tikkaat:theme': 'light',
      'tikkaat:color': 'mint',
      'other-project:save': 'keep',
      tikkaatish: 'keep',
    });
    clearSiteData(storage);
    expect(storageKeys(storage)).toEqual(['other-project:save', 'tikkaatish']);
  });

  it('does nothing when there is no Tikkaat data', () => {
    const storage = createMemoryStorage({ unrelated: 'keep' });
    clearSiteData(storage);
    expect(storageKeys(storage)).toEqual(['unrelated']);
  });
});
