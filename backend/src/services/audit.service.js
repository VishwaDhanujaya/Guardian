const AuditLogModel = require("../models/audit-log.model");
const logger = require("../utils/logger");

class AuditService {
  async record({ actorId = null, targetType, targetId = null, action, metadata = null }) {
    const log = new AuditLogModel(actorId, targetType, targetId, action, metadata ? JSON.stringify(metadata) : null);
    await log.save();
    logger.info("audit_event", {
      actorId,
      targetType,
      targetId,
      action,
    });
    return log;
  }

  async recordFileEvent({ actorId = null, action, filePath, metadata = {} }) {
    return await this.record({
      actorId,
      targetType: "file",
      targetId: filePath,
      action,
      metadata,
    });
  }

  async recordIncidentEvent({ actorId = null, incidentId, action, metadata = {} }) {
    return await this.record({
      actorId,
      targetType: "incident",
      targetId: String(incidentId),
      action,
      metadata,
    });
  }
}

module.exports = new AuditService();
