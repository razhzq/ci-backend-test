require("dotenv").config({ path: "../.env" });
const { Sequelize } = require("sequelize");
const { getPairPriceGMX, closePositionGMX } = require("../helpers/gmx");
const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: "postgres", // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  logging: false,
});

const io = require("socket.io-client");
const { decryptor } = require("../helpers/decypter");
const socket = io(process.env.SOCKET_URL);

const gmxMarketOrder = require("../database/gmxMarketOrder.model")(
  sequelize,
  Sequelize
);

const userWallet = require("../database/userWallet.model")(
  sequelize,
  Sequelize
);

async function limitTriggerGMX() {
  const gmxMarkets = await gmxMarketOrder.findAll({
    where: { trade_status: 1 },
  });

  for (let i = 0; i < gmxMarkets.length; i++) {
    const currentPrice = await getPairPriceGMX(gmxMarkets[i].asset);
    const tp = gmxMarkets[i].takeProfit;
    const sl = gmxMarkets[i].stopLoss;
    const isLong = gmxMarkets[i].isLong;

    if (isLong == true) {
      const tpTrigger = tp * 0.99;
      const slTrigger = sl * 1.01;
      const wallet = await userWallet.findOne({
        where: { walletOwner: gmxMarkets[i].username },
      });
      const privateKey = decryptor(wallet.privateKey);
      if (currentPrice >= tpTrigger && currentPrice <= tp) {
        const closeTrade = await closePositionGMX(
          privateKey,
          gmxMarkets[i].asset,
          gmxMarkets[i].collateral,
          gmxMarkets[i].sizeDelta,
          gmxMarkets[i].isLong,
          wallet.walletOwner,
          tpTrigger
        );

        if(closeTrade.status == "success") {
            io.emit("tpTriggerGMX", gmxMarkets[i]);
        }
      } else if(currentPrice <= slTrigger && currentPrice >= sl) {
        const closeTrade = await closePositionGMX(
            privateKey,
            gmxMarkets[i].asset,
            gmxMarkets[i].collateral,
            gmxMarkets[i].sizeDelta,
            gmxMarkets[i].isLong,
            wallet.walletOwner,
            tpTrigger
          );

          if(closeTrade.status == "success") {
            io.emit("slTriggerGMX", gmxMarkets[i]);
        }
      }
    } else {
        const tpTrigger = tp * 1.01;
        const slTrigger = sl * 0.99;
        if(currentPrice <= tpTrigger && currentPrice >= tp) {
            const closeTrade = await closePositionGMX(
                privateKey,
                gmxMarkets[i].asset,
                gmxMarkets[i].collateral,
                gmxMarkets[i].sizeDelta,
                gmxMarkets[i].isLong,
                wallet.walletOwner,
                tpTrigger
              );
    
              if(closeTrade.status == "success") {
                io.emit("tpTriggerGMX", gmxMarkets[i]);
            }
        } else if (currentPrice >= tpTrigger && currentPrice <= sl) {
            const closeTrade = await closePositionGMX(
                privateKey,
                gmxMarkets[i].asset,
                gmxMarkets[i].collateral,
                gmxMarkets[i].sizeDelta,
                gmxMarkets[i].isLong,
                wallet.walletOwner,
                slTrigger
              );
    
              if(closeTrade.status == "success") {
                io.emit("slTriggerGMX", gmxMarkets[i]);
            }
        }
    }
  }
}

module.exports = limitTriggerGMX;
