const sqlite3 = require("sqlite3").verbose();
const { join } = require("node:path");
const { rmSync } = require("node:fs");

const databasePath =
  process.env.NODE_ENV === "test"
    ? ":memory:"
    : join(process.cwd(), "data", "main.db");
let database = new sqlite3.Database(databasePath);

async function recreateDatabase() {
  if (process.env.NODE_ENV === "test") return;

  await new Promise((resolve) => {
    database.close(() => {
      resolve();
    });
  });

  try {
    rmSync(databasePath, { force: true });
  } catch {}

  database = await new Promise((resolve, reject) => {
    const nextDatabase = new sqlite3.Database(databasePath, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(nextDatabase);
    });
  });
}

const run = (sql, params) => {
  return new Promise((resolve, reject) => {
    const callback = function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    };

    if (params === undefined) {
      database.run(sql, callback);
      return;
    }

    database.run(sql, params, callback);
  });
};

const get = (sql, params) => {
  return new Promise((resolve, reject) => {
    const callback = (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    };

    if (params === undefined) {
      database.get(sql, callback);
      return;
    }

    database.get(sql, params, callback);
  });
};

const all = (sql, params) => {
  return new Promise((resolve, reject) => {
    const callback = (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    };

    if (params === undefined) {
      database.all(sql, callback);
      return;
    }

    database.all(sql, params, callback);
  });
};

let transactionQueue = Promise.resolve();

const withTransaction = async (callback) => {
  transactionQueue = transactionQueue
    .then(async () => {
      await run("BEGIN TRANSACTION");

      try {
        const result = await callback();
        await run("COMMIT");
        return result;
      } catch (error) {
        await run("ROLLBACK");
        throw error;
      }
    })
    .catch(async (error) => {
      transactionQueue = Promise.resolve();
      throw error;
    });

  return transactionQueue;
};

module.exports = {
  run,
  get,
  all,
  withTransaction,
  recreateDatabase,
};
