import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { isCurrentRole } from "./tenancy.js";
import { User, Session } from "./models.js";
export const hashToken = (value) =>
  createHash("sha256").update(value).digest("hex");
export const issueToken = (user, secret, sid) =>
  jwt.sign(
    {
      sub: String(user._id),
      version: user.tokenVersion || 0,
      ...(sid ? { sid: String(sid) } : {}),
    },
    secret,
    {
      expiresIn: "15m",
      issuer: "salon-api",
      audience: "salon-client",
      algorithm: "HS256",
    },
  );
export function authenticate(secret) {
  return async (req, res, next) => {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer "))
      return res.status(401).json({ message: "Authentication required." });
    let payload;
    try {
      payload = jwt.verify(header.slice(7), secret, {
        algorithms: ["HS256"],
        issuer: "salon-api",
        audience: "salon-client",
      });
    } catch {
      return res.status(401).json({ message: "Session invalid or expired." });
    }
    try {
      if (!/^[a-f\d]{24}$/i.test(payload.sub) || !payload.sid)
        return res.status(401).json({ message: "Session unavailable." });
      const user = await User.findById(payload.sub);
      const session = await Session.findOne({
        _id: payload.sid,
        user: payload.sub,
        expiresAt: { $gt: new Date() },
      });
      if (
        !user?.active ||
        !session ||
        user.tokenVersion !== payload.version ||
        session.userVersion !== user.tokenVersion
      )
        return res.status(401).json({ message: "Session unavailable." });
      if (!isCurrentRole(user.role))
        return res.status(403).json({
          message: "Account role requires an explicit migration mapping.",
        });
      req.user = user;
      if (user.emailVerified === false)
        return res.status(403).json({ message: "Verify your email address before using protected account features." });
      req.sessionId = session._id;
      next();
    } catch (error) {
      next(error);
    }
  };
}
export const allowRoles =
  (...roles) =>
  (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ message: "Authentication required." });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ message: "Access denied." });
    next();
  };
export const publicUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  phone: user.phone,
  whatsappNumber: user.whatsappNumber || "",
  emailVerified: user.emailVerified === true,
  role: user.role,
});
const cookieOptions = (config) =>
  `Path=/api/auth; HttpOnly; SameSite=Strict${config.NODE_ENV === "production" ? "; Secure" : ""}`;
export function refreshCookie(req) {
  const value = (req.headers.cookie || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("salon_refresh="));
  return value?.slice("salon_refresh=".length) || "";
}
export async function startSession(user, res, config) {
  if (user.emailVerified === false)
    throw Object.assign(new Error("Verify your email address before signing in."), { status: 403 });
  if (!isCurrentRole(user.role))
    throw Object.assign(
      new Error("Account role requires an explicit migration mapping."),
      { status: 403 },
    );
  const token = randomBytes(48).toString("hex");
  const session = await Session.create({
    user: user._id,
    userVersion: user.tokenVersion || 0,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  res.setHeader(
    "Set-Cookie",
    `salon_refresh=${token}; ${cookieOptions(config)}; Max-Age=604800`,
  );
  return {
    user: publicUser(user),
    token: issueToken(user, config.JWT_SECRET, session._id),
  };
}
export function clearCookie(res, config) {
  res.setHeader(
    "Set-Cookie",
    `salon_refresh=; ${cookieOptions(config)}; Max-Age=0`,
  );
}
export function requireOrigin(config) {
  return (req, res, next) => {
    if (req.headers.origin !== config.CLIENT_ORIGIN)
      return res.status(403).json({ message: "Invalid request origin." });
    next();
  };
}
export async function rotateSession(req, res, config) {
  const token = refreshCookie(req);
  if (!token) return res.status(401).json({ message: "Session expired." });
  const nextToken = randomBytes(48).toString("hex");
  const session = await Session.findOneAndUpdate(
    { tokenHash: hashToken(token), expiresAt: { $gt: new Date() } },
    { $set: { tokenHash: hashToken(nextToken) } },
    { new: true },
  );
  if (!session) return res.status(401).json({ message: "Session expired." });
  const user = await User.findById(session.user);
  if (!user?.active || session.userVersion !== user.tokenVersion) {
    await session.deleteOne();
    clearCookie(res, config);
    return res.status(401).json({ message: "Session unavailable." });
  }
  if (user.emailVerified === false) {
    await session.deleteOne();
    clearCookie(res, config);
    return res.status(403).json({ message: "Verify your email address before using protected account features." });
  }
  if (!isCurrentRole(user.role)) {
    clearCookie(res, config);
    return res.status(403).json({
      message: "Account role requires an explicit migration mapping.",
    });
  }
  const seconds = Math.max(
    0,
    Math.floor((session.expiresAt - Date.now()) / 1000),
  );
  res.setHeader(
    "Set-Cookie",
    `salon_refresh=${nextToken}; ${cookieOptions(config)}; Max-Age=${seconds}`,
  );
  res.json({
    user: publicUser(user),
    token: issueToken(user, config.JWT_SECRET, session._id),
  });
}
