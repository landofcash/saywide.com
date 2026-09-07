import { Sha256 } from "@aws-crypto/sha256-js";
import { fromLoginCredentials, fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { formatUrl } from "@aws-sdk/util-format-url";
import type { TranscriptionSessionResponse } from "@saywide/contracts";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";

import type { AppConfig } from "../config.js";

interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

type CredentialProvider = () => Promise<AwsCredentials>;

export interface TranscriptionSessionSigner {
  issueSession(now?: Date): Promise<TranscriptionSessionResponse>;
}

export class AwsTranscriptionSessionSigner implements TranscriptionSessionSigner {
  private readonly signer: SignatureV4;

  constructor(
    private readonly config: Pick<
      AppConfig,
      | "awsRegion"
      | "awsProfile"
      | "transcribeLanguageCode"
      | "transcribeSignedUrlSeconds"
      | "transcribeRecordingLimitSeconds"
    >,
    credentials?: CredentialProvider,
  ) {
    const credentialProvider = credentials ?? (config.awsProfile
      ? fromLoginCredentials({
        profile: config.awsProfile,
        clientConfig: { region: config.awsRegion },
      })
      : fromNodeProviderChain());
    this.signer = new SignatureV4({
      credentials: credentialProvider,
      region: config.awsRegion,
      service: "transcribe",
      sha256: Sha256,
    });
  }

  async issueSession(now = new Date()): Promise<TranscriptionSessionResponse> {
    const hostname = `transcribestreaming.${this.config.awsRegion}.amazonaws.com`;
    const request = new HttpRequest({
      protocol: "https:",
      hostname,
      port: 8443,
      method: "GET",
      path: "/stream-transcription-websocket",
      headers: { host: `${hostname}:8443` },
      query: {
        "language-code": this.config.transcribeLanguageCode,
        "media-encoding": "pcm",
        "sample-rate": "16000",
      },
    });
    const presigned = await this.signer.presign(request, {
      expiresIn: this.config.transcribeSignedUrlSeconds,
      signingDate: now,
    });

    return {
      websocketUrl: formatUrl(presigned).replace(/^https:/, "wss:"),
      expiresAt: new Date(now.getTime() + this.config.transcribeSignedUrlSeconds * 1000).toISOString(),
      recordingLimitSeconds: this.config.transcribeRecordingLimitSeconds,
    };
  }
}
