/* One PrismaClient for the process. Next.js hot-reloads modules in dev, and a
   fresh client per reload exhausts the connection pool within minutes. */
import { PrismaClient } from '@prisma/client';

const g = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  g.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

if (process.env.NODE_ENV !== 'production') g.prisma = db;
