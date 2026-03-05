/**
 * AudioWorklet プロセッサー
 * 入力音声を 16kHz にリサンプリングしてバッファリングし、
 * 一定サイズに達したらメインスレッドに送信する。
 */
class AudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    // 5秒分のバッファ（16kHz × 5秒 = 80000サンプル）
    this.bufferSize = options?.processorOptions?.bufferSize || 16000 * 5;
    this.sampleRate = options?.processorOptions?.sampleRate || 16000;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    if (!channelData) return true;

    // 入力サンプルレートから 16kHz へのリサンプリング比率
    const inputSampleRate = globalThis.sampleRate || 44100;
    const ratio = inputSampleRate / this.sampleRate;

    for (let i = 0; i < channelData.length; i += ratio) {
      const index = Math.floor(i);
      if (index < channelData.length) {
        this.buffer[this.bufferIndex] = channelData[index];
        this.bufferIndex++;

        if (this.bufferIndex >= this.bufferSize) {
          // バッファが満杯 → メインスレッドに送信
          this.port.postMessage({
            type: 'audio-chunk',
            audio: this.buffer.slice(0),
          });
          this.bufferIndex = 0;
        }
      }
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
