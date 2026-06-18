import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://content_user:content_password@localhost:5432/content_review',
  reservationTtlMinutes: Number(process.env.RESERVATION_TTL_MINUTES || 20)
};

export const reservationTtlMs = config.reservationTtlMinutes * 60 * 1000;

