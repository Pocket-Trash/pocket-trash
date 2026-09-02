import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const command = process.argv[2] ?? "check";
const configPath = new URL("../agent-skills.json", import.meta.url);
const statePath = new URL("../.agent-skills-installed.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));
const skills =
  Array.isArray(config.skills) && config.skills.length > 0
    ? config.skills
    : ["*"];

function normalizedVersion(version) {
  return version.replace(/^v/, "");
}

function hasSameSkills(installedSkills) {
  return (
    JSON.stringify([...(installedSkills ?? [])].sort()) ===
    JSON.stringify([...skills].sort())
  );
}

async function readInstalledState() {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch {
    return null;
  }
}

async function check() {
  const expected = normalizedVersion(config.version);
  const installed = await readInstalledState();
  if (
    !installed ||
    normalizedVersion(installed.version) !== expected ||
    !hasSameSkills(installed.skills)
  ) {
    console.log(
      "Your Pocket Trash skills are out of date. Run `pnpm agent-skills:update` to update to the latest.",
    );
  }
}

async function install() {
  const version = normalizedVersion(config.version);
  const args = [
    "--yes",
    "skills",
    "add",
    `${config.source}/tree/v${version}`,
    ...skills.flatMap((skill) => ["--skill", skill]),
    ...config.agents.flatMap((agent) => ["--agent", agent]),
    "-y",
  ];
  const result = spawnSync("npx", args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  await writeFile(
    statePath,
    `${JSON.stringify({ source: config.source, version, skills, installedAt: new Date().toISOString() }, null, 2)}\n`,
  );
}

if (command === "check") {
  await check();
} else if (command === "install" || command === "update") {
  await install();
} else {
  console.error("Usage: node scripts/agent-skills.mjs <check|install|update>");
  process.exit(1);
}
