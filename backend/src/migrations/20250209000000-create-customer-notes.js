/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map((table) => {
      if (typeof table === "string") return table;
      if (table && typeof table === "object" && "tableName" in table) {
        return table.tableName;
      }
      return String(table);
    });

    if (!normalized.includes("customer_notes")) {
      await queryInterface.createTable("customer_notes", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        customer_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "customers",
            key: "id",
          },
          onDelete: "CASCADE",
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
          onDelete: "SET NULL",
        },
        note: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
      });
    } else {
      const columns = await queryInterface.describeTable("customer_notes").catch(() => ({}));

      if (!columns.note) {
        await queryInterface.addColumn("customer_notes", "note", {
          type: Sequelize.TEXT,
          allowNull: false,
        });
      }
      if (!columns.customer_id) {
        await queryInterface.addColumn("customer_notes", "customer_id", {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "customers",
            key: "id",
          },
          onDelete: "CASCADE",
        });
      }
      if (!columns.user_id) {
        await queryInterface.addColumn("customer_notes", "user_id", {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
          onDelete: "SET NULL",
        });
      }
      if (!columns.created_at) {
        await queryInterface.addColumn("customer_notes", "created_at", {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        });
      }
      if (!columns.updated_at) {
        await queryInterface.addColumn("customer_notes", "updated_at", {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        });
      }
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map((table) => {
      if (typeof table === "string") return table;
      if (table && typeof table === "object" && "tableName" in table) {
        return table.tableName;
      }
      return String(table);
    });

    if (normalized.includes("customer_notes")) {
      await queryInterface.dropTable("customer_notes");
    }
  },
};

