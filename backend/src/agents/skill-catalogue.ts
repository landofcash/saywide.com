import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { AgentSkills, Skill } from "@strands-agents/sdk/vended-plugins/skills";

export const skillCatalogue = [
  { id: "feedback-synthesis", version: "1.0.0", workflows: ["report"] },
  { id: "evidence-review", version: "1.0.0", workflows: ["report"] },
] as const;
export interface SkillVersion { id: string; version: string; contentHash: string }

// tsx reads repository assets; compiled deployments read the build's bundled copy.
const skillRoot = fileURLToPath(new URL(import.meta.url.endsWith(".ts") ? "../../skills/" : "../skills/", import.meta.url));

export async function readSkillFiles(directory: string): Promise<Array<[string, string]>> {
  const files: Array<[string, string]> = [];
  async function visit(path: string): Promise<void> {
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(path, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Skill symlinks are not supported");
      if (entry.isDirectory()) await visit(fullPath);
      else if (entry.isFile()) files.push([relative(directory, fullPath).replaceAll("\\", "/"), await readFile(fullPath, "utf8")]);
    }
  }
  await visit(directory);
  return files.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}

export function hashSkillFiles(files: Array<[string, string]>): string {
  // Include names and boundaries, not just concatenated contents. Normalize Git line endings.
  return createHash("sha256").update(JSON.stringify(files.map(([name, text]) => [name, text.replaceAll("\r\n", "\n")]))).digest("hex");
}

export async function loadReportSkills(root = skillRoot) {
  const skills: Skill[] = [];
  const manifest: SkillVersion[] = [];
  for (const entry of skillCatalogue) {
    const files = await readSkillFiles(join(root, entry.id));
    const main = files.find(([name]) => name === "SKILL.md");
    if (!main) throw new Error(`Missing SKILL.md for ${entry.id}`);
    const parsed = Skill.fromContent(main[1], { strict: true });
    if (parsed.name !== entry.id) throw new Error(`Skill name mismatch for ${entry.id}`);
    // Small trusted resources travel with activation; no arbitrary file-reading tool is exposed.
    skills.push(new Skill({ name: parsed.name, description: parsed.description,
      instructions: [parsed.instructions, ...files.filter(([name]) => name !== "SKILL.md").map(([name, text]) => `## Resource: ${name}\n\n${text}`)].join("\n\n"),
    }));
    manifest.push({ id: entry.id, version: entry.version, contentHash: hashSkillFiles(files) });
  }
  return { plugin: new AgentSkills({ skills, strict: true }), manifest };
}

export function deploymentRevision(): string | null {
  const revision = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.DEPLOYMENT_REVISION;
  return revision && /^[a-f0-9]{7,64}$/i.test(revision) ? revision : null;
}
