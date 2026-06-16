/**
 * Login input. Email is normalised (trim + lowercase) but NOT validated as a VO — a
 * malformed email must yield the same indistinguishable "invalid credentials" outcome as
 * a wrong password, never a different validation error (ADR-010).
 */
export class AuthenticateCommand {
  public readonly email: string;
  public readonly password: string;

  private constructor(email: string, password: string) {
    this.email = email;
    this.password = password;
  }

  public static of(email: string, password: string): AuthenticateCommand {
    return new AuthenticateCommand(email.trim().toLowerCase(), password);
  }
}
