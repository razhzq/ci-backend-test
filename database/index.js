require("dotenv").config();
const Sequelize = require('sequelize');
const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: 'postgres', // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  })

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = require("./user.model")(sequelize, Sequelize);
db.userWallet = require("./userWallet.model")(sequelize, Sequelize);
db.userData = require("./userData.model")(sequelize, Sequelize);
db.gnsMarketOrder = require("./gnsMarketOrder.model")(sequelize, Sequelize);
db.gnsLimitOrder = require("./gnsLimitOrder.model")(sequelize, Sequelize);
db.gmxMarketOrder = require("./gmxMarketOrder.model")(sequelize, Sequelize);
db.gmxLimitOrder = require("./gmxLimitOrder.model")(sequelize, Sequelize);
db.gnsPair = require("./gnsPair.model")(sequelize, Sequelize)
db.betaCode = require("./betaCode.model")(sequelize, Sequelize);
db.multiplier = require("./multiplier.model")(sequelize, Sequelize);
db.errorLog = require("./errorLog.model")(sequelize, Sequelize);


db.user.hasOne(db.userWallet);
db.userWallet.belongsTo(db.user);

db.user.hasOne(db.userData);
db.userData.belongsTo(db.user);

db.user.hasMany(db.gnsMarketOrder);
db.gnsMarketOrder.belongsTo(db.user);

db.user.hasMany(db.gnsLimitOrder);
db.gnsLimitOrder.belongsTo(db.user);

db.user.hasMany(db.gmxMarketOrder);
db.gmxMarketOrder.belongsTo(db.user);

db.user.hasMany(db.gmxLimitOrder);
db.gmxLimitOrder.belongsTo(db.user);

db.user.hasMany(db.betaCode);
db.betaCode.belongsTo(db.user);





module.exports = db;
