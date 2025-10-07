// backend/src/config/db.js
const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
});


async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log("? Database connected successfully");
  } catch (err) {
    console.error("? Unable to connect to database:", err.message);
  }
}

testConnection();

module.exports = sequelize;
