import { getEnv } from "@/lib/env";
import type { ProcessorProvider } from "@/lib/processor/types";
import { mockProcessorProvider } from "@/lib/processor/providers/mock";
import { n8nProcessorProvider } from "@/lib/processor/providers/n8n";

export function getProcessorProvider(): ProcessorProvider {
  const configured = getEnv("PROCESSOR_PROVIDER") ?? "mock";
  return configured === "n8n" ? n8nProcessorProvider : mockProcessorProvider;
}
