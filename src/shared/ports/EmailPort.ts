export interface EmailAttachment {
  readonly filename: string;
  readonly content: Buffer;
  readonly contentType: string;
}

export interface SendEmailRequest {
  readonly recipients: ReadonlyArray<string>;
  readonly subject: string;
  readonly body: string;
  readonly html?: string | undefined;
  readonly attachments?: ReadonlyArray<EmailAttachment> | undefined;
}

export interface EmailPort {
  send(request: SendEmailRequest): Promise<void>;
}
