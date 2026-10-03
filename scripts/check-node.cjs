const minimumMajor = 22;
const currentMajor = Number(process.versions.node.split(".")[0]);

if (currentMajor < minimumMajor) {
  console.error(
    `\nRepairLedger requires Node.js ${minimumMajor} or newer. This terminal is using Node.js ${process.version}.\n` +
    "Install Node.js 22 or newer, then open a new PowerShell window and run:\n" +
    "  node -v\n  npm install\n  npm run dev\n" +
    "If node -v still shows the old version, run Get-Command node and fix your PATH or Node version manager.\n"
  );
  process.exit(1);
}
