import type { SessionUser } from '@annapurna/types';
declare global {
  namespace Express {
    interface Request {
      user: SessionUser;
    }
  }
}
