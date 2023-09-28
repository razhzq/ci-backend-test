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
const { calculateFees } = require("./fees");
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
const tradingContractArbitrumAddress = ''
const tradingContractPolyAddress = '0x6d91EDb04166251345071998Cf0Ce546Ae810E17'
const tradingStorageArbitrumAddress = ''
const tradingStoragePolyAddress = '0xaee4d11a16B2bc65EDD6416Fb626EB404a6D65BD'
const apedMultiSig = process.env.APED_MULTISIG_ADD;

const daiAbiPath = path.resolve(__dirname, "../contractABI/DAIcontract.json");
const daiRawData = fs.readFileSync(daiAbiPath);
const daiAbi = JSON.parse(daiRawData);
const daiAddressArbitrum = '';
const daiAddressPolygon = '';

const openTradeGNSListener = async (account, network) => {
  //add contract listener to trading contract
  let tradingContract;
  if(network == 'arbitrum') {
    tradingContract = new web3.eth.Contract(tradingContractAbi, tradingContractArbitrumAddress);
  } else {
    tradingContract = new web3Polygon.eth.Contract(tradingContractAbi, tradingContractPolyAddress);
  }
  

  //network

  listeners.forEach(async (listener) => {
    console.log(`Listening for events on contract ${contract}`);
    contract.events.MarketOrderInitiated().on(
      'data', async(event) => {
        const eventData = event.returnValues;
        if(eventData.trader == account.address) {
          return eventData.OrderId;
        }
      }
    )

  });

  listeners.forEach(async (listener) => {
    console.log(`Listening for events on contract ${contract}`);
    contract.events.OpenLimitPlaced().on('data', async(event) => {
      const eventData = event.returnValues;
      if(eventData.trader == account.address) {
        return eventData.pairIndex;
      }
    })
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
  sl,
  orderType
) => {
  let account;
  let tradingContract;
  let daiContract;
  let tradingStorage;

  if (network == "arbitrum") {
    account = web3.eth.accounts.privateKeyToAccount(privateKey);
    tradingContract = new web3.eth.Contract(tradingContractAbi, tradingContractArbitrumAddress);
    daiContract = new web3.eth.Contract(daiAbi, daiAddressArbitrum);
    tradingStorage = tradingStorageArbitrumAddress;
  } else {
    account = web3Polygon.eth.accounts.privateKeyToAccount(privateKey);
    tradingContract = new web3Polygon.eth.Contract(tradingContractAbi, tradingContractPolyAddress);
    daiContract = new web3Polygon.eth.Contract(daiAbi, daiAddressPolygon);
    tradingStorage = tradingStoragePolyAddress;
  }
  web3.eth.accounts.wallet.add(account);
  const collateral = web3.utils.fromWei(positionSizeDai, 'ether');
  const fees = calculateFees(collateral);
  const tradeCollateral = parseInt(collateral) * 0.99;
  const positionSizeAfterFees = web3.utils.toWei(tradeCollateral.toString(), 'ether');

  const tradeTuple = {
    trader: account,
    pairIndex: pairIndex,
    index: 0,
    initialPostToken: 0,
    positionSizeDai: positionSizeAfterFees,
    openPrice: openPrice,
    buy: isLong,
    leverage: leverage,
    tp: tp,
    sl: sl,
  };

  try {
    await daiContract.methods
      .approve(tradingStorage, "amount")
      .send({
        from: account,
        gasLimit: "5000000",
        transactionBlockTimeout: 200,
      })
      .then((transactionHash) => {
        tradingContract.methods
          .openTrade(
            tradeTuple,
            orderType,
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
    await daiContract.methods.transfer(apedMultiSig, fees).send({from: account,
                                                                 gasLimit: "5000000",
                                                                 transactionBlockTimeout: 200, })
    // grab event logs MarketOrderInitiated
    const orderId = await openTradeGNSListener(account, network);
    return orderId;

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


