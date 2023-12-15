require("dotenv").config({ path: "../.env" });
const { Sequelize } = require("sequelize");
const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: "postgres", // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
});

const gnsPair = require("../database/gnsPair.model")(sequelize, Sequelize);
const errorLog = require("../database/errorLog.model")(sequelize, Sequelize);
const path = require("path");
const fs = require("fs");
const { Web3, eth } = require("web3");
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
const tradingContractArbitrumAddress = '0x2c7e82641f03Fa077F88833213210A86027f15dc'
const tradingContractPolyAddress = '0x6d91EDb04166251345071998Cf0Ce546Ae810E17'
const tradingStorageArbitrumAddress = '0xcFa6ebD475d89dB04cAd5A756fff1cb2BC5bE33c'
const tradingStoragePolyAddress = '0xaee4d11a16B2bc65EDD6416Fb626EB404a6D65BD'
const apedMultiSig = process.env.APED_MULTISIG_ADD;

const daiAbiPath = path.resolve(__dirname, "../contractABI/DAIcontract.json");
const daiRawData = fs.readFileSync(daiAbiPath);
const daiAbi = JSON.parse(daiRawData);
const daiAddressArbitrum = '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1';
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
          return eventData.orderId;
        }
      }
    )

  });

  listeners.forEach(async (listener) => {
    console.log(`Listening for events on contract ${contract}`);
    contract.events.OpenLimitPlaced().on('data', async(event) => {
      const eventData = event.returnValues;
      if(eventData.trader == account.address) {
        return eventData.index;
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

  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const tradingContract = new web3.eth.Contract(tradingContractAbi, tradingContractArbitrumAddress);
  const daiContract = new web3.eth.Contract(daiAbi, daiAddressArbitrum);
  const tradingStorage = tradingStorageArbitrumAddress;

  web3.eth.accounts.wallet.add(account);
  const collateral = web3.utils.fromWei(positionSizeDai, 'ether');
  const fees = calculateFees(collateral);
  const tradeCollateral = Math.floor(parseInt(collateral) * 0.99);
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

    const gasPrice = await web3.eth.getGasPrice();

    const daiApproveTx = {
      from: account.address,
      to: daiAddressArbitrum,
      gasPrice: gasPrice,
      gas: 3000000,
      data: daiContract.methods
      .approve(tradingStorage, positionSizeAfterFees).encodeABI()
    }

    const daiApproveSignature = await web3.eth.accounts.signTransaction(
      daiApproveTx,
      privateKey
    );

    await web3.eth.sendSignedTransaction(daiApproveSignature.rawTransaction).on('receipt', async (receipt) => {

        const tgasPrice = await web3.eth.getGasPrice();

        const tradeTx = {
          from: account.address,
          to: tradingContractArbitrumAddress,
          gasPrice: tgasPrice,
          gas: 5000000,
          data: tradingContract.methods
          .openTrade(
            tradeTuple,
            orderType,
            0,
            "30000000000",
            "0x0000000000000000000000000000000000000000"
          ).encodeABI()
        }

        const tradeSignature = await web3.eth.accounts.signTransaction(
          tradeTx,
          privateKey
        )

        await web3.eth.sendSignedTransaction(tradeSignature.rawTransaction).on('receipt', (receipt) => {
            console.log('trade logs: ', receipt.logs);
        })


    })



    
    // grab event logs MarketOrderInitiated
    const orderId = await openTradeGNSListener(account.address, network);
    return orderId;

    // return the orderId
  } catch (error) {
    await errorLog.create({
      error: error.message,
      event: 'openTradeGNS',
      timestamp: new Date()
    })
    console.log(error);
  }
};

module.exports.closeTradeGNS = async (privateKey, pairIndex, tradeIndex, network) => {
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
      event: 'closeTradeGNS',
      timestamp: new Date()
    })
    console.log(error.message);
    return `Error closing GNS Trade: ${error}`;
  }
};

module.exports.cancelLimitOrderGNS = async (privateKey, pairIndex, limitIndex) => {
     const account = web3.eth.accounts.privateKeyToAccount(privateKey);
     const tradingContract = new web3.eth.Contract(tradingContractAbi, "");
     web3.eth.accounts.wallet.add(account);

     try{
       const receipt = await tradingContract.methods.cancelOpenLimitOrder(pairIndex, limitIndex).send({from: account});
 
       if(receipt.status == 1) {
        return {status : "success"}
       }
     } catch(error) {
      await errorLog.create({
        error: error.message,
        event: 'cancelLimitTradeGNS',
        timestamp: new Date()
      })
      console.log(error.message);
      return `Error closing Limit Trade: ${error}`;
     }

}


