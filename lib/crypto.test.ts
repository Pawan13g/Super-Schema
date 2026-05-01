import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.AUTH_SECRET ||= "test-secret-do-not-use-in-prod";
});

describe("crypto helpers", () => {
  it("round-trips an api key", async () => {
    const { encryptSecret, decryptSecret } = await import("./crypto");
    const plain = "sk-test-1234567890abcdef";
    const enc = encryptSecret(plain);
    expect(enc).not.toEqual(plain);
    expect(decryptSecret(enc)).toEqual(plain);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", async () => {
    const { encryptSecret } = await import("./crypto");
    const a = encryptSecret("same-key");
    const b = encryptSecret("same-key");
    expect(a).not.toEqual(b);
  });

  it("masks short and long keys readably", async () => {
    const { maskKey } = await import("./crypto");
    expect(maskKey("")).toEqual("");
    expect(maskKey("abcd")).toEqual("••••");
    expect(maskKey("sk-abcdef-1234567890")).toMatch(/^sk-a/);
  });

  it("rejects tampered ciphertext", async () => {
    const { encryptSecret, decryptSecret } = await import("./crypto");
    const enc = encryptSecret("hello");
    const tampered =
      Buffer.from(enc, "base64").toString("base64").slice(0, -2) + "==";
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
