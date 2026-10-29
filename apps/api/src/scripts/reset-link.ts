import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { connectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { User, AuditLog } from '../core/database/models.js';
import { hash } from '../modules/auth/service.js';
const email = z.string().email().parse(process.argv[2]);
await connectDatabase();
const user = await User.findOne({ email });
if (!user) throw new Error('Account not found');
const token = randomBytes(32).toString('base64url');
await User.updateOne(
  { _id: user._id },
  { $set: { resetHash: hash(token), resetExpires: new Date(Date.now() + 1800000) } },
);
await AuditLog.create({
  userId: user._id,
  action: 'password.reset.link.issued',
  details: { channel: 'administrator-cli' },
});
console.log(`${env.WEB_ORIGIN}/login?token=${token}`);
await mongoose.disconnect();
