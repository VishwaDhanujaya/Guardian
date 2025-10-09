const {
  MFA_ACCESS_TOKEN_WINDOW_SECONDS,
  MFA_RESEND_ALLOW_AFTER_MS,
} = require("src/constants/mfa");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const { randomInt } = require("node:crypto");
const argon2 = require("argon2");
const HttpError = require("src/utils/http-error");
const mailTransporter = require("src/config/nodemailer.config");
const defaultLogger = require("src/config/logging");
const lastSent = {};

class MFAService {
  /**
   * @param {UserModel} user
   */
  doesLoginRequireMfa(user) {
    if (!user) {
      return false;
    }

    const hasDeliverableEmail = Boolean(user.email && user.email.trim() !== "");
    if (!hasDeliverableEmail) {
      return false;
    }

    const roleFlag = Number(user.is_officer);
    const isCitizen = roleFlag === 0;
    const isOfficer = roleFlag === 1;

    if (!isCitizen && !isOfficer) {
      return false;
    }

    return true;
  }

  /**
   * @returns {string}
   */
  generateCode() {
    return randomInt(100000, 999999 + 1).toString();
  }

  /**
   * @param {number} userId
   * @param {string} email
   * @param {number|null} [existingExp=null]
   * @returns {string}
   */
  async generateToken(userId, email, existingExp = null) {
    if (!userId || !email || email === "") return null;
    const now = Date.now();

    if (
      lastSent[userId] &&
      now < lastSent[userId] + MFA_RESEND_ALLOW_AFTER_MS
    ) {
      throw new HttpError({
        code: 400,
        clientMessage: "Requesting codes too quickly",
      });
    }

    const exp =
      existingExp ||
      Math.floor(Date.now() / 1000) + MFA_ACCESS_TOKEN_WINDOW_SECONDS;
    const sessionId = uuidv4();
    const code = this.generateCode();
    const hashedCode = await argon2.hash(code);

    const token = jwt.sign(
      { sub: userId, jti: sessionId, exp, code: hashedCode, email },
      process.env.JWT_MFA_SECRET,
    );

    const smtpConfigEntries = [
      ["SMTP_HOST", process.env.SMTP_HOST],
      ["SMTP_PORT", process.env.SMTP_PORT],
      ["SMTP_USER", process.env.SMTP_USER],
      ["SMTP_PASS", process.env.SMTP_PASS],
    ];

    const missingSmtpVars = smtpConfigEntries
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingSmtpVars.length > 0) {
      const clientMessage =
        "MFA email transport is not configured—please set SMTP_* env vars";

      defaultLogger?.warn?.(
        `${clientMessage}. Missing: ${missingSmtpVars.join(", ")}`,
      );

      throw new HttpError({ code: 500, clientMessage });
    }

    const textBody = `Your Guardian MFA code is ${code}. It expires in 10 minutes.`;
    const htmlBody = `
      <div style="font-family: 'Segoe UI', sans-serif; background:#f5f7fb; padding:24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden;">
          <tr>
            <td style="background:#243b53; color:#ffffff; padding:24px; text-align:center;">
              <h1 style="margin:0; font-size:20px;">Guardian MFA code</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px; color:#334e68;">
              <p style="margin:0 0 16px;">Use this one-time code to finish signing in. It expires in 10 minutes.</p>
              <div style="font-size:32px; font-weight:700; letter-spacing:8px; color:#243b53; text-align:center;">${code}</div>
              <p style="margin:24px 0 0; font-size:12px; color:#829ab1;">If you didn’t request this code, you can ignore this email.</p>
            </td>
          </tr>
        </table>
      </div>
    `;

    await mailTransporter.sendMail({
      to: email,
      subject: "Guardian MFA code",
      text: textBody,
      html: htmlBody,
    });

    lastSent[userId] = now;

    return token;
  }

  /**
   * @param {sring} token
   * @returns {jwt.JwtPayload}
   */
  verifyToken(token) {
    return jwt.verify(token, process.env.JWT_MFA_SECRET);
  }

  /**
   * @param {string} token
   * @param {string} code
   */
  async verifyCode(token, code) {
    const payload = this.verifyToken(token);
    const codeValid = await argon2.verify(payload.code, code);

    if (!codeValid) {
      throw new HttpError({ code: 400, clientMessage: "Invalid 2FA Code" });
    }

    return payload;
  }
}

const mfaService = new MFAService();

module.exports = mfaService;
