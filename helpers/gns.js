require("dotenv").config();
const { Sequelize } = require("sequelize");
const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: "postgres", // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
});

const gnsPair = require("../database/gnsPair.model")(sequelize, Sequelize);
const path = require("path");
const fs = require("fs");
const { Web3 } = require("web3");
const { listeners } = require("process");
const providerUrl = process.env.ARBITRUM_HTTP;
const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));

const polygonProvider = process.env.POLYGON_HTTP;
const web3Polygon = new Web3(new Web3.providers.HttpProvider(polygonProvider));

const gnsabiPath = path.resolve(__dirname, "../contractABI/GNSPrice.json");
const gnsrawData = fs.readFileSync(gnsabiPath);
const pricecontractAbi = JSON.parse(gnsrawData);

const gnsTradingabiPath = path.resolve(
  __dirname,
  "../contractABI/GNSTradingContract.json"
);
const gnsTradingrawData = fs.readFileSync(gnsTradingabiPath);
const tradingContractAbi = JSON.parse(gnsTradingrawData);

const daiAbiPath = path.resolve(__dirname, "../contractABI/DAIcontract.json");
const daiRawData = fs.readFileSync(daiAbiPath);
const daiAbi = JSON.parse(daiRawData);

const openTradeGNSListener = async (account) => {
  listeners.forEach(async (listener) => {
    console.log(`Listening for events on contract ${contract}`);
    contract.events[listener.event.name]({ filter: { from: account } }).on(
      "MarketOrderInitiated",
      (OrderID) => {
        console.log(OrderID);
        return OrderID;
      }
    );
  });

  listeners.forEach(async (listener) => {
    console.log(`Listening for events on contract ${contract}`);
    contract.events[listener.event.name]({ filter: { from: account } }).on(
      "OpenLimitPlaced",
      (OrderID) => {
        console.log(OrderID);
        return OrderID;
      }
    );
  });
};

module.exports.getGnsPairPrice = async (asset) => {
  const pair = await gnsPair.findOne({ where: { pairName: asset } });

  if (pair?.network == "arbitrum") {
    contract = new web3.eth.Contract(pricecontractAbi, pair?.contractAddress);
  } else {
    contract = new web3Polygon.eth.Contract(
      pricecontractAbi,
      pair?.contractAddress
    );
  }

  try {
    const price = await contract.methods.latestAnswer().call();
    const priceMul = BigInt(price) / BigInt(10 ** 8);
    const convPrice = parseInt(priceMul.toString());
    return convPrice;
  } catch (error) {
    console.log(`Error reading from contract: ${error.message}`);
  }
};

module.exports.openTradeGNS = async (
  privateKey,
  network,
  pairIndex,
  positionSizeDai,
  openPrice,
  isLong,
  leverage,
  tp,
  sl
) => {
  let account;
  let tradingContract;
  let daiContract;
  let tradingStorageAddress;

  if (network == "arbitrum") {
    account = web3.eth.accounts.privateKeyToAccount(privateKey);
    tradingContract = new web3.eth.Contract(tradingContractAbi, "");
    daiContract = new web3.eth.Contract(daiAbi, "");
    tradingStorageAddress = "";
  } else {
    account = web3Polygon.eth.accounts.privateKeyToAccount(privateKey);
    tradingContract = new web3Polygon.eth.Contract(tradingContractAbi, "");
    daiContract = new web3Polygon.eth.Contract(daiAbi, "");
    tradingStorageAddress = "";
  }
  web3.eth.accounts.wallet.add(account);

  const tradeTuple = {
    trader: account,
    pairIndex: pairIndex,
    index: 0,
    initialPostToken: 0,
    positionSizeDai: positionSizeDai,
    openPrice: openPrice,
    buy: isLong,
    leverage: leverage,
    tp: tp,
    sl: sl,
  };

  try {
    await daiContract.methods
      .approve("", "amount")
      .send({
        from: account,
        gasLimit: "5000000",
        transactionBlockTimeout: 200,
      })
      .then((transactionHash) => {
        tradingContract.methods
          .openTrade(
            tradeTuple,
            0,
            0,
            "30000000000",
            "0x0000000000000000000000000000000000000000"
          )
          .send({
            from: account,
            gasLimit: "5000000",
            transactionBlockTimeout: 200,
          });
      });

    // grab event logs MarketOrderInitiated
    await openTradeGNSListener(account);

    // return the orderId
  } catch (error) {
    console.log(error);
  }
};

module.exports.closeTradeGNS = async (privateKey, pairIndex, tradeIndex) => {
  let account;
  let tradingContract;
  let daiContract;
  let tradingStorageAddress;
  let status;
  if (network == "arbitrum") {
    account = web3.eth.accounts.privateKeyToAccount(privateKey);
    tradingContract = new web3.eth.Contract(tradingContractAbi, "");
    daiContract = new web3.eth.Contract(daiAbi, "");
    tradingStorageAddress = "";
  } else {
    account = web3Polygon.eth.accounts.privateKeyToAccount(privateKey);
    tradingContract = new web3Polygon.eth.Contract(tradingContractAbi, "");
    daiContract = new web3Polygon.eth.Contract(daiAbi, "");
    tradingStorageAddress = "";
  }
  web3.eth.accounts.wallet.add(account);

  try {
    await tradingContract.methods
      .closeTradeMarket(pairIndex, tradeIndex)
      .send({ from: account })
      .on("transactionHash", () => {
        status = "success";
        return status;
      });
  } catch (error) {
    return `Error closing GNS Trade: ${error}`;
  }
};
