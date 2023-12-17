require("dotenv").config({ path: "../.env" });
const { Sequelize } = require("sequelize");
const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: "postgres", // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
});

const gnsPair = require("../database/gnsPair.model")(sequelize, Sequelize);
const errorLog = require("../database/errorLog.model")(sequelize, Sequelize);
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
const tradingContractArbitrumAddress =
  "0x2c7e82641f03Fa077F88833213210A86027f15dc";
const tradingContractPolyAddress = "0xb0901FEaD3112f6CaF9353ec5c36DC3DdE111F61";
const tradingStorageArbitrumAddress =
  "0xcFa6ebD475d89dB04cAd5A756fff1cb2BC5bE33c";
const tradingStoragePolyAddress = "0xaee4d11a16B2bc65EDD6416Fb626EB404a6D65BD";
const apedMultiSig = process.env.APED_MULTISIG_ADD;

const daiAbiPath = path.resolve(__dirname, "../contractABI/DAIcontract.json");
const daiRawData = fs.readFileSync(daiAbiPath);
const daiAbi = JSON.parse(daiRawData);
const daiAddressArbitrum = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
const daiAddressPolygon = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";

const openTradeGNSListener = async (account, network) => {
  //add contract listener to trading contract
  let tradingContract;
  if (network == "arbitrum") {
    tradingContract = new web3.eth.Contract(
      tradingContractAbi,
      tradingContractArbitrumAddress
    );
  } else {
    tradingContract = new web3Polygon.eth.Contract(
      tradingContractAbi,
      tradingContractPolyAddress
    );
  }

  //network

  listeners.forEach(async (listener) => {
    console.log(`Listening for events on contract ${contract}`);
    contract.events.MarketOrderInitiated().on("data", async (event) => {
      const eventData = event.returnValues;
      if (eventData.trader == account.address) {
        return eventData.orderId;
      }
    });
  });

  listeners.forEach(async (listener) => {
    console.log(`Listening for events on contract ${contract}`);
    contract.events.OpenLimitPlaced().on("data", async (event) => {
      const eventData = event.returnValues;
      if (eventData.trader == account.address) {
        return eventData.index;
      }
    });
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
  return new Promise(async (resolve, reject) => {
    const account = web3Polygon.eth.accounts.privateKeyToAccount(privateKey);

    const tradingContract = new web3Polygon.eth.Contract(
      tradingContractAbi,
      tradingContractPolyAddress
    );
    const daiContract = new web3Polygon.eth.Contract(daiAbi, daiAddressPolygon);
    const tradingStorage = tradingStoragePolyAddress;

    //calculate collateral and fees
    const collateral = web3Polygon.utils.fromWei(positionSizeDai, "ether");
    const fees = calculateFees(collateral);
    const tradeCollateral = (parseInt(collateral) * 0.99).toFixed(2);
    const positionSizeAfterFees = web3Polygon.utils.toWei(
      tradeCollateral,
      "ether"
    );

    try {

    //approve DAI for trade functions
    const gasPrice = await web3Polygon.eth.getGasPrice();
    const gasEstimate = await daiContract.methods
      .approve(tradingStorage, positionSizeAfterFees)
      .estimateGas({ from: account.address });

    const daiApproveTx = {
      from: account.address,
      to: daiAddressPolygon,
      gasPrice: gasPrice,
      gas: gasEstimate,
      data: daiContract.methods
        .approve(tradingStorage, positionSizeAfterFees)
        .encodeABI(),
    };

    const daiApproveSignature = await web3Polygon.eth.accounts.signTransaction(
      daiApproveTx,
      privateKey
    );

    await web3Polygon.eth
      .sendSignedTransaction(daiApproveSignature.rawTransaction)
      .on("receipt", async (receipt) => {
        const tgasPrice = await web3Polygon.eth.getGasPrice();

        const tradeTuple = {
          trader: account.address,
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

        const tradeTx = {
          from: account.address,
          to: tradingContractPolyAddress,
          gasPrice: tgasPrice,
          gas: 3000000,
          data: tradingContract.methods
            .openTrade(
              tradeTuple,
              orderType,
              "30000000000",
              "0x0000000000000000000000000000000000000000"
            )
            .encodeABI(),
        };

        const tradeSignature = await web3Polygon.eth.accounts.signTransaction(
          tradeTx,
          privateKey
        );

        await web3Polygon.eth
          .sendSignedTransaction(tradeSignature.rawTransaction)
          .on("receipt", (receipt) => {
               const tradeLogs = receipt.logs;
               var i = 0;
               while(i < tradeLogs.length) {
                    if(tradeLogs[i].address == "0xb0901fead3112f6caf9353ec5c36dc3dde111f61") {
                       const topics = tradeLogs[i].topics;
                       const hexOrderId = topics[1];
                       const orderId = web3Polygon.utils.hexToNumber(hexOrderId);

                       resolve(orderId);
                    }
               }
          });
      });
    } catch(error) {
      await errorLog.create({
        error: error.message,
        event: "openTradeGNS",
        timestamp: new Date(),
      });
      console.log(error);
      reject(error.message);
    }

  }); // end of return promise
};

module.exports.closeTradeGNS = async (
  privateKey,
  pairIndex,
  tradeIndex,
  network
) => {
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
    await errorLog.create({
      error: error.message,
      event: "closeTradeGNS",
      timestamp: new Date(),
    });
    console.log(error.message);
    return `Error closing GNS Trade: ${error}`;
  }
};

module.exports.cancelLimitOrderGNS = async (
  privateKey,
  pairIndex,
  limitIndex
) => {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const tradingContract = new web3.eth.Contract(tradingContractAbi, "");
  web3.eth.accounts.wallet.add(account);

  try {
    const receipt = await tradingContract.methods
      .cancelOpenLimitOrder(pairIndex, limitIndex)
      .send({ from: account });

    if (receipt.status == 1) {
      return { status: "success" };
    }
  } catch (error) {
    await errorLog.create({
      error: error.message,
      event: "cancelLimitTradeGNS",
      timestamp: new Date(),
    });
    console.log(error.message);
    return `Error closing Limit Trade: ${error}`;
  }
};
