/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("loans", "updated_at", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: Sequelize.literal("NOW()"),
    });

    await queryInterface.sequelize.query(`
      UPDATE "public"."loans"
      SET "updated_at" = COALESCE("updated_at", "created_at", NOW())
    `);

    await queryInterface.changeColumn("loans", "updated_at", {
      type: Sequelize.DATE,
      allowNull: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("loans", "updated_at");
  },
};
