import { spawn } from "node:child_process";

export function formatArgv(argv) {
  return argv.map((value) => JSON.stringify(value)).join(" ");
}

export function runSkillCommand({ command, args, cwd }) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const child = spawn(command, args, { cwd, shell: false, stdio: "inherit" });
    child.once("error", (error) => settle({ error }));
    child.once("exit", (code, signal) => settle({ code, signal }));
  });
}
