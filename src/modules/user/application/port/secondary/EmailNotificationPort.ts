export interface EmailNotificationPort {
  sendWelcomeEmail(email: string, userId: string, causationId: string | null): Promise<void>;
}
