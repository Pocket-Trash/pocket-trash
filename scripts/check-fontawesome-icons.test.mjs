import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/** Public validator command exercised from an isolated workspace. */
const command = fileURLToPath(
  new URL("./check-fontawesome-icons.mjs", import.meta.url),
);
/** Reviewed Kit package identity used by the application. */
const kit = "@awesome.me/kit-64c2f1f813";

/**
 * Creates source, inventory and synthetic Kit exports without downloading assets.
 * @param t - Test context owning the temporary workspace.
 * @returns The isolated workspace path.
 */
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "kit-inventory-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = {
    "apps/web/package.json": JSON.stringify({
      dependencies: { [kit]: "1.0.4" },
    }),
    "docs/fontawesome-icons.txt":
      "fa-classic fa-light fa-arrow-down\nfa-classic fa-light fa-circle-question\nfa-classic fa-solid fa-magnifying-glass\nfa-brands fa-discord\n",
    "apps/web/src/icons.tsx": `import { faArrowDown, faCircleQuestion as faQuestionCircle } from "${kit}/icons/classic/light";
import { faMagnifyingGlass } from "${kit}/icons/classic/solid";
import { faDiscord } from "${kit}/icons/classic/brands";`,
    [`apps/web/node_modules/${kit}/package.json`]: JSON.stringify({
      name: kit,
      version: "1.0.4",
      exports: {
        "./package.json": "./package.json",
        "./icons/classic/light": "./light.cjs",
        "./icons/classic/solid": "./solid.cjs",
        "./icons/classic/brands": "./brands.cjs",
      },
    }),
    [`apps/web/node_modules/${kit}/light.cjs`]:
      'exports.faArrowDown = { prefix: "fal", iconName: "arrow-down", icon: [] }; exports.faCircleQuestion = { prefix: "fal", iconName: "circle-question", icon: [] };',
    [`apps/web/node_modules/${kit}/solid.cjs`]:
      'exports.faMagnifyingGlass = { prefix: "fas", iconName: "magnifying-glass", icon: [] };',
    [`apps/web/node_modules/${kit}/brands.cjs`]:
      'exports.faDiscord = { prefix: "fab", iconName: "discord", icon: [] };',
  };
  for (const [name, contents] of Object.entries(files)) {
    await mkdir(join(root, name, ".."), { recursive: true });
    await writeFile(join(root, name), contents);
  }
  return root;
}

/**
 * Runs the validator's public CLI against a fixture workspace.
 * @param root - Workspace containing the application and inventory.
 * @returns The captured command result.
 */
function check(root) {
  return spawnSync(process.execPath, [command], {
    cwd: root,
    encoding: "utf8",
  });
}

test("inventory CLI accepts matching styles and a preserved local alias", async (t) => {
  const root = await fixture(t);
  const result = check(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /4 bundled Kit icons/);
});

test("inventory CLI requires the exact installed Kit revision", async (t) => {
  for (const version of ["^1.0.4", "1.0.5"]) {
    const root = await fixture(t);
    await writeFile(
      join(root, "apps/web/package.json"),
      JSON.stringify({ dependencies: { [kit]: version } }),
    );
    const result = check(root);
    assert.notEqual(result.status, 0, version);
    assert.match(result.stderr, /exact.*Kit|Kit.*version/);
  }
});

test("inventory CLI rejects full packs and non-individual Kit imports", async (t) => {
  for (const extra of [
    'import { faPlus } from "@fortawesome/pro-light-svg-icons";',
    `import { all } from "${kit}";`,
    `const all = await import("${kit}/icons");`,
    `const all = await import(\`${kit}/icons\`);`,
    `import { faArrowDown } from "${kit}/icons/invalid/light";`,
    `import all, { faArrowDown } from "${kit}/icons/classic/light";`,
    `export * from "${kit}/icons/classic/light";`,
    `import * as all from "${kit}/icons/classic/light";`,
  ]) {
    const root = await fixture(t);
    await writeFile(join(root, "apps/web/src/extra.ts"), extra);
    const result = check(root);
    assert.notEqual(result.status, 0, extra);
    assert.match(result.stderr, /full icon pack|individual Kit/);
  }
});

test("inventory CLI rejects duplicated inventory and definition style drift", async (t) => {
  const duplicate = await fixture(t);
  const inventory = join(duplicate, "docs/fontawesome-icons.txt");
  await writeFile(
    inventory,
    (await readFile(inventory, "utf8")) + "fa-brands fa-discord\n",
  );
  const duplicated = check(duplicate);
  assert.notEqual(duplicated.status, 0, duplicated.stdout);
  assert.match(duplicated.stderr, /Duplicate inventory/);
  const drift = await fixture(t);
  const module = join(drift, `apps/web/node_modules/${kit}/light.cjs`);
  await writeFile(
    module,
    (await readFile(module, "utf8")).replaceAll('"fal"', '"fas"'),
  );
  const drifted = check(drift);
  assert.notEqual(drifted.status, 0, drifted.stdout);
  assert.match(drifted.stderr, /style prefix/);
});

test("inventory CLI rejects malformed inventory syntax", async (t) => {
  const root = await fixture(t);
  const inventory = join(root, "docs/fontawesome-icons.txt");
  await writeFile(
    inventory,
    (await readFile(inventory, "utf8")).replace("fa-classic", "fa-unknown"),
  );
  const result = check(root);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /Invalid inventory line/);
});

test("inventory CLI rejects missing and unreviewed icons", async (t) => {
  for (const change of [
    "missing-inventory",
    "extra-inventory",
    "missing-export",
    "missing-import",
    "extra-export",
    "full-dependency",
  ]) {
    const root = await fixture(t);
    const inventory = join(root, "docs/fontawesome-icons.txt");
    const source = join(root, "apps/web/src/icons.tsx");
    const light = join(root, `apps/web/node_modules/${kit}/light.cjs`);
    if (change === "missing-inventory")
      await writeFile(
        inventory,
        (await readFile(inventory, "utf8")).replace(
          "fa-brands fa-discord\n",
          "",
        ),
      );
    if (change === "extra-inventory")
      await writeFile(
        inventory,
        (await readFile(inventory, "utf8")) + "fa-classic fa-light fa-plus\n",
      );
    if (change === "missing-export")
      await writeFile(
        light,
        (await readFile(light, "utf8")).replace("faArrowDown", "faDifferent"),
      );
    if (change === "missing-import")
      await writeFile(
        source,
        (await readFile(source, "utf8")).replace(
          /import \{ faDiscord \}[^;]+;/u,
          "",
        ),
      );
    if (change === "extra-export")
      await writeFile(
        light,
        (await readFile(light, "utf8")) +
          'exports.faPlus = { prefix: "fal", iconName: "plus", icon: [] };',
      );
    if (change === "full-dependency")
      await writeFile(
        join(root, "apps/web/package.json"),
        JSON.stringify({
          dependencies: {
            [kit]: "1.0.4",
            "@fortawesome/free-brands-svg-icons": "7.3.1",
          },
        }),
      );
    const result = check(root);
    assert.notEqual(result.status, 0, change);
    assert.match(
      result.stderr,
      /differ from inventory|Missing Kit export|full icon pack/,
    );
  }
});
