process.env.NODE_ENV = 'test';
process.env.DB_STORAGE = ':memory:';
process.env.JWT_SECRET = 'test-secret';
process.env.EMAIL_ENABLED = 'false';
process.env.IA_MAX_DAILY_MESSAGES = process.env.IA_MAX_DAILY_MESSAGES || '999';
process.env.IA_MAX_TURNS = process.env.IA_MAX_TURNS || '20';
process.env.IA_MAX_USER_MESSAGE_LENGTH = process.env.IA_MAX_USER_MESSAGE_LENGTH || '500';
process.env.IA_RATE_LIMIT_PER_MINUTE = process.env.IA_RATE_LIMIT_PER_MINUTE || '999';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
process.env.GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
// Every test file signs in from the same address; auth.security.test.js lowers these to test them.
process.env.AUTH_LIMIT_SIGNIN_PER_IP = process.env.AUTH_LIMIT_SIGNIN_PER_IP || '999';
process.env.AUTH_LIMIT_SIGNUP_PER_IP = process.env.AUTH_LIMIT_SIGNUP_PER_IP || '999';
process.env.AUTH_LIMIT_RESET_PER_IP = process.env.AUTH_LIMIT_RESET_PER_IP || '999';
process.env.AUTH_LIMIT_RESET_PER_EMAIL = process.env.AUTH_LIMIT_RESET_PER_EMAIL || '999';
process.env.AUTH_LIMIT_RESET_TOKEN_PER_IP = process.env.AUTH_LIMIT_RESET_TOKEN_PER_IP || '999';
