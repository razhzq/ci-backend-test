require("dotenv").config({ path: "../.env" });
const { Sequelize } = require("sequelize");
const { getPairPriceGMX } = require("../helpers/gmx");
const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: "postgres", // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  logging: false,
});
const io = require("socket.io-client");
const socket = io(process.env.SOCKET_URL);

const gmxLimitOrder = require("../database/gmxLimitOrder.model")(
  sequelize,
  Sequelize
);
const gmxMarketOrder = require("../database/gmxMarketOrder.model")(
  sequelize,
  Sequelize
);
const userWallet = require("../database/userWallet.model")(
  sequelize,
  Sequelize
);
const userData = require("../database/userData.model")(sequelize, Sequelize);
const multiplier = require("../database/multiplier.model")(
  sequelize,
  Sequelize
);
const gasOptimize = require("../database/gasOptimize.model")(sequelize, Sequelize);
const { createPositionGMX, getAssetFromGMXAddress } = require("../helpers/gmx");
const { decryptor } = require("../helpers/decypter");

var cron = require("node-cron");

async function checkLimitOrderActiveGMX() {
  const gmxAllLimitTrades = await gmxLimitOrder.findAll();
  const multiply = await multiplier.findAll();

  for (let i = 0; i < gmxAllLimitTrades.length; i++) {
    const limitPrice = gmxAllLimitTrades[i].price;
    const asset = gmxAllLimitTrades[i].asset;
    const isLong = gmxAllLimitTrades[i].isLong;

    const currentPrice = await getPairPriceGMX(asset);
    const gasOptimization = await gasOptimize.findOne({where: {username: gmxAllLimitTrades[i].username}})

    const tradeData = {
      asset: asset,
      isLong: isLong,
      collateral: collateral,
      leverage: gmxAllLimitTrades[i].leverage,
      username: gmxAllLimitTrades[i].username,
    };

    if (isLong == true) {
      const triggerPrice = limitPrice * 1.01;
      if (currentPrice <= triggerPrice && currentPrice >= limitPrice) {
        const wallet = await userWallet.findOne({
          where: { walletOwner: gmxAllLimitTrades[i].username },
        });
        const privateKey = await decryptor(wallet.privateKey);
        const indexToken = getAssetFromGMXAddress(asset);
        const status = await createPositionGMX(
          privateKey,
          indexToken,
          gmxAllLimitTrades[i].collateral,
          isLong,
          triggerPrice,
          gmxAllLimitTrades[i].leverage,
          gasOptimization.gmxDaiApprove,
          gasOptimization.gmxPositionRouterApprove,
          gmxAllLimitTrades[i].username
        );
        const user = await userData.findOne({
          where: { username: wallet.walletOwner },
        });

        if (status.status == "success") {
          const sizeDelta =
            gmxAllLimitTrades[i].collateral * gmxAllLimitTrades[i].leverage;
          const bananaPoints = (sizeDelta / 100) * multiply[0].pointsMultiplier;
          const totalPoints = user.points + bananaPoints;
          await gmxMarketOrder.create({
            asset: asset,
            trade_status: 0,
            indexToken: indexToken,
            delta: 0,
            collateral: gmxAllLimitTrades[i].collateral,
            sizeDelta: sizeDelta,
            isLong: isLong,
            price: triggerPrice,
            username: gmxAllLimitTrades[i].username,
          });

          await userData.update(
            { points: totalPoints },
            { where: { username: wallet.walletOwner } }
          );
          await gmxLimitOrder.destroy({
            where: { id: gmxAllLimitTrades[i].id },
          });
          socket.emit("gmxLimitOpen", gmxAllLimitTrades[i]);
        }
      }
    } else {
      const triggerPrice = limitPrice * 0.99;
      if (currentPrice >= triggerPrice && currentPrice <= limitPrice) {
        const wallet = await userWallet.findOne({
          where: { walletOwner: gmxAllLimitTrades[i].username },
        });
        const privateKey = await decryptor(wallet.privateKey);
        const indexToken = getAssetFromGMXAddress(asset);
        const status = await createPositionGMX(
          privateKey,
          indexToken,
          gmxAllLimitTrades[i].collateral,
          isLong,
          triggerPrice,
          gmxAllLimitTrades[i].leverage,
          gasOptimization.gmxDaiApprove,
          gasOptimization.gmxPositionRouterApprove,
          gmxAllLimitTrades[i].username
        );
        const user = await userData.findOne({
          where: { username: wallet.walletOwner },
        });

        if (status.status == "success") {
          const sizeDelta =
            gmxAllLimitTrades[i].collateral * gmxAllLimitTrades[i].leverage;
          const bananaPoints = (sizeDelta / 100) * multiply[0].pointsMultiplier;
          const totalPoints = user.points + bananaPoints;
          await gmxMarketOrder.create({
            asset: asset,
            trade_status: 0,
            indexToken: indexToken,
            delta: 0,
            collateral: gmxAllLimitTrades[i].collateral,
            sizeDelta: sizeDelta,
            isLong: isLong,
            price: triggerPrice,
            username: gmxAllLimitTrades[i].username,
          });
          await userData.update(
            { points: totalPoints },
            { where: { username: wallet.walletOwner } }
          );
          await gmxLimitOrder.destroy({
            where: { id: gmxAllLimitTrades[i].id },
          });
          socket.emit("gmxLimitOpen", gmxAllLimitTrades[i]);
        }
      }
    }
  }
}

module.exports = checkLimitOrderActiveGMX;
