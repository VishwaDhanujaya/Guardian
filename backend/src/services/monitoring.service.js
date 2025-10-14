const https = require("node:https");
const { URL } = require("node:url");

class MonitoringService {
  emit(level, message, meta) {
    const webhook = process.env.MONITORING_WEBHOOK_URL;
    if (!webhook) {
      return;
    }

    let parsed;
    try {
      parsed = new URL(webhook);
    } catch (error) {
      console.error("Invalid MONITORING_WEBHOOK_URL", error);
      return;
    }

    if (parsed.protocol !== "https:") {
      console.error("Monitoring webhook must use HTTPS");
      return;
    }

    const payload = JSON.stringify({
      level,
      message,
      meta: meta ?? null,
      timestamp: new Date().toISOString(),
    });

    const request = https.request(
      parsed,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (response) => {
        response.on("data", () => {});
      },
    );

    request.on("error", (error) => {
      console.error("Monitoring webhook error", error);
    });

    request.write(payload);
    request.end();
  }
}

module.exports = new MonitoringService();
