import "server-only";
import nodemailer from "nodemailer";

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error("SMTP not configured (set SMTP_HOST)");
  const port = Number(process.env.SMTP_PORT ?? 587);
  const auth = process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
    : undefined;
  const transport = nodemailer.createTransport(
    port === 465
      ? { host, port: 465, secure: true, auth }
      : { host, port, secure: false, auth },
  );
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? `no-reply@${host}`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });
}