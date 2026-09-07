import { httpSaywideApi } from "./http-client";
import { mockSaywideApi } from "./mock-client";
import type { ApiCapabilities } from "./types";

export const isMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";
export const api = isMockApi ? mockSaywideApi : httpSaywideApi;
export const apiCapabilities: ApiCapabilities = {
  accounts: isMockApi,
  goalDrafting: isMockApi,
  reports: isMockApi,
  voice: true,
};
export type { ApiCapabilities, SaywideApi } from "./types";
