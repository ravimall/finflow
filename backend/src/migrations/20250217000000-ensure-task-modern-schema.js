"use strict";

const TASKS_TABLE = "tasks";
const TASK_STATUS_ENUM = "task_status";
const LEGACY_STATUS_ENUM = "enum_tasks_status";
const TASK_PRIORITY_ENUM = "task_priority";

async function columnExists(queryInterface, columnName) {
  const table = await queryInterface.describeTable(TASKS_TABLE);
  return Object.prototype.hasOwnProperty.call(table, columnName);
}

async function getColumnType(queryInterface, columnName, transaction) {
  const [results] = await queryInterface.sequelize.query(
    `SELECT t.typname AS enum_name
     FROM pg_attribute a
     JOIN pg_class c ON a.attrelid = c.oid
     JOIN pg_type t ON a.atttypid = t.oid
     WHERE c.relname = :tableName
       AND a.attname = :columnName;`,
    {
      replacements: {
        tableName: TASKS_TABLE,
        columnName,
      },
      transaction,
    }
  );

  return results.length ? results[0].enum_name : null;
}

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Ensure modern status enum exists and is applied.
      await queryInterface.sequelize.query(
        `DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${TASK_STATUS_ENUM}') THEN
            CREATE TYPE ${TASK_STATUS_ENUM} AS ENUM ('pending','waiting','in_progress','blocked','completed','cancelled');
          END IF;
        END
        $$;`,
        { transaction }
      );

      const currentStatusType = await getColumnType(queryInterface, "status", transaction);
      if (currentStatusType !== TASK_STATUS_ENUM) {
        await queryInterface.sequelize.query(
          `ALTER TABLE ${TASKS_TABLE}
           ALTER COLUMN status DROP DEFAULT;`,
          { transaction }
        );

        await queryInterface.sequelize.query(
          `ALTER TABLE ${TASKS_TABLE}
           ALTER COLUMN status TYPE ${TASK_STATUS_ENUM}
           USING CASE
             WHEN status::text IN ('pending','waiting','in_progress','blocked','completed','cancelled') THEN status::text::${TASK_STATUS_ENUM}
             ELSE 'pending'::${TASK_STATUS_ENUM}
           END;`,
          { transaction }
        );

        await queryInterface.sequelize.query(
          `ALTER TABLE ${TASKS_TABLE}
           ALTER COLUMN status SET DEFAULT 'pending'::${TASK_STATUS_ENUM};`,
          { transaction }
        );

        // Drop legacy enum if unused.
        await queryInterface.sequelize.query(
          `DO $$
          BEGIN
            IF EXISTS (
              SELECT 1
              FROM pg_type t
              WHERE t.typname = '${LEGACY_STATUS_ENUM}'
                AND NOT EXISTS (
                  SELECT 1
                  FROM pg_attribute a
                  WHERE a.atttypid = t.oid
                )
            ) THEN
              DROP TYPE ${LEGACY_STATUS_ENUM};
            END IF;
          END
          $$;`,
          { transaction }
        );
      }

      // Ensure priority enum exists.
      await queryInterface.sequelize.query(
        `DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${TASK_PRIORITY_ENUM}') THEN
            CREATE TYPE ${TASK_PRIORITY_ENUM} AS ENUM ('low','medium','high','urgent');
          END IF;
        END
        $$;`,
        { transaction }
      );

      const hasPriorityColumn = await columnExists(queryInterface, "priority");
      if (!hasPriorityColumn) {
        await queryInterface.sequelize.query(
          `ALTER TABLE ${TASKS_TABLE}
           ADD COLUMN priority ${TASK_PRIORITY_ENUM} NOT NULL DEFAULT 'medium';`,
          { transaction }
        );
      } else {
        const priorityType = await getColumnType(queryInterface, "priority", transaction);
        if (priorityType !== TASK_PRIORITY_ENUM) {
          await queryInterface.sequelize.query(
            `ALTER TABLE ${TASKS_TABLE}
             ALTER COLUMN priority TYPE ${TASK_PRIORITY_ENUM}
             USING CASE
               WHEN priority::text IN ('low','medium','high','urgent') THEN priority::text::${TASK_PRIORITY_ENUM}
               ELSE 'medium'::${TASK_PRIORITY_ENUM}
             END;
             ALTER TABLE ${TASKS_TABLE}
             ALTER COLUMN priority SET DEFAULT 'medium'::${TASK_PRIORITY_ENUM};
             ALTER TABLE ${TASKS_TABLE}
             ALTER COLUMN priority SET NOT NULL;`,
            { transaction }
          );
        }
      }

      const hasTagsColumn = await columnExists(queryInterface, "tags");
      if (!hasTagsColumn) {
        await queryInterface.sequelize.query(
          `ALTER TABLE ${TASKS_TABLE}
           ADD COLUMN tags JSONB NOT NULL DEFAULT '[]'::jsonb;`,
          { transaction }
        );
      }

      const hasRiskFlagsColumn = await columnExists(queryInterface, "risk_flags");
      if (!hasRiskFlagsColumn) {
        await queryInterface.sequelize.query(
          `ALTER TABLE ${TASKS_TABLE}
           ADD COLUMN risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb;`,
          { transaction }
        );
      }

      // Helpful indexes (idempotent)
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_tasks_due_on ON ${TASKS_TABLE} (due_on);`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_tasks_status ON ${TASKS_TABLE} (status);`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON ${TASKS_TABLE} (assignee_id);`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_tasks_tags_gin ON ${TASKS_TABLE} USING GIN (tags);`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_tasks_risk_flags_gin ON ${TASKS_TABLE} USING GIN (risk_flags);`,
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS idx_tasks_risk_flags_gin;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS idx_tasks_tags_gin;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS idx_tasks_assignee_id;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS idx_tasks_status;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS idx_tasks_due_on;`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE ${TASKS_TABLE} DROP COLUMN IF EXISTS risk_flags;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE ${TASKS_TABLE} DROP COLUMN IF EXISTS tags;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE ${TASKS_TABLE} DROP COLUMN IF EXISTS priority;`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS ${TASK_PRIORITY_ENUM};`,
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
