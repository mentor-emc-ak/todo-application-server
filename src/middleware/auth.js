import { admin } from "../config/firebase.js";

/**
 * Verifies the Firebase ID token supplied in the Authorization header.
 * Attaches the decoded token to req.user on success.
 *
 * Expected header format:
 *   Authorization: Bearer <firebase-id-token>
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or malformed Authorization header." });
  }

  const idToken = authHeader.split(" ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}
