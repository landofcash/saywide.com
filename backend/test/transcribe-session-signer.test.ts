import { describe, expect, it } from "vitest";

import { AwsTranscriptionSessionSigner } from "../src/services/transcribe-session-signer.js";

describe("AwsTranscriptionSessionSigner", () => {
  it("creates a short-lived transcription-only WebSocket URL without exposing the secret key", async () => {
    const signer = new AwsTranscriptionSessionSigner({
      awsRegion: "us-east-1",
      awsProfile: undefined,
      transcribeLanguageCode: "en-US",
      transcribeSignedUrlSeconds: 60,
      transcribeRecordingLimitSeconds: 120,
    }, async () => ({
      accessKeyId: "AKIATESTACCESSKEY",
      secretAccessKey: "test-secret-that-must-not-appear",
      sessionToken: "test-session-token",
    }));

    const session = await signer.issueSession(new Date("2026-09-07T12:00:00.000Z"));
    const url = new URL(session.websocketUrl);

    expect(url.protocol).toBe("wss:");
    expect(url.hostname).toBe("transcribestreaming.us-east-1.amazonaws.com");
    expect(url.port).toBe("8443");
    expect(url.pathname).toBe("/stream-transcription-websocket");
    expect(url.searchParams.get("language-code")).toBe("en-US");
    expect(url.searchParams.get("media-encoding")).toBe("pcm");
    expect(url.searchParams.get("sample-rate")).toBe("16000");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("60");
    expect(url.searchParams.get("X-Amz-Security-Token")).toBe("test-session-token");
    expect(url.searchParams.get("X-Amz-Credential")).toContain("/us-east-1/transcribe/aws4_request");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(session.websocketUrl).not.toContain("test-secret-that-must-not-appear");
    expect(session.expiresAt).toBe("2026-09-07T12:01:00.000Z");
    expect(session.recordingLimitSeconds).toBe(120);
  });
});
