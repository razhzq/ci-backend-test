require("dotenv").config({ path: "../.env" });
const { Sequelize } = require("sequelize");
const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: "postgres", // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
});
const { Web3 } = require("web3");
const providerUrl = process.env.ARBITRUM_HTTP;
const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));

const path = require("path");
const axios = require("axios");
const fs = require("fs");

const daiAbiPath = path.resolve(__dirname, "../contractABI/DAIcontract.json");
const daiRawData = fs.readFileSync(daiAbiPath);
const daiAbi = JSON.parse(daiRawData);
const daiAddress = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";

const errorLog = require("../database/errorLog.model")(sequelize, Sequelize);

const apedWallet = process.env.APED_WALLET;

module.exports.calculateFees = (collateral) => {
  const fees = parseFoat(collateral) * 0.01;
  const feesInWei = Web3.utils.toWei(fees.toString(), "ether");
  return feesInWei;
};

module.exports.calculateTakeProfit = (
  leverage,
  entryPrice,
  expectedProfitPercent,
  isLong
) => {
  let takeProfitPrice;
  if (isLong == true) {
    takeProfitPrice =
      entryPrice + 0.01 * entryPrice * (expectedProfitPercent / leverage);
  } else {
    takeProfitPrice =
      entryPrice - 0.01 * entryPrice * (expectedProfitPercent / leverage);
  }
  return takeProfitPrice.toFixed(2);
};

module.exports.calculateStopLoss = (leverage, entryPrice, lossPercent, isLong) => {
  let stopLossPrice;
  if (isLong == true) {
    stopLossPrice =
      entryPrice - 0.01 * entryPrice * (Math.abs(lossPercent) / leverage);
  } else {
    stopLossPrice =
      entryPrice + 0.01 * entryPrice * (Math.abs(lossPercent) / leverage);
  }

  return stopLossPrice.toFixed(2);
};


module.exports.transferFees = async (feesAmount, privateKey, eventName) => {
   const account = web3.eth.accounts.privateKeyToAccount(privateKey);
   const daiContract = new web3.eth.Contract(daiAbi, daiAddress);

   try{
    const gasEstimate = await daiContract.methods.transfer(apedWallet, feesAmount).estimateGas({from: account.address});
   const gasPrice = await web3.eth.getGasPrice();

   const daiTx = {
    from: account.address,
    to: apedWallet,
    gasPrice: gasPrice,
    gas: gasEstimate,
    data: daiContract.methods.transfer(apedWallet, feesAmount).encodeABI();
   }

   const daiSignature = await web3.eth.accounts.signTransaction(
    daiTx,
    privateKey
   )

   await web3.eth.sendSignedTransaction(daiSignature.rawTransaction).on("receipt", (receipt) => {
      if(receipt.status == BigInt(1)) {
        console.log("transfer Fees successfull");
      } else {
        console.log("transfer Fess fail");
      }
   })
     
   } catch(error) {
      console.log(error);
      await errorLog.create({
        error: error.message,
        event: eventName,
        address: account.address,
        timestamp: new Date()
      })
   }
   
}
