import { z } from "zod";
export function loadConfig(env = process.env) {
  const config = z
    .object({
      NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
      PORT: z.coerce.number().int().min(1).max(65535).default(4000),
      CLIENT_ORIGIN: z.url().default("http://localhost:3000"),
      MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//),
      JWT_SECRET: z
        .string()
        .min(32)
        .refine(
          (v) => !v.includes("change-me") && !v.includes("<"),
          "Use a random secret",
        ),
      ADMIN_SETUP_TOKEN: z.string().min(32).optional(),
      GOOGLE_CLIENT_ID: z.string().min(10).optional(),
      EMAIL_MODE: z.enum(["safe", "smtp"]).default("safe"),
      SMTP_HOST: z.string().optional(),
      SMTP_PORT: z.coerce.number().default(587),
      SMTP_USER: z.string().optional(),
      SMTP_PASSWORD: z.string().optional(),
      SMTP_FROM: z.email().optional(),
      EMAIL_DELIVERY_APPROVED: z.enum(["yes", "no"]).default("no"),
      CUSTOMER_EMAIL_VERIFICATION_REQUIRED: z.enum(["yes", "no"]).default("no"),
    })
    .parse(env);
  if (
    config.EMAIL_MODE === "smtp" &&
    (!config.SMTP_HOST ||
      !config.SMTP_USER ||
      !config.SMTP_PASSWORD ||
      !config.SMTP_FROM ||
      config.EMAIL_DELIVERY_APPROVED !== "yes")
  )
    throw new Error(
      "SMTP requires complete configuration and explicit delivery approval.",
    );
  return config;
}
export const TIME_ZONE = "Africa/Maseru";
