import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { TlsConfig } from "./TlsConfig.ts";

describe("TlsConfig", () => {
  describe("fromEnv", () => {
    let originalCertPath: string | undefined;
    let originalKeyPath: string | undefined;

    beforeEach(() => {
      originalCertPath = process.env["TLS_CERT_PATH"];
      originalKeyPath = process.env["TLS_KEY_PATH"];
    });

    afterEach(() => {
      if (originalCertPath === undefined) {
        delete process.env["TLS_CERT_PATH"];
      } else {
        process.env["TLS_CERT_PATH"] = originalCertPath;
      }

      if (originalKeyPath === undefined) {
        delete process.env["TLS_KEY_PATH"];
      } else {
        process.env["TLS_KEY_PATH"] = originalKeyPath;
      }
    });

    it("should return null when TLS_CERT_PATH is not set", () => {
      delete process.env["TLS_CERT_PATH"];
      process.env["TLS_KEY_PATH"] = "/path/to/key.pem";

      const config = TlsConfig.fromEnv();

      assert.equal(config, null);
    });

    it("should return null when TLS_KEY_PATH is not set", () => {
      process.env["TLS_CERT_PATH"] = "/path/to/cert.pem";
      delete process.env["TLS_KEY_PATH"];

      const config = TlsConfig.fromEnv();

      assert.equal(config, null);
    });

    it("should return null when TLS_CERT_PATH is empty", () => {
      process.env["TLS_CERT_PATH"] = "";
      process.env["TLS_KEY_PATH"] = "/path/to/key.pem";

      const config = TlsConfig.fromEnv();

      assert.equal(config, null);
    });

    it("should return null when TLS_KEY_PATH is empty", () => {
      process.env["TLS_CERT_PATH"] = "/path/to/cert.pem";
      process.env["TLS_KEY_PATH"] = "";

      const config = TlsConfig.fromEnv();

      assert.equal(config, null);
    });

    it("should return TlsConfig when both env vars are set", () => {
      process.env["TLS_CERT_PATH"] = "/path/to/cert.pem";
      process.env["TLS_KEY_PATH"] = "/path/to/key.pem";

      const config = TlsConfig.fromEnv();

      assert.notEqual(config, null);
      assert.equal(config!.certPath, "/path/to/cert.pem");
      assert.equal(config!.keyPath, "/path/to/key.pem");
    });

    it("should return null when neither env var is set", () => {
      delete process.env["TLS_CERT_PATH"];
      delete process.env["TLS_KEY_PATH"];

      const config = TlsConfig.fromEnv();

      assert.equal(config, null);
    });
  });

  describe("create", () => {
    it("should create a TlsConfig with valid paths", () => {
      const config = TlsConfig.create("/cert.pem", "/key.pem");

      assert.equal(config.certPath, "/cert.pem");
      assert.equal(config.keyPath, "/key.pem");
    });

    it("should throw when certPath is empty", () => {
      assert.throws(() => TlsConfig.create("", "/key.pem"), {
        message: "TLS certificate path cannot be empty",
      });
    });

    it("should throw when keyPath is empty", () => {
      assert.throws(() => TlsConfig.create("/cert.pem", ""), {
        message: "TLS key path cannot be empty",
      });
    });
  });

  describe("isEnabled", () => {
    it("should return true for any TlsConfig instance", () => {
      const config = TlsConfig.create("/cert.pem", "/key.pem");

      assert.equal(config.isEnabled, true);
    });
  });
});
