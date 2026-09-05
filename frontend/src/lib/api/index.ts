import { mockSaywideApi } from "./mock-client";

// This is the only switch the UI needs when the Fastify service is ready.
// A future HTTP adapter will implement the same SaywideApi interface.
export const api = mockSaywideApi;
export type { SaywideApi } from "./mock-client";
