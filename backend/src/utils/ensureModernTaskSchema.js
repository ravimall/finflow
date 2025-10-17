"use strict";

const sequelize = require("../config/db");

const TASKS_TABLE = "tasks";
const TASK_PRIORITY_ENUM = "task_priority";

let ensurePromise = null;

async function describeTasksTable() {
  const queryInterface = sequelize.getQueryInterface();
  try {
    return await queryInterface.describeTable(TASKS_TABLE);
  } catch (error) {
    throw new Error(`Failed to inspect ${TASKS_TABLE} table: ${error.message}`);
  }
}

async function ensureModernTaskSchema() {
  if (ensurePromise) {
    return ensurePromise;
  }

  ensurePromise = (async () => {
    const definition = await describeTasksTable();

    const result = {
      hasPriority: Object.prototype.hasOwnProperty.call(definition, "priority"),
      hasTags: Object.prototype.hasOwnProperty.call(definition, "tags"),
      hasRiskFlags: Object.prototype.hasOwnProperty.call(definition, "risk_flags"),
    };

    const needsPriority = !result.hasPriority;
    const needsTags = !result.hasTags;
    const needsRiskFlags = !result.hasRiskFlags;

    if (!needsPriority && !needsTags && !needsRiskFlags) {
      return result;
    }

    const transaction = await sequelize.transaction();
    try {
      if (needsPriority) {
        await sequelize.query(
          `DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${TASK_PRIORITY_ENUM}') THEN
              CREATE TYPE ${TASK_PRIORITY_ENUM} AS ENUM ('low','medium','high','urgent');
            END IF;
          END
          $$;`,
          { transaction }
        );

        await sequelize.query(
          `ALTER TABLE ${TASKS_TABLE}
           ADD COLUMN IF NOT EXISTS priority ${TASK_PRIORITY_ENUM} NOT NULL DEFAULT 'medium';`,
          { transaction }
        );
      }

      if (needsTags) {
        await sequelize.query(
          `ALTER TABLE ${TASKS_TABLE}
           ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;`,
          { transaction }
        );
      }

      if (needsRiskFlags) {
        await sequelize.query(
          `ALTER TABLE ${TASKS_TABLE}
           ADD COLUMN IF NOT EXISTS risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb;`,
          { transaction }
        );
      }

      // Helpful indexes (idempotent safeguards)
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_tasks_due_on ON ${TASKS_TABLE} (due_on);`,
        { transaction }
      );
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_tasks_status ON ${TASKS_TABLE} (status);`,
        { transaction }
      );
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON ${TASKS_TABLE} (assignee_id);`,
        { transaction }
      );
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_tasks_tags_gin ON ${TASKS_TABLE} USING GIN (tags);`,
        { transaction }
      );
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_tasks_risk_flags_gin ON ${TASKS_TABLE} USING GIN (risk_flags);`,
        { transaction }
      );

      await transaction.commit();

      return {
        hasPriority: true,
        hasTags: true,
        hasRiskFlags: true,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  })()
    .catch((error) => {
      ensurePromise = null;
      throw error;
    });

  return ensurePromise;
}

module.exports = ensureModernTaskSchema;
