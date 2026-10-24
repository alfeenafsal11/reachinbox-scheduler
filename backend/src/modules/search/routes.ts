import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import { esClient, EMAILS_INDEX } from './esClient';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { EmailStatus } from '@prisma/client';

const router = Router();

router.get('/search', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const q = (req.query.q as string)?.trim() || '';
    const status = req.query.status as EmailStatus | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const from = (page - 1) * pageSize;

    // 1. Attempt Elasticsearch Search
    try {
      const mustClauses: Record<string, unknown>[] = [];
      const filterClauses: Record<string, unknown>[] = [{ term: { userId } }];

      if (q) {
        mustClauses.push({
          multi_match: {
            query: q,
            fields: ['toEmail^3', 'toEmail.keyword^3', 'subject^2', 'body'],
            fuzziness: 'AUTO',
          },
        });
      } else {
        mustClauses.push({ match_all: {} });
      }

      if (status) {
        filterClauses.push({ term: { status } });
      }

      const esResult = await esClient.search({
        index: EMAILS_INDEX,
        from,
        size: pageSize,
        query: {
          bool: {
            must: mustClauses,
            filter: filterClauses,
          },
        },
        sort: [{ scheduledAt: { order: 'desc' } }],
      });

      const hits = esResult.hits.hits;
      const total =
        typeof esResult.hits.total === 'number'
          ? esResult.hits.total
          : esResult.hits.total?.value || 0;

      const items = hits.map((hit) => {
        const source = hit._source as Record<string, unknown>;
        return {
          id: hit._id,
          ...source,
        };
      });

      res.json({
        items,
        total,
        page,
        pageSize,
        source: 'elasticsearch',
      });
      return;
    } catch (esErr) {
      logger.warn({ esErr }, 'Elasticsearch search failed; falling back gracefully to database search');
    }

    // 2. Graceful Fallback: Database Search via Prisma
    const whereClause: {
      userId: string;
      status?: EmailStatus;
      OR?: Array<{
        toEmail?: { contains: string; mode: 'insensitive' };
        subject?: { contains: string; mode: 'insensitive' };
        body?: { contains: string; mode: 'insensitive' };
      }>;
    } = { userId };

    if (status && Object.values(EmailStatus).includes(status)) {
      whereClause.status = status;
    }

    if (q) {
      whereClause.OR = [
        { toEmail: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.email.findMany({
        where: whereClause,
        include: {
          sender: { select: { email: true } },
          campaign: { select: { id: true, subject: true } },
        },
        orderBy: { scheduledAt: 'desc' },
        skip: from,
        take: pageSize,
      }),
      prisma.email.count({ where: whereClause }),
    ]);

    res.json({
      items,
      total,
      page,
      pageSize,
      source: 'database',
    });
  } catch (err) {
    next(err);
  }
});

export const searchRouter = router;
