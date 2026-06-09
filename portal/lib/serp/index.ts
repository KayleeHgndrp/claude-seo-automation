/**
 * LocalSerpProvider factory. Default = Serper (env LOCAL_SERP_PROVIDER=serper).
 * DataForSEO selected for the map-pack lookup only when explicitly configured;
 * the PROOF geo-grid always instantiates DataForSEO directly.
 */

import { LOCAL_SERP_PROVIDER } from "../env";
import type { LocalSerpProvider } from "./types";
import { SerperProvider } from "./serper";
import { DataForSeoProvider } from "./dataforseo";

export function getLocalSerpProvider(): LocalSerpProvider {
  if (LOCAL_SERP_PROVIDER === "dataforseo") return new DataForSeoProvider();
  return new SerperProvider();
}

export { SerperProvider, DataForSeoProvider };
export type { LocalSerpProvider } from "./types";
