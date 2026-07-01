/**
 * Research Tree - A tree-style TUI dashboard for research teams
 *
 * Shows one line per agent with activity indicators:
 *   ● = researching  ✓ = done  ○ = idle  ✗ = error
 *   📄 context loaded  🔍 web search  ✏️ writing  ⚙️ tool running
 *   ⏱ elapsed time  │ metadata columns
 *
 * Usage: pi -e extensions/research-tree.ts
 * Commands:
 *   /research-tree [team] - load team from teams.yaml (default: research-team)
 *   /tree-status          - show current tree state
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { Type } from "@sinclair/typebox";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpertDef {
  name: string;
  displayName: string;
  description: string;
  tools: string[];
  systemPrompt: string;
  file: string;
  color?: string;
}

type ActivityIcon = "context" | "search" | "read" | "write" | "edit" | "bash" | "grep" | "find" | "ls" | "custom" | null;

interface AgentActivity {
  contextLoaded: boolean;
  lastTool: string | null;
  lastToolIcon: ActivityIcon;
  toolCount: Record<string, number>;
  currentTask: string;
  lastOutputLine: string;
  elapsed: number;
  startTime: number | null;
}

interface AgentState {
  def: ExpertDef;
  status: "idle" | "researching" | "done" | "error";
  activity: AgentActivity;
  color: { bg: string; br: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayName(name: string): string {
  return name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function parseAgentFile(filePath: string): ExpertDef | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;

    const frontmatter: Record<string, string> = {};
    for (const line of match[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        let val = line.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        frontmatter[key] = val;
      }
    }

    if (!frontmatter.name) return null;

    return {
      name: frontmatter.name,
      displayName: displayName(frontmatter.name),
      description: frontmatter.description || "",
      tools: (frontmatter.tools || "read,grep,find,ls").split(",").map(t => t.trim()),
      systemPrompt: match[2].trim(),
      file: filePath,
      color: frontmatter.color,
    };
  } catch {
    return null;
  }
}

function parseTeamsYaml(filePath: string): Record<string, string[]> {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const teams: Record<string, string[]> = {};
    let currentTeam = "";

    for (const line of raw.split("\n")) {
      const trimmed = line.trimEnd();
      if (!trimmed) continue;

      if (!line.startsWith(" ") && line.endsWith(":")) {
        currentTeam = line.slice(0, -1).trim();
        teams[currentTeam] = [];
      } else if (line.trim().startsWith("- ") && currentTeam) {
        teams[currentTeam].push(line.trim().slice(2).trim());
      }
    }
    return teams;
  } catch {
    return {};
  }
}

function hexToAnsiParams(hex: string): { bg: string; br: string } {
  if (!hex) return { bg: "", br: "" };
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return { bg: "", br: "" };

  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);

  const bgR = Math.floor(r * 0.3);
  const bgG = Math.floor(g * 0.3);
  const bgB = Math.floor(b * 0.3);

  const brR = Math.floor(r * 0.9);
  const brG = Math.floor(g * 0.9);
  const brB = Math.floor(b * 0.9);

  return {
    bg: `\x1b[48;2;${bgR};${bgG};${bgB}m`,
    br: `\x1b[38;2;${brR};${brG};${brB}m`,
  };
}

function toolToIcon(toolName: string): ActivityIcon {
  const t = toolName.toLowerCase().replace(/_/g, "");
  switch (t) {
    case "web_search":
    case "tavily":
    case "search":
      return "search";
    case "read":
      return "read";
    case "write":
      return "write";
    case "edit":
      return "edit";
    case "bash":
      return "bash";
    case "grep":
      return "grep";
    case "find":
      return "find";
    case "ls":
      return "ls";
    default:
      return t.includes("search") ? "search"
           : t.includes("read") ? "read"
           : t.includes("write") ? "write"
           : t.includes("edit") ? "edit"
           : t.includes("bash") || t.includes("run") || t.includes("exec") ? "bash"
           : "custom";
  }
}

function activityIconToEmoji(icon: ActivityIcon): string {
  switch (icon) {
    case "context": return "📄";
    case "search":  return "🔍";
    case "read":    return "📖";
    case "write":   return "✏️";
    case "edit":    return "🔧";
    case "bash":    return "⚙️";
    case "grep":    return "🔎";
    case "find":    return "📂";
    case "ls":      return "📋";
    case "custom":  return "🔨";
    default:        return "";
  }
}

function truncate(text: string, maxLen: number): string {
  const clean = text.replace(/[\r\n\t]/g, " ");
  if (visibleWidth(clean) <= maxLen) return clean;
  return truncateToWidth(clean, maxLen - 3) + "...";
}

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  agents: new Map<string, AgentState>(),
  currentTeam: "research-team",
  widgetCtx: null as any,
};

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let teamLoaded = false;

  function loadTeam(cwd: string, teamName: string) {
    const agentsDir = join(cwd, ".pi", "agents");
    const teamsFile = join(agentsDir, "teams.yaml");

    state.agents.clear();
    state.currentTeam = teamName;

    if (!existsSync(teamsFile)) {
      console.warn("teams.yaml not found at", teamsFile);
      return;
    }

    const teams = parseTeamsYaml(teamsFile);
    const members = teams[teamName];

    if (!members) {
      console.warn(`Team "${teamName}" not found in teams.yaml`);
      return;
    }

    for (const member of members) {
      const fullPath = join(agentsDir, `${member}.md`);
      if (existsSync(fullPath)) {
        const def = parseAgentFile(fullPath);
        if (def) {
          const colors = hexToAnsiParams(def.color || "");
          const key = member.toLowerCase().replace(/-/g, "_");
          state.agents.set(key, {
            def,
            status: "idle",
            activity: {
              contextLoaded: false,
              lastTool: null,
              lastToolIcon: null,
              toolCount: {},
              currentTask: "",
              lastOutputLine: "",
              elapsed: 0,
              startTime: null,
            },
            color: colors,
          });
        }
      }
    }

    teamLoaded = true;
  }

  function updateWidget() {
    if (!state.widgetCtx || !teamLoaded) return;

    state.widgetCtx.ui.setWidget("research-tree", (_tui: any, theme: any) => ({
      render(width: number): string[] {
        if (state.agents.size === 0) {
          return [
            "",
            theme.fg("dim", `  No members for team: ${state.currentTeam}`),
            theme.fg("dim", `  Check .pi/agents/teams.yaml`),
          ];
        }

        const lines: string[] = [];

        // Header
        const header = theme.fg("accent", theme.bold("  Research Team"))
          + theme.fg("dim", `  │  ${state.currentTeam}`);
        lines.push(header);
        lines.push(theme.fg("dim", "  ─".repeat(Math.min(60, Math.floor(width / 3)))));

        // Agent lines
        for (const [key, agent] of state.agents) {
          const line = renderAgentLine(agent, width - 4, theme);
          lines.push(line);
        }

        // Footer
        lines.push("");
        const active = Array.from(state.agents.values()).filter(a => a.status === "researching").length;
        const done = Array.from(state.agents.values()).filter(a => a.status === "done").length;
        const total = state.agents.size;

        if (active > 0) {
          lines.push(theme.fg("accent", `  ◉ ${active} active`) + theme.fg("dim", `  ·  ${done}/${total} done`));
        } else if (done > 0) {
          lines.push(theme.fg("success", `  ✓ All ${done} agents completed`) + theme.fg("dim", `  ·  ${done}/${total}`));
        } else {
          lines.push(theme.fg("dim", `  ○ Waiting for research to begin...`));
        }

        lines.push(theme.fg("dim", `  ↑↓ navigate  ↑ space toggle  esc close`));

        return lines.map(l => truncateToWidth(l, width));
      },
      invalidate() {},
      handleInput: undefined,
    }));
  }

  function renderAgentLine(agent: AgentState, maxWidth: number, theme: any): string {
    const { def, status, activity, color } = agent;

    // Status icon + color
    const statusColor = status === "idle" ? "dim"
      : status === "researching" ? "accent"
      : status === "done" ? "success"
      : "error";

    const statusIcon = status === "idle" ? "○"
      : status === "researching" ? "◉"
      : status === "done" ? "✓"
      : "✗";

    // Build activity badges — show at most 2 most recent icons to prevent overflow
    const badges: string[] = [];

    if (activity.lastTool) {
      const icon = activityIconToEmoji(activity.lastToolIcon);
      badges.unshift(icon); // newest first
    }

    if (badges.length === 0 && activity.contextLoaded) {
      badges.push(activityIconToEmoji("context"));
    }

    // Count tools used for metadata
    const totalTools = Object.values(activity.toolCount).reduce((a, b) => a + b, 0);
    if (totalTools > 0 && badges.length === 0) {
      badges.push(activityIconToEmoji("custom"));
    }

    // FIX: Fixed-width badge column (8 chars) — only show most recent 2 icons
    const MAX_BADGES = 2;
    const badgeText = badges.slice(0, MAX_BADGES).join("") || "  ";
    const badgeVisible = visibleWidth(badgeText);
    const badgeWidth = 8; // Fixed column width

    // Name with background color
    const nameStr = theme.fg("accent", theme.bold(def.displayName));
    const nameVisible = visibleWidth(nameStr);

    // Current task (truncate to remaining space)
    const remaining = Math.max(15, maxWidth - nameVisible - badgeWidth - 14);
    const taskText = truncate(activity.currentTask || def.description, remaining);

    // Time + tool count
    const elapsedText = activity.startTime
      ? theme.fg("dim", ` (${Math.round(activity.elapsed / 1000)}s)`)
      : "";
    const toolText = totalTools > 0
      ? theme.fg("dim", ` [${totalTools}t]`)
      : "";

    // Compose line with FIXED COLUMNS
    const bg = color.bg ? color.bg : "";
    const bgR = color.bg ? "\x1b[49m" : "";

    const colorize = (s: string, c: string) => {
      return (bg ? bg : "") + theme.fg(c, s) + (bg ? bgR : "");
    };

    // Column 1: Status icon (4 chars)
    let line = colorize(`  ${statusIcon} `, statusColor);
    
    // Column 2: Activity badges (fixed 8-char column, left-aligned with padding)
    const padBadge = " ".repeat(Math.max(0, badgeWidth - badgeVisible));
    line += colorize(badgeText + padBadge, status === "researching" ? "accent" : "dim");
    
    // Column 3: Agent name (bold, accent color)
    line += colorize(nameStr, "accent");

    // Column 4: Task (muted, truncated)
    if (taskText) {
      line += colorize(`  ${taskText}`, "muted");
    }

    // Column 5: Time + tool count (dim)
    if (elapsedText || toolText) {
      line += colorize(elapsedText + toolText, "dim");
    }

    return truncateToWidth(line, maxWidth + 2);
  }

  // ── Event Handlers for Activity Tracking ─────────────────────────────

  function getAgentForTool(toolName: string): string | null {
    // Heuristic: match tool to agent based on the agent's declared tools
    // For multi-agent parallel queries, we track which agent is doing what
    // via the query_researchers tool's sub-processes
    // Currently, this is a best-effort mapping
    for (const [key, agent] of state.agents) {
      if (agent.def.tools.some(t => toolName.includes(t.toLowerCase()) || t.toLowerCase().includes(toolName.toLowerCase()))) {
        return key;
      }
    }
    // Fallback: assign to first researching agent
    for (const [key, agent] of state.agents) {
      if (agent.status === "researching") return key;
    }
    return null;
  }

  // Track context loading
  pi.on("context", async (event, ctx) => {
    const msgCount = event.messages?.length || 0;
    for (const [key, agent] of state.agents) {
      if (agent.status === "researching") {
        agent.activity.contextLoaded = true;
        agent.activity.currentTask = `Context: ${msgCount} messages`;
        updateWidget();
      }
    }
  });

  // Track tool execution starts
  pi.on("tool_execution_start", async (event, ctx) => {
    for (const [key, agent] of state.agents) {
      if (agent.status === "researching") {
        agent.status = "researching";
        agent.activity.lastTool = event.toolName;
        agent.activity.lastToolIcon = toolToIcon(event.toolName);
        agent.activity.toolCount[event.toolName] = (agent.activity.toolCount[event.toolName] || 0) + 1;
        if (!agent.activity.startTime) {
          agent.activity.startTime = Date.now();
        }
        agent.activity.currentTask = `Running: ${event.toolName}`;
        updateWidget();
      }
    }
  });

  // Track tool results (completion)
  pi.on("tool_result", async (event, ctx) => {
    for (const [key, agent] of state.agents) {
      if (agent.status === "researching") {
        const content = event.content?.[0]?.text || "";
        const lines = content.split("\n").filter(l => l.trim());
        agent.activity.lastOutputLine = lines[lines.length - 1]?.slice(0, 80) || "";
        agent.activity.currentTask = agent.activity.lastOutputLine || event.toolName;
        updateWidget();
      }
    }
  });

  pi.on("tool_execution_end", async (event, ctx) => {
    for (const [key, agent] of state.agents) {
      if (agent.status === "researching") {
        agent.activity.elapsed = Date.now() - (agent.activity.startTime || Date.now());
        updateWidget();
      }
    }
  });

  // Track agent turns
  pi.on("turn_start", async (event, ctx) => {
    for (const [key, agent] of state.agents) {
      if (agent.status === "researching") {
        agent.activity.startTime = Date.now();
      }
    }
  });

  pi.on("turn_end", async (event, ctx) => {
    for (const [key, agent] of state.agents) {
      if (agent.status === "researching") {
        agent.activity.elapsed = Date.now() - (agent.activity.startTime || Date.now());
      }
    }
  });

  // ── query_researchers Tool ───────────────────────────────────────────

  pi.registerTool({
    name: "query_researchers",
    label: "Query Researchers",
    description: "Query one or more research agents IN PARALLEL. All agents run simultaneously as concurrent subprocesses.\nPass an array of queries - each with an agent name and a specific question. All experts start at the same time and their results are returned together.",

    parameters: Type.Object({
      queries: Type.Array(
        Type.Object({
          agent: Type.String({ description: "Agent name (e.g. researcher, research-manager, scientist)" }),
          question: Type.String({ description: "Task or question to assign to this researcher." }),
        }),
        { description: "Array of research tasks to run in parallel" },
      ),
    }),

    async execute(_toolCallId, params, _signal, onUpdate, ctx) {
      const { queries } = params as { queries: { agent: string; question: string }[] };

      if (!queries || queries.length === 0) {
        return {
          content: [{ type: "text", text: "No queries provided." }],
          details: { results: [], status: "error" },
        };
      }

      const names = queries.map(q => displayName(q.agent)).join(", ");
      if (onUpdate) {
        onUpdate({
          content: [{ type: "text", text: `Querying ${queries.length} agents in parallel: ${names}` }],
          details: { queries, status: "researching", results: [] },
        });
      }

      const settled = await Promise.allSettled(
        queries.map(async ({ agent, question }) => {
          const result = await queryResearcher(agent, question, ctx);
          const truncated = result.output.length > 12000
            ? result.output.slice(0, 12000) + "\n\n... [truncated - ask follow-up for more]"
            : result.output;
          const status = result.exitCode === 0 ? "done" : "error";
          return {
            agent,
            question,
            status,
            elapsed: result.elapsed,
            exitCode: result.exitCode,
            output: truncated,
            fullOutput: result.output,
          };
        }),
      );

      const results = settled.map((s, i) =>
        s.status === "fulfilled"
          ? s.value
          : {
            agent: queries[i].agent,
            question: queries[i].question,
            status: "error" as const,
            elapsed: 0,
            exitCode: 1,
            output: `Error: ${(s.reason as any)?.message || s.reason}`,
            fullOutput: "",
          },
      );

      // Update agent states based on results
      for (const result of results) {
        const key = result.agent.toLowerCase().replace(/-/g, "_");
        const agent = state.agents.get(key);
        if (agent) {
          agent.status = result.status === "done" ? "done" : "error";
          agent.activity.elapsed = result.elapsed;
          agent.activity.currentTask = result.status === "done" ? "Complete" : "Failed";
          agent.activity.contextLoaded = false;
          updateWidget();
        }
      }

      // CONTEXT SAFETY: Never dump full output into manager context.
      // Return only metadata/summaries. Full content stored in `details` for expand-only.
      const summaryLines = results.map((r, i) => {
        const icon = r.status === "done" ? "✓" : "✗";
        // Extract a brief summary - first 200 chars of output, or a meaningful snippet
        const brief = r.output
          ? r.output.split(/\n/).filter((l: string) => l.trim()).slice(0, 3).join(" \n ").slice(0, 200)
          : "(no output)";
        return `${icon} [${i + 1}] ${displayName(r.agent)} (${Math.round(r.elapsed / 1000)}s): ${brief}`;
      });

      return {
        content: [{ type: "text", text: summaryLines.join("\n\n") }],
        details: {
          results,
          status: results.every(r => r.status === "done") ? "done" : "partial",
        },
      };
    },

    renderCall(args, theme) {
      const queries = (args as any).queries || [];
      const names = queries.map((q: any) => displayName(q.agent || "?")).join(", ");
      return new Text(
        theme.fg("toolTitle", theme.bold("query_researchers ")) +
        theme.fg("accent", `${queries.length} parallel`) +
        theme.fg("dim", " - ") +
        theme.fg("muted", names),
        0, 0,
      );
    },

    renderResult(result, options, theme) {
      const details = result.details as any;
      if (!details?.results) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      if (options.isPartial || details.status === "researching") {
        const count = details.queries?.length || "?";
        return new Text(
          theme.fg("accent", `◉ ${count} agents`) +
          theme.fg("dim", " researching in parallel..."),
          0, 0,
        );
      }

      // Compact summary (always visible) - metadata only, no content
      const lines = (details.results as any[]).map((r: any, i: number) => {
        const icon = r.status === "done" ? "✓" : "✗";
        const color = r.status === "done" ? "success" : "error";
        const elapsed = typeof r.elapsed === "number" ? Math.round(r.elapsed / 1000) : 0;
        const brief = (r.output || "(empty)").split(/\n/).filter((l: string) => l.trim()).slice(0, 2).join(" \n ");
        return theme.fg(color, `${icon} [${i + 1}] ${displayName(r.agent)}`) +
          theme.fg("dim", ` ${elapsed}s`) +
          theme.fg("muted", `  ${brief.slice(0, 60)}`);
      });

      const header = lines.join("\n");

      // Full content ONLY on expand
      if (options.expanded && details.results) {
        const expanded = (details.results as any[]).map((r: any) => {
          const output = r.fullOutput || r.output || "";
          const truncated = output.length > 3000 ? output.slice(0, 3000) + "\n... [truncated]" : output;
          return theme.fg("accent", `── ${displayName(r.agent)} ── (${r.elapsed}ms) ──`) + "\n" + theme.fg("muted", truncated);
        });
        return new Text(header + "\n\n" + expanded.join("\n\n"), 0, 0);
      }

      return new Text(header + "\n\n" + theme.fg("dim", "[expand to see full results]"), 0, 0);
    },
  });

  // ── Helper: Spawn Researcher Sub-process ─────────────────────────────

  function queryResearcher(
    expertName: string,
    question: string,
    ctx: any,
  ): Promise<{ output: string; exitCode: number; elapsed: number }> {
    const targetName = expertName.toLowerCase();

    let stateKey: string | null = null;
    let totalCount = 0;

    for (const [key, s] of state.agents) {
      if (s.def.name.toLowerCase() === targetName) {
        totalCount++;
        if (s.status === "idle" && !stateKey) {
          stateKey = key;
        }
      }
    }

    if (!stateKey) {
      if (totalCount === 0) {
        const available = Array.from(state.agents.values()).map(s => displayName(s.def.name)).join(", ");
        return Promise.resolve({
          output: `Team member "${expertName}" not found. Available: ${available}`,
          exitCode: 1,
          elapsed: 0,
        });
      } else {
        return Promise.resolve({
          output: `All ${totalCount} instances of "${displayName(expertName)}" are currently busy. Wait for them to finish.`,
          exitCode: 1,
          elapsed: 0,
        });
      }
    }

    // Mark agent as researching so other concurrent queries see it as busy
    const agent = state.agents.get(stateKey!);
    if (agent) {
      agent.status = "researching";
      agent.activity.startTime = Date.now();
      agent.activity.currentTask = question.slice(0, 60);
      agent.activity.elapsed = 0;
      updateWidget();
    }

    const startTime = Date.now();
    const model = ctx.model
      ? `${ctx.model.provider}/${ctx.model.id}`
      : "openrouter/google/gemini-3-flash-preview";

    const { spawn } = require("child_process") as any;

    // Build extension args - detect if langfuse is loaded in parent process
    const extArgs: string[] = [];
    if (process.env.LANGFUSE_SECRET_KEY) {
      const lfExt = join(ctx.cwd || process.cwd(), "extensions", "langfuse-trace.ts");
      if (require("fs").existsSync(lfExt)) {
        extArgs.push("-e", lfExt);
      }
    }

    const args = [
      ...extArgs,
      "--mode", "json",
      "-p",
      "--no-session",
      "--model", model,
      "--tools", state.agents.get(stateKey)!.def.tools.join(","),
      "--thinking", "off",
      "--append-system-prompt", state.agents.get(stateKey)!.def.systemPrompt,
      question,
    ];

    const textChunks: string[] = [];
    let buffer = "";

    return new Promise((resolve) => {
      const proc = spawn("pi", args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      });

      proc.stdout!.setEncoding("utf-8");
      proc.stdout!.on("data", (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "message_update") {
              const delta = event.assistantMessageEvent;
              if (delta?.type === "text_delta") {
                textChunks.push(delta.delta || "");
                const full = textChunks.join("");
                const last = full.split("\n").filter((l: string) => l.trim()).pop() || "";
                const agent = state.agents.get(stateKey!);
                if (agent) {
                  agent.activity.lastOutputLine = last;
                  agent.activity.currentTask = last.slice(0, 60);
                  updateWidget();
                }
              }
            } else if (event.type === "tool_execution_start") {
              const agent = state.agents.get(stateKey!);
              if (agent) {
                agent.activity.lastTool = event.toolName;
                agent.activity.lastToolIcon = toolToIcon(event.toolName);
                agent.activity.toolCount[event.toolName] = (agent.activity.toolCount[event.toolName] || 0) + 1;
                agent.activity.contextLoaded = true;
                agent.activity.currentTask = `Running: ${event.toolName}`;
                updateWidget();
              }
            }
          } catch {}
        }
      });

      proc.stderr!.setEncoding("utf-8");
      proc.stderr!.on("data", () => {});

      proc.on("close", (code: number | null) => {
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer);
            if (event.type === "message_update") {
              const delta = event.assistantMessageEvent;
              if (delta?.type === "text_delta") textChunks.push(delta.delta || "");
            }
          } catch {}
        }

        const elapsed = Date.now() - startTime;
        const agent = state.agents.get(stateKey!);
        if (agent) {
          agent.status = code === 0 ? "done" : "error";
          agent.activity.elapsed = elapsed;
          agent.activity.currentTask = code === 0 ? "Complete" : `Error (exit ${code})`;
          agent.activity.contextLoaded = false;
          updateWidget();
        }

        process.stderr.write(`📊 Agent ${expertName} ${code === 0 ? "done" : "error"} in ${elapsed}ms\n`);

        ctx.ui.notify(
          `${displayName(expertName)} ${code === 0 ? "done" : "error"} in ${Math.round(elapsed / 1000)}s`,
          code === 0 ? "success" : "error"
        );

        resolve({
          output: textChunks.join(""),
          exitCode: code ?? 1,
          elapsed,
        });
      });

      proc.on("error", (err: Error) => {
        const elapsed = Date.now() - startTime;
        const agent = state.agents.get(stateKey!);
        if (agent) {
          agent.status = "error";
          agent.activity.currentTask = `Error: ${err.message}`;
          updateWidget();
        }

        resolve({
          output: `Error spawning expert: ${err.message}`,
          exitCode: 1,
          elapsed,
        });
      });
    });
  }

  // ── Commands ─────────────────────────────────────────────────────────

  pi.registerCommand("research-tree", {
    description: "Load a specific research team from teams.yaml: /research-tree [team-name]",
    handler: async (args, _ctx) => {
      const team = (args?.trim() || "research-team") as string;
      state.widgetCtx = _ctx;
      loadTeam(_ctx.cwd, team);
      updateWidget();
      _ctx.ui.notify(`Loaded team: ${team} with ${state.agents.size} members`, "info");
      _ctx.ui.setStatus("research-tree", `Team: ${team}`);
    },
  });

  pi.registerCommand("tree-status", {
    description: "Show current tree state and agent status",
    handler: async (_args, _ctx) => {
      const lines = Array.from(state.agents.values())
        .map(s => `${displayName(s.def.name)}: ${s.status}${s.activity.lastTool ? ` (last: ${s.activity.lastTool})` : ""}`)
        .join("\n");
      _ctx.ui.notify(lines || `No agents loaded in team ${state.currentTeam}`, "info");
    },
  });

  // ── System Prompt ────────────────────────────────────────────────────

  pi.on("before_agent_start", async (_event, _ctx) => {
    const expertCatalog = Array.from(state.agents.values())
      .map(s => `### ${displayName(s.def.name)}\n**Query as:** \`${s.def.name}\`\n${s.def.description}`)
      .join("\n\n");

    const expertNames = Array.from(state.agents.values()).map(s => displayName(s.def.name)).join(", ");

    const systemPrompt = `You are leading the ${state.currentTeam}. You have access to ${state.agents.size} team members.
Use the \`query_researchers\` tool to assign tasks to these members in parallel.
Available members: ${expertNames}

${expertCatalog}`;

    return { systemPrompt };
  });

  // ── Session Start ────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    state.widgetCtx = ctx;
    loadTeam(ctx.cwd, state.currentTeam);
    updateWidget();

    const expertNames = Array.from(state.agents.values()).map(s => displayName(s.def.name)).join(", ");
    ctx.ui.setStatus("research-tree", `Team: ${state.currentTeam}`);
    ctx.ui.notify(
      `Research Tree loaded - ${state.agents.size} members in ${state.currentTeam}: ${expertNames}\n\n` +
      `/research-tree [name]  Switch teams (e.g. /research-tree literature-team)\n` +
      `/tree-status           Show current agent status\n\n` +
      `Use the query_researchers tool to use them!`,
      "info",
    );

    // Custom footer
    ctx.ui.setFooter((_tui: any, theme: any, _footerData: any) => ({
      dispose: () => {},
      invalidate() {},
      render(width: number): string[] {
        const model = ctx.model?.id || "no-model";
        const usage = (ctx as any).getContextUsage?.();
        const pct = usage ? usage.percent : 0;
        const filled = Math.max(0, Math.min(10, Math.round(pct / 10)));
        const bar = "#".repeat(filled) + "-".repeat(10 - filled);

        const active = Array.from(state.agents.values()).filter(a => a.status === "researching").length;
        const done = Array.from(state.agents.values()).filter(a => a.status === "done").length;

        const left = theme.fg("dim", ` ${model}`)
          + theme.fg("muted", " · ")
          + theme.fg("accent", state.currentTeam);
        const mid = active > 0
          ? theme.fg("accent", ` ◉ ${active} active`)
          : done > 0
          ? theme.fg("success", ` ✓ ${done} done`)
          : theme.fg("dim", " ○ idle");
        const right = theme.fg("dim", `[${bar}] ${Math.round(pct)}%`);

        const leftW = visibleWidth(left);
        const midW = visibleWidth(mid);
        const rightW = visibleWidth(right);
        const padLen = width - leftW - midW - rightW;
        const pad = padLen > 0 ? " ".repeat(padLen) : " ";

        return [truncateToWidth(left + mid + pad + right, width)];
      },
    }));
  });
}
