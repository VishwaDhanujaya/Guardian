const BaseModel = require("./base.model");

class AuditLogModel extends BaseModel {
  static table = "audit_logs";
  static schema = `
    CREATE TABLE IF NOT EXISTS ${this.table}
    (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER, target_type TEXT, target_id TEXT, action TEXT, metadata TEXT, created_at DATETIME DEFAULT current_timestamp)
  `;
  static encryptedFields = ["metadata"];

  actor_id;
  target_type;
  target_id;
  action;
  metadata;
  created_at = null;

  constructor(actorId, targetType, targetId, action, metadata = null) {
    super();
    this.actor_id = actorId;
    this.target_type = targetType;
    this.target_id = targetId;
    this.action = action;
    this.metadata = metadata;
  }
}

AuditLogModel.initialize();

module.exports = AuditLogModel;
