export class TlsConfig {
  public readonly certPath: string;
  public readonly keyPath: string;

  private constructor(certPath: string, keyPath: string) {
    this.certPath = certPath;
    this.keyPath = keyPath;
  }

  public static fromEnv(): TlsConfig | null {
    const certPath = process.env["TLS_CERT_PATH"];
    const keyPath = process.env["TLS_KEY_PATH"];

    if (certPath === undefined || certPath.length === 0) {
      return null;
    }

    if (keyPath === undefined || keyPath.length === 0) {
      return null;
    }

    return new TlsConfig(certPath, keyPath);
  }

  public static create(certPath: string, keyPath: string): TlsConfig {
    if (certPath.length === 0) {
      throw new Error("TLS certificate path cannot be empty");
    }

    if (keyPath.length === 0) {
      throw new Error("TLS key path cannot be empty");
    }

    return new TlsConfig(certPath, keyPath);
  }

  public get isEnabled(): boolean {
    return true;
  }
}
