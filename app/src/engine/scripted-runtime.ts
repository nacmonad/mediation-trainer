import type { AgentResponse, DriverRuntime } from "./driver";
import type { ModelConfig } from "./domain";

export class ScriptedRuntime implements DriverRuntime {
  readonly config: ModelConfig = { provider: "ollama", model: "scripted-mock" };
  private cursor = 0;

  constructor(private readonly script: readonly AgentResponse[]) {}

  respond(): Promise<AgentResponse> {
    const response = this.script[this.cursor++] ?? { utterance: "", reaction: {} };
    return Promise.resolve(response);
  }
}
