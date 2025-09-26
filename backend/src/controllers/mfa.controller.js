const authenticationService = require("src/services/authentication.service");
const mfaService = require("src/services/mfa.service");
const HttpResponse = require("src/utils/http-response-helper");
const HttpError = require("src/utils/http-error");
const cookieOptions = require("src/config/cookie-options");
const {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} = require("src/constants/cookies");

class MFAController {
  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async verifyCode(req, res) {
    const { mfa_token: mfaToken, code } = req.body || {};

    if (!mfaToken || !code) {
      throw new HttpError({
        code: 400,
        clientMessage: "Missing multi-factor authentication details",
      });
    }

    const payload = await mfaService.verifyCode(mfaToken, code);
    const user = await authenticationService.mfaVerified(payload.sub);

    if (!user) {
      throw new HttpError({ code: 404, clientMessage: "User not found" });
    }

    const tokens = await authenticationService.generateTokens(
      user.id,
      user.is_officer,
    );

    if (!tokens || tokens.length < 2) {
      throw new HttpError({
        code: 500,
        clientMessage: "Unable to generate authentication tokens",
      });
    }

    const [accessToken, refreshToken] = tokens;

    res
      .cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, cookieOptions)
      .cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, cookieOptions);

    new HttpResponse(200, { accessToken, refreshToken }).json(res);
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async resendCode(req, res) {
    const { mfa_token: mfaToken } = req.body || {};

    if (!mfaToken) {
      throw new HttpError({
        code: 400,
        clientMessage: "Missing multi-factor authentication token",
      });
    }

    const payload = await mfaService.verifyToken(mfaToken);
    new HttpResponse(200, {
      mfa_token: await mfaService.generateToken(
        payload.sub,
        payload.email,
        payload.exp,
      ),
    }).json(res);
  }
}

const mfaController = new MFAController();

module.exports = mfaController;
