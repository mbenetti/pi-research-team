import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, "..");
/**
 * Research Team TUI — Meta-agent dashboard for research teams
 *
 * A specialized dashboard to monitor and manage research sub-agents.
 * Loads agents defined in .pi/agents/teams.yaml.
 *
 * Commands:
 *   /team [name]        — load a specific team from teams.yaml (default: research-team)
 *   /researchers        — list active team members and their status
 *   /research-grid N    — set dashboard column count (default 3)
 *
 * Usage: pi -e extensions/research-tui.ts
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { applyExtensionDefaults } from "./themeMap.ts";

// ── Types ────────────────────────────────────────

interface ExpertDef {
	name: string;
	description: string;
	tools: string;
	systemPrompt: string;
	file: string;
	color?: string;
}

interface ExpertState {
	def: ExpertDef;
	status: "idle" | "researching" | "done" | "error";
	question: string;
	elapsed: number;
	lastLine: string;
	queryCount: number;
	timer?: ReturnType<typeof setInterval>;
}

// ── Helpers ──────────────────────────────────────

function displayName(name: string): string {
	return name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function hexToAnsiParams(hex: string): { bg: string; br: string } {
	if (!hex) return { bg: "\x1b[48;2;28;42;80m", br: "\x1b[38;2;85;120;210m" }; // Default slate
	const clean = hex.replace("#", "");
	if (clean.length !== 6) return { bg: "\x1b[48;2;28;42;80m", br: "\x1b[38;2;85;120;210m" };

	const r = parseInt(clean.substring(0, 2), 16);
	const g = parseInt(clean.substring(2, 4), 16);
	const b = parseInt(clean.substring(4, 6), 16);

	// Background is darker
	const bgR = Math.floor(r * 0.3);
	const bgG = Math.floor(g * 0.3);
	const bgB = Math.floor(b * 0.3);

	// Border is brighter
	const brR = Math.floor(r * 0.9);
	const brG = Math.floor(g * 0.9);
	const brB = Math.floor(b * 0.9);

	return {
		bg: `\x1b[48;2;${bgR};${bgG};${bgB}m`,
		br: `\x1b[38;2;${brR};${brG};${brB}m`,
	};
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
                // strip quotes from val
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.substring(1, val.length - 1);
                }
				frontmatter[key] = val;
			}
		}

		if (!frontmatter.name) return null;

		return {
			name: frontmatter.name,
			description: frontmatter.description || "",
			tools: frontmatter.tools || "read,grep,find,ls",
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

const FG_RESET = "\x1b[39m";
const BG_RESET = "\x1b[49m";

// ── Extension ────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const experts: Map<string, ExpertState> = new Map();
	let gridCols = 3;
	let widgetCtx: any;
	let currentTeamName = "research-team";

	function loadTeam(cwd: string, teamName: string) {
		let agentsDir = join(cwd, ".pi", "agents");
		if (!existsSync(join(agentsDir, "teams.yaml"))) agentsDir = join(packageRoot, "agents");
		const teamsFile = join(agentsDir, "teams.yaml");

		experts.clear();

		if (!existsSync(teamsFile)) {
			console.warn("teams.yaml not found at", teamsFile);
			return;
        }

		const teams = parseTeamsYaml(teamsFile);
		const members = teams[teamName];

		if (!members) {
			console.warn(`Team ${teamName} not found in teams.yaml`);
			return;
		}

		for (const member of members) {
			const fullPath = join(agentsDir, `${member}.md`);
			if (existsSync(fullPath)) {
				const def = parseAgentFile(fullPath);
				if (def) {
					const key = `${def.name.toLowerCase()}-${experts.size + 1}`;
					experts.set(key, {
						def,
						status: "idle",
						question: "",
						elapsed: 0,
						lastLine: "",
						queryCount: 0,
					});
				}
			}
		}
	}

	// ── Grid Rendering ───────────────────────────

	function renderCard(state: ExpertState, colWidth: number, theme: any): string[] {
		const w = colWidth - 2;
		const truncate = (s: string, max: number) => {
			const clean = s.replace(/[\r\n\t]/g, " ");
			if (visibleWidth(clean) <= max) return clean;
			return truncateToWidth(clean, max - 3) + "...";
		};

		const statusColor = state.status === "idle" ? "dim"
			: state.status === "researching" ? "accent"
			: state.status === "done" ? "success" : "error";
		const statusIcon = state.status === "idle" ? "○"
			: state.status === "researching" ? "◉"
			: state.status === "done" ? "✓" : "✗";

		const name = displayName(state.def.name);
		const nameStr = theme.fg("accent", theme.bold(truncate(name, w)));
		const nameVisible = visibleWidth(nameStr);

		const statusStr = `${statusIcon} ${state.status}`;
		const timeStr = state.status !== "idle" ? ` ${Math.round(state.elapsed / 1000)}s` : "";
		const queriesStr = state.queryCount > 0 ? ` (${state.queryCount})` : "";
		const statusLine = theme.fg(statusColor, statusStr + timeStr + queriesStr);
		const statusVisible = visibleWidth(statusLine);

		const workRaw = state.question || state.def.description;
		const workText = truncate(workRaw, Math.min(50, w - 1));
		const workLine = theme.fg("muted", workText);
		const workVisible = visibleWidth(workLine);

		const lastRaw = state.lastLine || "";
		const lastText = truncate(lastRaw, Math.min(50, w - 1));
		const lastLineRendered = lastText ? theme.fg("dim", lastText) : theme.fg("dim", "—");
		const lastVisible = visibleWidth(lastLineRendered);

		const colors = hexToAnsiParams(state.def.color || "");
		const bg  = colors.bg;
		const br  = colors.br;
		const bgr = bg ? BG_RESET : "";
		const fgr = br ? FG_RESET : "";

		const bord = (s: string) => bg + br + s + bgr + fgr;

		const top = "┌" + "─".repeat(w) + "┐";
		const bot = "└" + "─".repeat(w) + "┘";

		const border = (content: string, visLen: number) => {
			const pad = " ".repeat(Math.max(0, w - visLen));
			return bord("│") + bg + content + bg + pad + bgr + bord("│");
		};

		return [
			bord(top),
			border(" " + nameStr, 1 + nameVisible),
			border(" " + statusLine, 1 + statusVisible),
			border(" " + workLine, 1 + workVisible),
			border(" " + lastLineRendered, 1 + lastVisible),
			bord(bot),
		];
	}

	function updateWidget() {
		if (!widgetCtx) return;

		widgetCtx.ui.setWidget("research-tui-grid", (_tui: any, theme: any) => {

			return {
				render(width: number): string[] {
					if (experts.size === 0) {
						return ["", theme.fg("dim", `  No members found for team: ${currentTeamName}. Check .pi/agents/teams.yaml`)];
					}

					const cols = Math.min(gridCols, experts.size);
					const gap = 1;
					const colWidth = Math.floor((width - gap * (cols - 1)) / cols) - 1;
					if (colWidth <= 0) return [];
					const allExperts = Array.from(experts.values());

					const lines: string[] = [""]; // top margin

					for (let i = 0; i < allExperts.length; i += cols) {
						const rowExperts = allExperts.slice(i, i + cols);
						const cards = rowExperts.map(e => renderCard(e, colWidth, theme));

						while (cards.length < cols) {
							cards.push(Array(6).fill(" ".repeat(colWidth)));
						}

						const cardHeight = cards[0].length;
						for (let line = 0; line < cardHeight; line++) {
							lines.push(cards.map(card => card[line] || "").join(" ".repeat(gap)));
						}
					}

					return lines.map(line => truncateToWidth(line, width));
				},
				invalidate() {},
			};
		});
	}

	// ── Query Expert ─────────────────────────────

	function queryResearcher(
		expertName: string,
		question: string,
		ctx: any,
	): Promise<{ output: string; exitCode: number; elapsed: number }> {
		const targetName = expertName.toLowerCase();
		
		let state: ExpertState | undefined;
		let totalCount = 0;
		let busyCount = 0;

		for (const s of experts.values()) {
			if (s.def.name.toLowerCase() === targetName) {
				totalCount++;
				if (s.status === "idle" && !state) {
					state = s;
				} else if (s.status !== "idle") {
					busyCount++;
				}
			}
		}

		if (!state) {
			if (totalCount === 0) {
				const available = Array.from(new Set(Array.from(experts.values()).map(s => s.def.name))).join(", ");
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

		state.status = "researching";
		state.question = question;
		state.elapsed = 0;
		state.lastLine = "";
		state.queryCount++;
		updateWidget();

		const startTime = Date.now();
		state.timer = setInterval(() => {
			state.elapsed = Date.now() - startTime;
			updateWidget();
		}, 1000);

		const model = ctx.model
			? `${ctx.model.provider}/${ctx.model.id}`
			: "openrouter/google/gemini-3-flash-preview";

		const args = [
			"--mode", "json",
			"-p",
			"--no-session"
		];
		
		const langfuseExt = join(ctx.cwd || process.cwd(), "extensions", "langfuse-trace.ts");
		if (existsSync(langfuseExt)) {
			args.push("-e", langfuseExt);
		}

		args.push(
			"--model", model,
			"--tools", state.def.tools,
			"--thinking", "off",
			"--append-system-prompt", state.def.systemPrompt,
			question
		);

		const textChunks: string[] = [];

		return new Promise((resolve) => {
			const proc = spawn("pi", args, {
				stdio: ["ignore", "pipe", "pipe"],
				env: { ...process.env },
			});

			let buffer = "";

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
								state.lastLine = last;
								updateWidget();
							}
						}
					} catch {}
				}
			});

			proc.stderr!.setEncoding("utf-8");
			proc.stderr!.on("data", () => {});

			proc.on("close", (code) => {
				if (buffer.trim()) {
					try {
						const event = JSON.parse(buffer);
						if (event.type === "message_update") {
							const delta = event.assistantMessageEvent;
							if (delta?.type === "text_delta") textChunks.push(delta.delta || "");
						}
					} catch {}
				}

				clearInterval(state.timer);
				state.elapsed = Date.now() - startTime;
				state.status = code === 0 ? "done" : "error";

				const full = textChunks.join("");
				state.lastLine = full.split("\n").filter((l: string) => l.trim()).pop() || "";
				updateWidget();

				ctx.ui.notify(
					`${displayName(state.def.name)} ${state.status} in ${Math.round(state.elapsed / 1000)}s`,
					state.status === "done" ? "success" : "error"
				);

				resolve({
					output: full,
					exitCode: code ?? 1,
					elapsed: state.elapsed,
				});
			});

			proc.on("error", (err) => {
				clearInterval(state.timer);
				state.status = "error";
				state.lastLine = `Error: ${err.message}`;
				updateWidget();
				resolve({
					output: `Error spawning expert: ${err.message}`,
					exitCode: 1,
					elapsed: Date.now() - startTime,
				});
			});
		});
	}

	// ── query_researchers Tool (parallel) ───────────

	pi.registerTool({
		name: "query_researchers",
		label: "Query Researchers",
		description: `Query one or more research agents IN PARALLEL. All agents run simultaneously as concurrent subprocesses.
Pass an array of queries — each with an agent name and a specific question.`,

		parameters: Type.Object({
			queries: Type.Array(
				Type.Object({
					agent: Type.String({
						description: "Agent name (e.g. researcher, research-manager, scientist)",
					}),
					question: Type.String({
						description: "Task or question to assign to this researcher.",
					}),
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
						? result.output.slice(0, 12000) + "\n\n... [truncated — ask follow-up for more]"
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

			const sections = results.map(r => {
				const icon = r.status === "done" ? "✓" : "✗";
				return `## [${icon}] ${displayName(r.agent)} (${Math.round(r.elapsed / 1000)}s)\n\n${r.output}`;
			});

			return {
				content: [{ type: "text", text: sections.join("\n\n---\n\n") }],
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
				theme.fg("dim", " — ") +
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

			const lines = (details.results as any[]).map((r: any) => {
				const icon = r.status === "done" ? "✓" : "✗";
				const color = r.status === "done" ? "success" : "error";
				const elapsed = typeof r.elapsed === "number" ? Math.round(r.elapsed / 1000) : 0;
				return theme.fg(color, `${icon} ${displayName(r.agent)}`) +
					theme.fg("dim", ` ${elapsed}s`);
			});

			const header = lines.join(theme.fg("dim", " · "));

			if (options.expanded && details.results) {
				const expanded = (details.results as any[]).map((r: any) => {
					const output = r.fullOutput
						? (r.fullOutput.length > 4000 ? r.fullOutput.slice(0, 4000) + "\n... [truncated]" : r.fullOutput)
						: r.output || "";
					return theme.fg("accent", `── ${displayName(r.agent)} ──`) + "\n" + theme.fg("muted", output);
				});
				return new Text(header + "\n\n" + expanded.join("\n\n"), 0, 0);
			}

			return new Text(header, 0, 0);
		},
	});

	// ── Commands ─────────────────────────────────

	pi.registerCommand("team", {
		description: "Load a specific research team: /team <name>",
		handler: async (args, _ctx) => {
			const team = args?.trim() || "research-team";
			currentTeamName = team;
			loadTeam(_ctx.cwd, currentTeamName);
			updateWidget();
			_ctx.ui.notify(`Loaded team: ${currentTeamName} with ${experts.size} members`, "info");
			_ctx.ui.setStatus("research-tui", `Team: ${currentTeamName}`);
		},
	});

	pi.registerCommand("researchers", {
		description: "List available researchers and their status",
		handler: async (_args, _ctx) => {
			widgetCtx = _ctx;
			const lines = Array.from(experts.values())
				.map(s => `${displayName(s.def.name)} (${s.status}, queries: ${s.queryCount}): ${s.def.description}`)
				.join("\n");
			_ctx.ui.notify(lines || `No agents loaded in team ${currentTeamName}`, "info");
		},
	});

	pi.registerCommand("research-grid", {
		description: "Set expert grid columns: /research-grid <1-5>",
		handler: async (args, _ctx) => {
			widgetCtx = _ctx;
			const n = parseInt(args?.trim() || "", 10);
			if (n >= 1 && n <= 5) {
				gridCols = n;
				_ctx.ui.notify(`Grid set to ${gridCols} columns`, "info");
				updateWidget();
			} else {
				_ctx.ui.notify("Usage: /research-grid <1-5>", "error");
			}
		},
	});

	// ── System Prompt ────────────────────────────

	pi.on("before_agent_start", async (_event, _ctx) => {
		const expertCatalog = Array.from(experts.values())
			.map(s => `### ${displayName(s.def.name)}\n**Query as:** \`${s.def.name}\`\n${s.def.description}`)
			.join("\n\n");

		const expertNames = Array.from(experts.values()).map(s => displayName(s.def.name)).join(", ");

		const systemPrompt = `You are leading the ${currentTeamName}. You have access to ${experts.size} team members.
Use the \`query_researchers\` tool to assign tasks to these members in parallel.
Available members: ${expertNames}

${expertCatalog}`;

		return { systemPrompt };
	});

	// ── Session Start ────────────────────────────

	pi.on("session_start", async (_event, _ctx) => {
		applyExtensionDefaults(import.meta.url, _ctx);
		if (widgetCtx) {
			widgetCtx.ui.setWidget("research-tui-grid", undefined);
		}
		widgetCtx = _ctx;

		loadTeam(_ctx.cwd, currentTeamName);
		updateWidget();

		const expertNames = Array.from(experts.values()).map(s => displayName(s.def.name)).join(", ");
		_ctx.ui.setStatus("research-tui", `Team: ${currentTeamName}`);
		_ctx.ui.notify(
			`Research TUI loaded — ${experts.size} members in ${currentTeamName}: ${expertNames}\n\n` +
			`/team <name>      Switch teams (e.g. literature-team)\n` +
			`/researchers      List members & status\n` +
			`/research-grid N  Set grid columns (1-5)\n\n` +
			`Use the query_researchers tool to use them!`,
			"info",
		);

		// Custom footer
		_ctx.ui.setFooter((_tui, theme, _footerData) => ({
			dispose: () => {},
			invalidate() {},
			render(width: number): string[] {
				const model = _ctx.model?.id || "no-model";
				const usage = _ctx.getContextUsage();
				const pct = usage ? usage.percent : 0;
				const filled = Math.max(0, Math.min(10, Math.round(pct / 10)));
				const bar = "#".repeat(filled) + "-".repeat(10 - filled);

				const active = Array.from(experts.values()).filter(e => e.status === "researching").length;
				const done = Array.from(experts.values()).filter(e => e.status === "done").length;

				const left = theme.fg("dim", ` ${model}`) +
					theme.fg("muted", " · ") +
					theme.fg("accent", currentTeamName);
				const mid = active > 0
					? theme.fg("accent", ` ◉ ${active} working`)
					: done > 0
					? theme.fg("success", ` ✓ ${done} done`)
					: "";
				const right = theme.fg("dim", `[${bar}] ${Math.round(pct)}% `);
				
				// Calculate visible widths safely
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
