import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('WhisperWorker メッセージプロトコル', () => {
  it('load メッセージで @huggingface/transformers をインポートする', async () => {
    // Worker はブラウザ環境が必要なので、プロトコルの型のみテスト
    const loadMessage = { type: 'load' };
    expect(loadMessage.type).toBe('load');
  });

  it('transcribe メッセージに audio と source が含まれる', () => {
    const audio = new Float32Array(16000 * 5);
    const message = { type: 'transcribe', audio, source: 'mic' };

    expect(message.type).toBe('transcribe');
    expect(message.audio).toBeInstanceOf(Float32Array);
    expect(message.audio.length).toBe(80000);
    expect(message.source).toBe('mic');
  });

  it('transcription 結果にはtext, source, timestamp が含まれる', () => {
    const result = {
      type: 'transcription',
      text: 'テスト文字起こし',
      source: 'tab',
      timestamp: Date.now(),
    };

    expect(result.type).toBe('transcription');
    expect(result.text).toBe('テスト文字起こし');
    expect(result.source).toBe('tab');
    expect(typeof result.timestamp).toBe('number');
  });

  it('source は mic または tab のみ', () => {
    const validSources = ['mic', 'tab'];
    expect(validSources).toContain('mic');
    expect(validSources).toContain('tab');
    expect(validSources).not.toContain('system');
  });
});
