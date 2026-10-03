const { test } = require("node:test");
const assert = require("node:assert/strict");
const { getInvocation } = require("./dotnet.cjs");

test("check-db is a separate command and preserves credentials only in the child environment", () => {
  const parent = { Database__ConnectionString: "synthetic-secret" };
  const result = getInvocation("check-db", parent);
  assert.deepEqual(result.args.slice(-3), ["--", "--check-database", "true"]);
  assert.equal(result.env.ASPNETCORE_ENVIRONMENT, "Development");
  assert.equal(result.env.Database__ConnectionString, parent.Database__ConnectionString);
  assert.ok(!result.args.some(arg => arg.includes("synthetic-secret")));
  assert.equal(parent.ASPNETCORE_ENVIRONMENT, undefined);
});

test("migrate explicitly selects only the migrate command", () => {
  const result = getInvocation("migrate", {});
  assert.deepEqual(result.args.slice(-3), ["--", "--migrate-only", "true"]);
  assert.ok(!result.args.includes("--check-database"));
});

test("database utilities respect the deployment environment", () => {
  assert.equal(getInvocation("check-db", { ASPNETCORE_ENVIRONMENT: "Production" }).env.ASPNETCORE_ENVIRONMENT, "Production");
  const result = getInvocation("migrate", { DOTNET_ENVIRONMENT: "Staging" });
  assert.equal(result.env.DOTNET_ENVIRONMENT, "Staging");
  assert.equal(result.env.ASPNETCORE_ENVIRONMENT, undefined);
});

test("normal commands keep their original environment and release behavior", () => {
  assert.ok(getInvocation("dev", {}).args.includes("watch"));
  assert.equal(getInvocation("dev", {}).env.ASPNETCORE_ENVIRONMENT, undefined);
  assert.ok(getInvocation("start", {}).args.includes("--no-build"));
  assert.equal(getInvocation("start", {}).env.ASPNETCORE_ENVIRONMENT, undefined);
  assert.equal(getInvocation("build", {}).args[0], "build");
});

test("invalid commands fail rather than silently building", () => {
  assert.throws(() => getInvocation("unknown", {}), RangeError);
});
