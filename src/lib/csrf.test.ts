import { describe, it, expect } from "vitest";
import { isMutationMethod, checkCsrfOrigin } from "./csrf";

describe("isMutationMethod", () => {
  it("returns true for POST, PUT, PATCH, DELETE", () => {
    expect(isMutationMethod("POST")).toBe(true);
    expect(isMutationMethod("put")).toBe(true);
    expect(isMutationMethod("Patch")).toBe(true);
    expect(isMutationMethod("DELETE")).toBe(true);
  });

  it("returns false for GET, HEAD, OPTIONS", () => {
    expect(isMutationMethod("GET")).toBe(false);
    expect(isMutationMethod("HEAD")).toBe(false);
    expect(isMutationMethod("OPTIONS")).toBe(false);
  });
});

describe("checkCsrfOrigin", () => {
  it("rejects when origin is missing", () => {
    expect(checkCsrfOrigin(null, [], "http://x")).toEqual({
      ok: false,
      reason: "missing_origin",
    });
  });

  it("rejects invalid URLs", () => {
    expect(checkCsrfOrigin("not-a-url", [], "http://x")).toEqual({
      ok: false,
      reason: "invalid_origin",
    });
  });

  it("allows when origin matches expectedOrigin", () => {
    expect(checkCsrfOrigin("http://localhost:3001", [], "http://localhost:3001")).toEqual({
      ok: true,
    });
  });

  it("allows when origin is in allowedOrigins list", () => {
    expect(checkCsrfOrigin("https://app.example.com", ["https://app.example.com"], null)).toEqual({
      ok: true,
    });
  });

  it("rejects origin mismatch", () => {
    expect(checkCsrfOrigin("https://evil.com", [], "http://localhost:3001")).toEqual({
      ok: false,
      reason: "origin_mismatch",
    });
  });

  it("allows any origin when allowedOrigins is empty but expected matches", () => {
    expect(checkCsrfOrigin("https://app.example.com", [], "https://app.example.com")).toEqual({
      ok: true,
    });
  });
});
