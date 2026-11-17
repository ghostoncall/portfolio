import { describe, expect, it } from "vitest";
import { getBinding, getEnv, resolveRuntimeEnv, runWithRuntimeConfig } from "@/lib/runtime-config";

describe("Cloudflare runtime configuration", () => {
  it("reads Nitro request bindings and gives explicit handler env precedence", () => {
    const hyperdrive = { connectionString: "postgres://test" };
    const request = Object.assign(new Request("https://portfolio.pages.dev"), {
      runtime: { cloudflare: { env: { HYPERDRIVE: hyperdrive, ADMIN_EMAIL: "request" } } },
    });

    const env = resolveRuntimeEnv(request, { ADMIN_EMAIL: "handler" });

    expect(env["HYPERDRIVE"]).toBe(hyperdrive);
    expect(env["ADMIN_EMAIL"]).toBe("handler");
  });

  it("supports requests without a Cloudflare runtime", () => {
    const env = resolveRuntimeEnv(new Request("http://localhost"), { ADMIN_EMAIL: "local" });
    expect(env["ADMIN_EMAIL"]).toBe("local");
  });

  it("keeps bindings isolated across concurrent requests", async () => {
    const checkRequest = (email: string) => {
      const hyperdrive = { connectionString: `postgres://${email}` };
      return runWithRuntimeConfig({ ADMIN_EMAIL: email, HYPERDRIVE: hyperdrive }, async () => {
        await Promise.resolve();
        expect(getEnv("ADMIN_EMAIL")).toBe(email);
        expect(getBinding("HYPERDRIVE")).toBe(hyperdrive);
      });
    };

    await Promise.all([checkRequest("first"), checkRequest("second")]);
  });
});
