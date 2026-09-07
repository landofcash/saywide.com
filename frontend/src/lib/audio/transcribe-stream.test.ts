import { describe, expect, it } from "vitest";

import { downsampleToPcm16, encodeAudioEvent } from "./transcribe-stream";

describe("Transcribe audio encoding", () => {
  it("downsamples microphone floats to signed 16-bit little-endian PCM", () => {
    const pcm = downsampleToPcm16(new Float32Array([-1, -1, -1, 1, 1, 1]), 48_000, 16_000);
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);

    expect(pcm.byteLength).toBe(4);
    expect(view.getInt16(0, true)).toBe(-32_768);
    expect(view.getInt16(2, true)).toBe(32_767);
  });

  it("wraps PCM bytes in an AWS event-stream AudioEvent frame", () => {
    const message = encodeAudioEvent(new Uint8Array([1, 2, 3, 4]));
    const view = new DataView(message.buffer, message.byteOffset, message.byteLength);

    expect(view.getUint32(0)).toBe(message.byteLength);
    expect(message.byteLength).toBeGreaterThan(4);
  });
});
