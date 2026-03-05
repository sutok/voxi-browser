import { describe, it, expect } from 'vitest';

describe('Popup エクスポート機能', () => {
  /**
   * buildExportText のロジックをテスト（popup.js から抽出したロジック）
   */
  function buildExportText(transcripts) {
    const lines = [];
    const allEntries = [
      ...transcripts.mic.map((e) => ({ ...e, source: '自分' })),
      ...transcripts.tab.map((e) => ({ ...e, source: 'タブ' })),
    ].sort((a, b) => a.time.localeCompare(b.time));

    for (const entry of allEntries) {
      lines.push(`[${entry.time}] ${entry.source}: ${entry.text}`);
    }
    return lines.join('\n');
  }

  it('マイクとタブの文字起こしを時刻順に結合する', () => {
    const transcripts = {
      mic: [
        { text: 'こんにちは', time: '10:00:01' },
        { text: 'はい', time: '10:00:05' },
      ],
      tab: [
        { text: 'ようこそ', time: '10:00:02' },
      ],
    };

    const result = buildExportText(transcripts);
    const lines = result.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('[10:00:01] 自分: こんにちは');
    expect(lines[1]).toBe('[10:00:02] タブ: ようこそ');
    expect(lines[2]).toBe('[10:00:05] 自分: はい');
  });

  it('文字起こしが空なら空文字列を返す', () => {
    const transcripts = { mic: [], tab: [] };
    expect(buildExportText(transcripts)).toBe('');
  });

  it('マイクのみの文字起こし', () => {
    const transcripts = {
      mic: [{ text: 'テスト', time: '12:00:00' }],
      tab: [],
    };
    const result = buildExportText(transcripts);
    expect(result).toBe('[12:00:00] 自分: テスト');
  });

  it('タブのみの文字起こし', () => {
    const transcripts = {
      mic: [],
      tab: [{ text: '動画の音声', time: '12:00:00' }],
    };
    const result = buildExportText(transcripts);
    expect(result).toBe('[12:00:00] タブ: 動画の音声');
  });
});
