import * as userService from "../services/user.service.js";

/**
 * POST /api/users/me
 * Called right after Firebase sign-up to persist the user in MongoDB.
 * The Firebase ID token supplies uid + email; the body carries username.
 */
export async function upsertMe(req, res) {
  const { uid, email } = req.user;
  const { username } = req.body;

  if (!username || typeof username !== "string" || !username.trim()) {
    return res.status(400).json({ message: "username is required." });
  }

  try {
    const { user, created } = await userService.findOrCreateUser({
      uid,
      username: username.trim(),
      email,
    });

    res.status(created ? 201 : 200).json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to save user.", error: err.message });
  }
}

/**
 * GET /api/users/me
 * Returns the current user's DB record.
 */
export async function getMe(req, res) {
  try {
    const user = await userService.getUserByUid(req.user.uid);
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user.", error: err.message });
  }
}
