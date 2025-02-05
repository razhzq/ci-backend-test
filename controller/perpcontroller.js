require("dotenv").config({ path: "../.env" });
const { Sequelize } = require("sequelize");
const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: "postgres", // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  logging: false
});
const {
  openTradeGNS,
  getGnsPairPrice,
  closeTradeGNS,
  cancelLimitOrderGNS,
} = require("../helpers/gns");
const { Web3, net } = require("web3");
const gnsPair = require("../database/gnsPair.model")(sequelize, Sequelize);
const gnsMarketOrder = require("../database/gnsMarketOrder.model")(
  sequelize,
  Sequelize
);
const gnsLimitOrder = require("../database/gnsLimitOrder.model")(
  sequelize,
  Sequelize
);
const gmxMarketOrder = require("../database/gmxMarketOrder.model")(
  sequelize,
  Sequelize
);
const gmxLimitOrder = require("../database/gmxLimitOrder.model")(
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
//decryption
const {
  getAssetFromGMXAddress,
  createPositionGMX,
  getPairPriceGMX,
  closePositionGMX,
} = require("../helpers/gmx");
const { decryptor } = require("../helpers/decypter");
const { calculateFees, calculateTakeProfit, calculateStopLoss } = require("../helpers/fees");

module.exports.OpenMarketGNS = async (req, res) => {
  const {
    collateral,
    leverage,
    asset,
    tpPercent,
    slPercent,
    network,
    isLong,
    userAddress,
    orderType,
    limitPrice,
  } = req.body;

  let tradeIndex;
  let tradeTotal;

  const pair = await gnsPair.findOne({ where: { pairName: asset } });
  const wallet = await userWallet.findOne({
    where: { publicKey: userAddress },
  });
  const gasOptimization = await gasOptimize.findOne({ where: { username: wallet.walletOwner}});
  const multiply = await multiplier.findAll();

  const privateKey = await decryptor(wallet.privateKey);
  const price = await getGnsPairPrice(asset);
  const spreadPrice = Math.floor(price * 1.0005);
  const convPrice = BigInt(spreadPrice * 10 ** 10);

  const tp = calculateTakeProfit(leverage, spreadPrice, tpPercent, isLong);
  const sl = calculateStopLoss(leverage, spreadPrice, slPercent, isLong);

  console.log("spread price: ", spreadPrice);
  console.log("conv Spread price: ", convPrice);
  const bananaPoints =
    ((collateral * leverage) / 100) * multiply[0].pointsMultiplier;

  const tpConv = BigInt((tp) * 10 ** 10);
  const slConv = BigInt((sl) * 10 ** 10);  

  console.log('tp: ', tpConv);
  console.log('sl: ', slConv);

  const convLimitPrice = BigInt(limitPrice.toFixed(2) * (10 ** 10));

  //check tradeindex
  if (orderType == 0) {
    tradeTotal = await gnsMarketOrder.findAll({
      where: { username: wallet.walletOwner, asset: asset, trade_status: 0 },
    });
  } else {
    tradeTotal = await gnsLimitOrder.findAll({
      where: { username: wallet.walletOwner, asset: asset },
    });
  }

  while (tradeTotal.length == 3) {
    res.status(200).json({
      status: false,
      msg: 'MAX'
    });
  }

  if (tradeTotal.length == 0) {
    tradeIndex = 0;
  } else {
    tradeIndex = tradeTotal.length;
  }

  try {
    if (orderType == 0) {
      const orderId = await openTradeGNS(
        privateKey,
        network,
        pair.pairId,
        collateral,
        convPrice,
        isLong,
        leverage,
        tpConv,
        slConv,
        orderType,
        gasOptimization.gnsDaiApprove,
        wallet.walletOwner
      );
      await gnsMarketOrder.create({
        asset: asset,
        trade_status: 0,
        price: spreadPrice,
        collateral: collateral,
        delta: 0,
        tradeIndex: tradeIndex,
        orderId: orderId, // change to orderId when back to production
        isLong: isLong,
        leverage: leverage,
        network: network,
        username: wallet.walletOwner,
      });

      await userData.update(
        { points: bananaPoints },
        { where: { username: wallet.walletOwner } }
      );

      res.status(200).json({
        trade_status: "success",
      });
    } else {
      const limitTradeIndex = await openTradeGNS(
        privateKey,
        network,
        pair.pairId,
        collateral,
        convLimitPrice,
        isLong,
        leverage,
        tpConv,
        slConv,
        orderType,
        gasOptimization.gnsDaiApprove,
        wallet.walletOwner
      );
      await gnsLimitOrder.create({
        asset: asset,
        price: limitPrice,
        collateral: collateral,
        delta: 0,
        tradeIndex: limitTradeIndex, // tradeIndex,
        isLong: isLong,
        leverage: leverage,
        network: network,
        username: wallet.walletOwner,
      });
      res.status(200).json({
        trade_status: "success",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({
      trade_status: error,
    });
  }
};

module.exports.closeMarketOrderGNS = async (req, res) => {
  const { asset, tradeIndex, userAddress, network } = req.body;

  const pair = await gnsPair.findOne({ where: { pairName: asset } });

  const wallet = await userWallet.findOne({
    where: { publicKey: userAddress },
  });
  const privateKey = await decryptor(wallet.privateKey);

  try {
    const status = await closeTradeGNS(
      privateKey,
      pair.pairId,
      tradeIndex,
      network
    );

    if (status == "success") {
      await gnsMarketOrder.update(
        { trade_status: 1 },
        {
          where: {
            username: wallet.walletOwner,
            asset: asset,
            tradeIndex: tradeIndex,
          },
        }
      );

      res.status(200).json({
        closeOrder: "success",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({
      closeOrder: error,
    });
  }
};

module.exports.cancelLimitGNS = async (req, res) => {
  const { asset, tradeIndex, username } = req.body;

  const pair = await gnsPair.findOne({ where: { pairName: asset } });

  const wallet = await userWallet.findOne({ where: { walletOwner: username } });
  const privateKey = await decryptor(wallet.privateKey);
  try {
    const receipt = await cancelLimitOrderGNS(
      privateKey,
      pair.pairId,
      tradeIndex
    );
    if (receipt.status == "success") {
      await gnsLimitOrder.destroy({
        where: { asset: asset, tradeIndex: tradeIndex, username: username },
      });

      res.status(200).json({
        status: 1,
      });
    } else {
      res.status(400).json("error closing limit order on GNS");
    }
  } catch (error) {
    console.log(error);
    res.status(500).json("Internal server error");
  }
};

module.exports.openMarketGMX = async (req, res) => {
  const { userAddress, asset, collateral, leverage, isLong, tpPercent, slPercent } = req.body;

  const multiply = await multiplier.findAll();

  const indexToken = getAssetFromGMXAddress(asset);

  const wallet = await userWallet.findOne({
    where: { publicKey: userAddress },
  });
  const gasOptimization = await gasOptimize.findOne({where: {username: wallet.walletOwner}});

  const privateKey = await decryptor(wallet.privateKey);

  const price = await getPairPriceGMX(asset);
  const priceDec = BigInt(price) / BigInt(10 ** 30);
  let convPrice;
  const intPrice = parseInt(priceDec);

  const tpPrice = calculateTakeProfit(leverage, intPrice, tpPercent, isLong);
  const slPrice = calculateStopLoss(leverage, intPrice, slPercent, isLong);

  const tradeCollateral = Math.floor(parseInt(collateral) * 0.99);

  if (isLong == true) {
    convPrice = intPrice + intPrice * 0.005;
  } else {
    convPrice = intPrice - intPrice * 0.005;
  }

  const sizeDelta = tradeCollateral * leverage;
  const bananaPoints = (sizeDelta / 100) * multiply[0].pointsMultiplier;

  try {
    const trade = await createPositionGMX(
      privateKey,
      indexToken,
      collateral,
      isLong,
      convPrice,
      leverage,
      gasOptimization.gmxDaiApprove,
      gasOptimization.gmxPositionRouterApprove,
      wallet.walletOwner
    );
    const relatedTrades = await gmxMarketOrder.findAll({
      where: {
        username: wallet.walletOwner,
        asset: asset,
        trade_status: 0,
        isLong: isLong,
      },
    });
    console.log("trade status :", trade);
    if (trade.status == "success") {
      if (relatedTrades.length > 0) {
        await gmxMarketOrder.update(
          {
            collateral: relatedTrades[0].collateral + collateral,
            sizeDelta: relatedTrades[0].sizeDelta + sizeDelta,
          },
          { where: { id: relatedTrades[0].id } }
        );
      } else {
        await gmxMarketOrder.create({
          asset: asset,
          trade_status: 0,
          indexToken: indexToken,
          delta: 0,
          collateral: collateral,
          sizeDelta: sizeDelta,
          isLong: isLong,
          price: convPrice,
          takeProfit: tpPrice,
          stopLoss: slPrice,
          username: wallet.walletOwner,
        });
      }
      await userData.update(
        { points: bananaPoints },
        { where: { username: wallet.walletOwner } }
      );
      res.status(200).json({
        status: "success",
      });
    } else {
      res.status(200).json({
        status: "fail",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({
      error: error,
    });
  }
};

module.exports.openLimitGMX = async (req, res) => {
  const { userAddress, asset, collateral, leverage, isLong, limitPrice } =
    req.body;
  const indexToken = getAssetFromGMXAddress(asset);
  const sizeDelta = collateral * leverage;

  const price = await getPairPriceGMX(asset);
  const wallet = await userWallet.findOne({
    where: { publicKey: userAddress },
  });

  try {
    await gmxLimitOrder.create({
      asset: asset,
      indexToken: indexToken,
      collateral: collateral,
      sizeDelta: sizeDelta,
      isLong: isLong,
      leverage: leverage,
      price: limitPrice,
      username: wallet.walletOwner,
    });
    res.status(200).json({
      status: "success",
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({
      error: error,
    });
  }
};

module.exports.cancelLimitGMX = async (req, res) => {
  const { id, asset, username } = req.body;

  try {
    await gmxLimitOrder.destroy({
      where: { id: id, asset: asset, username: username },
    });

    res.status(200).json({
      status: "success",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json("Error deleting limit orders");
  }
};

module.exports.closeMarketGMX = async (req, res) => {
  const { asset, collateral, isLong, sizeDelta, userAddress } = req.body;

  const wallet = await userWallet.findOne({
    where: { publicKey: userAddress },
  });
  const privateKey = await decryptor(wallet.privateKey);

  const price = await getPairPriceGMX(asset);
  const priceDec = BigInt(price) / BigInt(10 ** 30);
  let convPrice;
  const intPrice = parseInt(priceDec);
  if (isLong == true) {
    convPrice = intPrice - intPrice * 0.003;
  } else {
    convPrice = intPrice + intPrice * 0.003;
  }

  try {
    const trade = await closePositionGMX(
      privateKey,
      asset,
      collateral,
      sizeDelta,
      isLong,
      wallet.publicKey,
      convPrice
    );
    if (trade.status == "success") {
      await gmxMarketOrder.update(
        { trade_status: 1 },
        {
          where: {
            asset: asset,
            isLong: isLong,
            collateral: collateral,
            username: wallet.walletOwner,
          },
        }
      );
      res.status(200).json({
        status: "success",
      });
    } else {
      res.status(200).json({
        status: "fail",
      });
    }
  } catch (error) {
    res.status(400).json({
      error: error,
    });
  }
};

module.exports.aggregator = async (req, res) => {
  const { asset, isLong } = req.body;

  const gmxPrice = await getPairPriceGMX(asset); 
  const gnsPrice = await getGnsPairPrice(asset);

  if (isLong == "long") {
    if (gmxPrice > gnsPrice) {
      res.status(200).json({
        best: "gns",
      });
    } else {
      res.status(200).json({
        best: "gmx",
      });
    }
  } else {
    if (gmxPrice > gnsPrice) {
      res.status(200).json({
        best: "gmx",
      });
    } else {
      res.status(200).json({
        best: "gns",
      });
    }
  }
};

module.exports.aggregatorUser = async (req, res) => {
  const { asset, isLong, platform } = req.body;

  let priceArray;

  try {
    for (let i = 0; i < platform.length; i++) {
      if (platform[i] == "gmx") {
        const gmxPrice = await getPairPriceGMX(asset);
        priceArray.push({ price: gmxPrice, platform: "gmx" });
      } else if (platform[i] == "gns") {
        const gnsPrice = await getGnsPairPrice(asset);
        priceArray.push({ price: gnsPrice, platform: "gns" });
      }
    }

    priceArray.sort((a, b) => a.price - b.price); // lowest to highest

    if (isLong == true) {
      res.status(200).json({
        best: priceArray[0].platform,
      });
    } else {
      res.status(200).json({
        best: priceArray[priceArray.length - 1].platform,
      });
    }
  } catch (error) {
    res.status(400).json("Error getting price");
  }
};
