import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  schemas,
  loginSchema,
  settingsSchema,
  password,
  customerEnrollmentSchema,
  attendanceRosterQuery,
} from '@annapurna/validation';
import { HOTEL_RESOURCES, PLATFORM_RESOURCES, REPORTS } from '@annapurna/constants';
const response = {
  description: 'Standard success envelope or structured error',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: { success: { type: 'boolean' }, data: {}, error: { type: 'object' } },
      },
    },
  },
};
const responses = {
  '200': response,
  '400': response,
  '401': response,
  '403': response,
  '409': response,
};
const paths: Record<string, unknown> = {};
const components: Record<string, unknown> = {};
paths['/customers/enroll'] = {
  post: {
    tags: ['customers'],
    summary: 'Create customer, membership and invoice atomically',
    parameters: [
      {
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
        schema: { type: 'string', minLength: 16, maxLength: 128 },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: z.toJSONSchema(customerEnrollmentSchema, { unrepresentable: 'any' }),
        },
      },
    },
    responses: { ...responses, '201': response, '404': response },
  },
};
paths['/mess/attendance-roster'] = {
  get: {
    tags: ['attendance'],
    summary: 'Eligible meal roster and monthly leave day/meal totals',
    parameters: Object.entries(attendanceRosterQuery.shape).map(([name, schema]) => ({
      name,
      in: 'query',
      required: ['date', 'meal'].includes(name),
      schema: z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' }),
    })),
    responses,
  },
};
for (const name of [...HOTEL_RESOURCES, ...PLATFORM_RESOURCES]) {
  const schema = schemas[name as keyof typeof schemas];
  if (schema) components[name] = z.toJSONSchema(schema, { unrepresentable: 'any' });
  paths[`/${name}`] = {
    get: {
      tags: [name],
      summary: `List ${name}`,
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100 } },
        { name: 'q', in: 'query', schema: { type: 'string' } },
      ],
      responses,
    },
    ...(schema
      ? {
          post: {
            tags: [name],
            summary: `Create ${name}`,
            parameters: [
              {
                name: 'Idempotency-Key',
                in: 'header',
                schema: { type: 'string', minLength: 16, maxLength: 128 },
              },
            ],
            requestBody: {
              required: true,
              content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } },
            },
            responses: { ...responses, '201': response },
          },
        }
      : {}),
  };
  paths[`/${name}/{id}`] = {
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', pattern: '^[a-f0-9]{24}$' },
      },
    ],
    get: { tags: [name], responses },
    put: {
      tags: [name],
      description:
        'Available only for mutable master records, attendance corrections, and leave cancellation. Immutable financial resources return 405.',
      responses,
    },
  };
}
paths['/auth/login'] = {
  post: {
    security: [],
    requestBody: { content: { 'application/json': { schema: z.toJSONSchema(loginSchema) } } },
    responses,
  },
};
for (const name of [
  'refresh',
  'logout',
  'forgot-password',
  'reset-password',
  'change-password',
  'revoke-sessions',
])
  paths[`/auth/${name}`] = { post: { tags: ['Authentication'], responses } };
paths['/auth/me'] = { get: { responses } };
for (const [name, schema] of Object.entries({
  'forgot-password': z.object({ email: z.string().email() }),
  'reset-password': z.object({ token: z.string(), password }),
  'change-password': z.object({ currentPassword: z.string(), password }),
}))
  paths[`/auth/${name}`] = {
    post: {
      ...(name === 'change-password' ? {} : { security: [] }),
      tags: ['Authentication'],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: z.toJSONSchema(schema) } },
      },
      responses,
    },
  };
for (const name of ['refresh', 'logout'])
  paths[`/auth/${name}`] = {
    post: { security: [{ refreshCookie: [] }], tags: ['Authentication'], responses },
  };
paths['/subscription-status'] = { get: { responses } };
paths['/audit'] = { get: { responses } };
paths['/dashboard'] = { get: { responses } };
paths['/settings'] = {
  get: { responses },
  put: {
    requestBody: {
      content: {
        'application/json': { schema: z.toJSONSchema(settingsSchema, { unrepresentable: 'any' }) },
      },
    },
    responses,
  },
};
for (const name of REPORTS) {
  paths[`/reports/${name}`] = {
    get: {
      tags: ['Reports'],
      parameters: [
        { name: 'preset', in: 'query', schema: { type: 'string' } },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
      ],
      responses,
    },
  };
  paths[`/reports/${name}/export/{format}`] = {
    get: {
      tags: ['Reports'],
      parameters: [
        {
          name: 'format',
          in: 'path',
          required: true,
          schema: { type: 'string', enum: ['csv', 'xlsx', 'pdf'] },
        },
      ],
      responses: { '200': { description: 'Streamed filtered download' } },
    },
  };
}
await writeFile(
  'docs/api/openapi.json',
  JSON.stringify(
    {
      openapi: '3.1.0',
      info: {
        title: 'Annapurna API',
        version: '0.1.0',
        description:
          'Origin header required on writes. Bearer access token plus HTTP-only rotating refresh cookie. See REST guide for immutability and role constraints.',
      },
      servers: [{ url: '/api/v1' }],
      security: [{ bearerAuth: [] }],
      paths,
      components: {
        schemas: components,
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          refreshCookie: { type: 'apiKey', in: 'cookie', name: 'annapurna_refresh' },
        },
      },
    },
    null,
    2,
  ) + '\n',
);
