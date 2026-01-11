import { z } from 'zod';
import { insertVideoSchema, videos } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  videos: {
    upload: {
      method: 'POST' as const,
      path: '/api/upload',
      // input is FormData, handled separately
      responses: {
        201: z.custom<typeof videos.$inferSelect>(),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/videos',
      responses: {
        200: z.array(z.custom<typeof videos.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/videos/:id',
      responses: {
        200: z.custom<typeof videos.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/videos/:id',
      input: insertVideoSchema.partial(),
      responses: {
        200: z.custom<typeof videos.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    generateMetadata: {
      method: 'POST' as const,
      path: '/api/videos/:id/generate-metadata',
      responses: {
        200: z.custom<typeof videos.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    generateThumbnail: {
      method: 'POST' as const,
      path: '/api/videos/:id/generate-thumbnail',
      input: z.object({ prompt: z.string() }),
      responses: {
        200: z.object({ url: z.string() }),
        404: errorSchemas.notFound,
      },
    },
    publish: {
      method: 'POST' as const,
      path: '/api/videos/:id/publish',
      responses: {
        200: z.custom<typeof videos.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    status: {
       method: 'GET' as const,
       path: '/api/videos/:id/status',
       responses: {
         200: z.object({ status: z.string(), progress: z.number().optional() }),
         404: errorSchemas.notFound
       }
    }
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
