import { User } from "../models/User.js";

export async function findOrCreateUser({ uid, username, email }) {
  const existing = await User.findOne({ uid });
  if (existing) return { user: existing, created: false };

  const user = await User.create({ uid, username, email });
  return { user, created: true };
}

export async function getUserByUid(uid) {
  return User.findOne({ uid });
}
