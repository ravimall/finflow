"use strict";

const TASKS_TABLE = "tasks";
const TASK_STATUS_ENUM = "task_status";
const TASK_PRIORITY_ENUM = "task_priority";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
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

      await queryInterface.sequelize.query(
        `ALTER TABLE ${TASKS_TABLE}
        ALTER COLUMN status TYPE ${TASK_STATUS_ENUM}
        USING CASE
          WHEN status IN ('pending','waiting','in_progress','blocked','completed','cancelled') THEN status::${TASK_STATUS_ENUM}
          ELSE 'pending'::${TASK_STATUS_ENUM}
        END;`,
        { transaction }
      );

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

      await queryInterface.addColumn(
        TASKS_TABLE,
        "priority",
        {
          type: Sequelize.ENUM({
            name: TASK_PRIORITY_ENUM,
            values: ["low", "medium", "high", "urgent"],
          }),
          allowNull: false,
          defaultValue: "medium",
        },
        { transaction }
      );

      await queryInterface.addColumn(
        TASKS_TABLE,
        "tags",
        {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        { transaction }
      );

      await queryInterface.addColumn(
        TASKS_TABLE,
        "risk_flags",
        {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        { transaction }
      );

      await queryInterface.addIndex(
        TASKS_TABLE,
        {
          fields: ["due_on"],
          name: "idx_tasks_due_on",
        },
        { transaction }
      );

      await queryInterface.addIndex(
        TASKS_TABLE,
        {
          fields: ["status"],
          name: "idx_tasks_status",
        },
        { transaction }
      );

      await queryInterface.addIndex(
        TASKS_TABLE,
        {
          fields: ["assignee_id"],
          name: "idx_tasks_assignee_id",
        },
        { transaction }
      );

      await queryInterface.addIndex(
        TASKS_TABLE,
        {
          fields: ["tags"],
          name: "idx_tasks_tags_gin",
          using: "GIN",
        },
        { transaction }
      );

      await queryInterface.addIndex(
        TASKS_TABLE,
        {
          fields: ["risk_flags"],
          name: "idx_tasks_risk_flags_gin",
          using: "GIN",
        },
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
      await queryInterface.removeIndex(TASKS_TABLE, "idx_tasks_risk_flags_gin", { transaction });
      await queryInterface.removeIndex(TASKS_TABLE, "idx_tasks_tags_gin", { transaction });
      await queryInterface.removeIndex(TASKS_TABLE, "idx_tasks_assignee_id", { transaction });
      await queryInterface.removeIndex(TASKS_TABLE, "idx_tasks_status", { transaction });
      await queryInterface.removeIndex(TASKS_TABLE, "idx_tasks_due_on", { transaction });

      await queryInterface.removeColumn(TASKS_TABLE, "risk_flags", { transaction });
      await queryInterface.removeColumn(TASKS_TABLE, "tags", { transaction });
      await queryInterface.removeColumn(TASKS_TABLE, "priority", { transaction });

      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS ${TASK_PRIORITY_ENUM};`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_tasks_status') THEN
            CREATE TYPE enum_tasks_status AS ENUM ('pending','completed');
          END IF;
        END
        $$;`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE ${TASKS_TABLE}
        ALTER COLUMN status TYPE enum_tasks_status
        USING CASE
          WHEN status IN ('pending','completed') THEN status::text::enum_tasks_status
          ELSE 'pending'::enum_tasks_status
        END;`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS ${TASK_STATUS_ENUM};`,
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
