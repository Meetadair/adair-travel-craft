/**
 * The conversation loop.
 *
 * Adair answers, and when it needs a fact it calls a tool; we run the tool and
 * hand the result back, until it has nothing left to look up. The loop is
 * bounded: a model that keeps calling tools is a bug, not a feature, and after
 * MAX_TURNS we stop and return what we have.
 */
import { systemPrompt, type PromptContext } from "./system-prompt";
import { TOOLS, type ToolName } from "./tools";
import { runTool, type ToolContext } from "./tools.server";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 5;
const MAX_TOKENS = 1024;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string };

type ApiMessage = { role: "user" | "assistant"; content: string | ContentBlock[] };

export type AgentResult = {
  reply: string;
  /** Which tools ran, in order — shown in dev status and used in analytics. */
  toolsUsed: ToolName[];
  /** True when the loop hit its ceiling rather than finishing naturally. */
  truncated: boolean;
};

/** One model call. Kept separate so it can be stubbed in tests. */
async function callModel(
  system: string,
  messages: ApiMessage[],
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ content: ContentBlock[]; stopReason: string }> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
      tools: TOOLS,
    }),
    signal: signal ?? null,
  });

  if (!response.ok) {
    throw new Error(`anthropic ${response.status}`);
  }
  const data = (await response.json()) as {
    content?: ContentBlock[];
    stop_reason?: string;
  };
  return { content: data.content ?? [], stopReason: data.stop_reason ?? "end_turn" };
}

/** Every text block the model produced, joined. */
export function textOf(content: ContentBlock[]): string {
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

/** The tool calls in a response, in the order the model made them. */
export function toolCallsOf(
  content: ContentBlock[],
): Array<{ id: string; name: ToolName; input: unknown }> {
  return content
    .filter(
      (block): block is { type: "tool_use"; id: string; name: string; input: unknown } =>
        block.type === "tool_use",
    )
    .map((block) => ({ id: block.id, name: block.name as ToolName, input: block.input }));
}

export async function runAgent(
  history: ChatMessage[],
  promptContext: PromptContext,
  toolContext: ToolContext,
  options: { signal?: AbortSignal; callModelFn?: typeof callModel } = {},
): Promise<AgentResult> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  const call = options.callModelFn ?? callModel;
  if (!apiKey && !options.callModelFn) {
    return { reply: "", toolsUsed: [], truncated: false };
  }

  const system = systemPrompt(promptContext);
  const messages: ApiMessage[] = history.map((m) => ({ role: m.role, content: m.content }));
  const toolsUsed: ToolName[] = [];

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    const { content, stopReason } = await call(system, messages, apiKey ?? "", options.signal);

    if (stopReason !== "tool_use") {
      return { reply: textOf(content), toolsUsed, truncated: false };
    }

    const calls = toolCallsOf(content);
    if (!calls.length) {
      return { reply: textOf(content), toolsUsed, truncated: false };
    }

    messages.push({ role: "assistant", content });

    const results: ContentBlock[] = [];
    for (const toolCall of calls) {
      toolsUsed.push(toolCall.name);
      const output = await runTool(toolCall.name, toolCall.input, toolContext);
      results.push({ type: "tool_result", tool_use_id: toolCall.id, content: output });
    }
    messages.push({ role: "user", content: results });
  }

  // The ceiling was reached. We answer with whatever the last text was rather
  // than leaving the traveller with silence.
  const { content } = await call(system, messages, apiKey ?? "", options.signal);
  return { reply: textOf(content), toolsUsed, truncated: true };
}

export { callModel, MAX_TURNS };
