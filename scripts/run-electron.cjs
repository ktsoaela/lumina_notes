/** Launch Electron with ELECTRON_RUN_AS_NODE truly unset (empty env still breaks Windows). */
delete process.env.ELECTRON_RUN_AS_NODE;
const { spawn } = require("child_process");
const electronPath = require("electron");
const child = spawn(electronPath, process.argv.slice(2), {
  stdio: "inherit",
  windowsHide: false,
  env: process.env,
});
child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
