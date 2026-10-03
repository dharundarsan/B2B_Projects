const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawn } = require("node:child_process");
const root = resolve(__dirname, "..");
const local = resolve(root, ".tools", "dotnet", process.platform === "win32" ? "dotnet.exe" : "dotnet");
const executable = existsSync(local) ? local : "dotnet";
const project = resolve(root, "apps", "api", "RepairLedger.Api.csproj");

function getInvocation(command = "build", environment = process.env) {
  const env = { ...environment };
  let args;
  switch (command) {
    case "dev":
      args = ["watch", "--project", project, "run"];
      break;
    case "start":
      args = ["run", "--project", project, "--no-launch-profile", "--no-build", "--configuration", "Release"];
      break;
    case "build":
      args = ["build", project, "--configuration", "Release"];
      break;
    case "check-db":
    case "migrate":
      // These are explicit local setup utilities unless the caller sets a deployment environment.
      if (!env.ASPNETCORE_ENVIRONMENT && !env.DOTNET_ENVIRONMENT) env.ASPNETCORE_ENVIRONMENT = "Development";
      args = ["run", "--project", project, "--no-launch-profile", "--configuration", "Release",
        "--", command === "check-db" ? "--check-database" : "--migrate-only", "true"];
      break;
    default:
      throw new RangeError("Unknown backend command. Use build, dev, start, check-db or migrate.");
  }
  return { args, env };
}

function run() {
  let invocation;
  try { invocation = getInvocation(process.argv[2] || "build"); }
  catch (error) { console.error(error.message); process.exitCode = 1; return; }
  const child = spawn(executable, invocation.args, { stdio: "inherit", cwd: root, env: invocation.env });
  child.on("error", () => { console.error("Install the .NET 10 SDK: https://dotnet.microsoft.com/download/dotnet/10.0"); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
}

module.exports = { getInvocation };
if (require.main === module) run();
