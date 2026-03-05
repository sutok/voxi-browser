import { describe, it, expect, vi, beforeEach } from 'vitest';

// AudioWorkletProcessor のモック
class MockAudioWorkletProcessor {
  constructor() {
    this.port = {
      postMessage: vi.fn(),
      onmessage: null,
    };
  }
  process() {
    return true;
  }
}

// グローバルに登録
globalThis.AudioWorkletProcessor = MockAudioWorkletProcessor;
globalThis.registerProcessor = vi.fn();
globalThis.sampleRate = 44100;

describe('AudioProcessor', () => {
  let AudioProcessor;

  beforeEach(async () => {
    vi.resetModules();
    globalThis.registerProcessor = vi.fn();
    await import('../../src/audio/audio-processor.js');
    AudioProcessor = globalThis.registerProcessor.mock.calls[0]?.[1];
  });

  it('registerProcessor で "audio-processor" として登録される', () => {
    expect(globalThis.registerProcessor).toHaveBeenCalledWith(
      'audio-processor',
      expect.any(Function)
    );
  });

  it('入力がないとき true を返す（プロセッサーを維持）', () => {
    const processor = new AudioProcessor({
      processorOptions: { bufferSize: 160, sampleRate: 16000 },
    });
    const result = processor.process([[]]);
    expect(result).toBe(true);
  });

  it('バッファが満杯になると audio-chunk メッセージを送信する', () => {
    const bufferSize = 16; // テスト用の小さいバッファ
    const processor = new AudioProcessor({
      processorOptions: { bufferSize, sampleRate: 16000 },
    });

    // sampleRate 44100 → 16000 の比率: 約 2.75
    // 128 サンプル入力 → 約 46 サンプル出力
    // bufferSize=16 なので複数回 postMessage されるはず
    const channelData = new Float32Array(128).fill(0.5);

    processor.process([[channelData]]);

    const calls = processor.port.postMessage.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0].type).toBe('audio-chunk');
    expect(calls[0][0].audio).toBeInstanceOf(Float32Array);
    expect(calls[0][0].audio.length).toBe(bufferSize);
  });

  it('バッファが満杯でない間は postMessage を呼ばない', () => {
    const processor = new AudioProcessor({
      processorOptions: { bufferSize: 80000, sampleRate: 16000 },
    });

    const channelData = new Float32Array(128).fill(0.5);
    processor.process([[channelData]]);

    expect(processor.port.postMessage).not.toHaveBeenCalled();
  });
});
