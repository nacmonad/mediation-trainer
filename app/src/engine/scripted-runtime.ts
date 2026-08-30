import type { AgentResponse, DriverRuntime } from "./driver";
import type { ModelConfig } from "./domain";

export class ScriptedRuntime implements DriverRuntime {
  readonly config: ModelConfig;
  private cursor = 0;

  constructor(private readonly script: readonly AgentResponse[], config: ModelConfig = { provider: "openai-compatible", model: "scripted-mock" }) {
    this.config = config;
  }

  respond(): Promise<AgentResponse> {
    const response = this.script[this.cursor++] ?? { utterance: "", reaction: {} };
    return Promise.resolve(response);
  }
}
