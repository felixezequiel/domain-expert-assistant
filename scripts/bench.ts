import { readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { execSync } from "node:child_process";

const SRC_DIR = resolve(import.meta.dirname!, "..", "src");
const BENCH_FILE_SUFFIX = ".bench.ts";
const SWC_REGISTER = "@swc-node/register/esm-register";

const ANSI_CLEAR_SCREEN = "\x1B[2J\x1B[H";
const ANSI_HIDE_CURSOR = "\x1B[?25l";
const ANSI_SHOW_CURSOR = "\x1B[?25h";
const ANSI_CYAN = "\x1B[36m";
const ANSI_DIM = "\x1B[2m";
const ANSI_BOLD = "\x1B[1m";
const ANSI_RESET = "\x1B[0m";
const ANSI_INVERSE = "\x1B[7m";

const KEY_UP = "\x1B[A";
const KEY_DOWN = "\x1B[B";
const KEY_ENTER = "\r";
const KEY_CTRL_C = "\x03";

const RUN_ALL_LABEL = "Run all benchmarks";

function discoverBenchFiles(): Array<string> {
  const allFiles = readdirSync(SRC_DIR, { recursive: true, encoding: "utf-8" });
  const benchFiles: Array<string> = [];

  for (const file of allFiles) {
    if (file.endsWith(BENCH_FILE_SUFFIX)) {
      const fullPath = resolve(SRC_DIR, file);
      benchFiles.push(fullPath);
    }
  }

  benchFiles.sort();
  return benchFiles;
}

function formatDisplayName(fullPath: string): string {
  const relativePath = relative(SRC_DIR, fullPath);
  return relativePath.replace(/\\/g, "/");
}

function extractBenchName(fullPath: string): string {
  const relativePath = formatDisplayName(fullPath);
  const fileName = relativePath.split("/").pop()!;
  return fileName.replace(BENCH_FILE_SUFFIX, "");
}

function renderMenu(options: Array<string>, selectedIndex: number): void {
  process.stdout.write(ANSI_CLEAR_SCREEN);
  process.stdout.write(
    ANSI_BOLD +
      "  Benchmarks" +
      ANSI_RESET +
      ANSI_DIM +
      " — use arrows to navigate, enter to select" +
      ANSI_RESET +
      "\n\n",
  );

  for (let index = 0; index < options.length; index++) {
    const isSelected = index === selectedIndex;

    if (isSelected) {
      process.stdout.write(
        "  " + ANSI_CYAN + ANSI_INVERSE + " " + options[index] + " " + ANSI_RESET + "\n",
      );
    } else {
      process.stdout.write("    " + ANSI_DIM + options[index] + ANSI_RESET + "\n");
    }
  }

  process.stdout.write("\n" + ANSI_DIM + "  esc/ctrl+c to cancel" + ANSI_RESET + "\n");
}

function interactiveSelect(options: Array<string>): Promise<number> {
  return new Promise((resolve, reject) => {
    let selectedIndex = 0;

    process.stdout.write(ANSI_HIDE_CURSOR);
    renderMenu(options, selectedIndex);

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");

    const onKeypress = (key: string): void => {
      if (key === KEY_CTRL_C || key === "\x1B") {
        cleanup();
        reject(new Error("cancelled"));
        return;
      }

      if (key === KEY_UP) {
        selectedIndex = selectedIndex - 1;
        if (selectedIndex < 0) {
          selectedIndex = options.length - 1;
        }
        renderMenu(options, selectedIndex);
        return;
      }

      if (key === KEY_DOWN) {
        selectedIndex = selectedIndex + 1;
        if (selectedIndex >= options.length) {
          selectedIndex = 0;
        }
        renderMenu(options, selectedIndex);
        return;
      }

      if (key === KEY_ENTER) {
        cleanup();
        resolve(selectedIndex);
        return;
      }
    };

    const cleanup = (): void => {
      process.stdin.removeListener("data", onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write(ANSI_SHOW_CURSOR);
      process.stdout.write(ANSI_CLEAR_SCREEN);
    };

    process.stdin.on("data", onKeypress);
  });
}

function runBenchFile(filePath: string): void {
  const displayName = formatDisplayName(filePath);
  console.log("\n" + ANSI_CYAN + "--- " + displayName + " ---" + ANSI_RESET + "\n");
  execSync("node --import " + SWC_REGISTER + " " + filePath, { stdio: "inherit" });
}

function runByIndex(benchFiles: Array<string>, menuIndex: number): void {
  const RUN_ALL_INDEX = 0;

  if (menuIndex === RUN_ALL_INDEX) {
    for (const file of benchFiles) {
      runBenchFile(file);
    }
    return;
  }

  const fileIndex = menuIndex - 1;
  const selectedFile = benchFiles[fileIndex];

  if (selectedFile === undefined) {
    console.error("Invalid selection: " + menuIndex);
    process.exit(1);
  }

  runBenchFile(selectedFile);
}

async function main(): Promise<void> {
  const benchFiles = discoverBenchFiles();

  if (benchFiles.length === 0) {
    console.log("No .bench.ts files found in src/");
    process.exit(0);
  }

  // Direct argument: npm run bench -- 1 or npm run bench -- all
  const directArg = process.argv[2];

  if (directArg !== undefined) {
    if (directArg === "all") {
      runByIndex(benchFiles, 0);
      return;
    }

    const parsed = parseInt(directArg, 10);

    if (!isNaN(parsed) && parsed >= 0 && parsed <= benchFiles.length) {
      runByIndex(benchFiles, parsed);
      return;
    }

    console.error("Invalid argument: " + directArg);
    console.error("Usage: npm run bench [number | all]");
    process.exit(1);
  }

  // Interactive mode
  const menuOptions: Array<string> = [RUN_ALL_LABEL];
  for (const file of benchFiles) {
    const benchName = extractBenchName(file);
    const displayPath = ANSI_RESET + ANSI_DIM + " " + formatDisplayName(file) + ANSI_RESET;
    menuOptions.push(benchName + displayPath);
  }

  try {
    const selectedIndex = await interactiveSelect(menuOptions);
    runByIndex(benchFiles, selectedIndex);
  } catch {
    console.log("Cancelled.");
  }
}

main();
