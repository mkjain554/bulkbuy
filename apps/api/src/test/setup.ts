process.env.NODE_ENV ??= 'test';
process.env.SESSION_SECRET ??=
  'test-session-secret-with-more-than-thirty-two-characters';
process.env.DATABASE_URL ??=
  process.env.TEST_DATABASE_URL ??
  'postgresql://bulkbuy:bulkbuy_dev@localhost:5432/bulkbuy?schema=public';
process.env.WEB_ORIGIN ??= 'http://localhost:5173';
