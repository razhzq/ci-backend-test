require("dotenv").config({ path: "../.env" });
const { Sequelize } = require("sequelize");
const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: "postgres", // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
});
const path = require("path");
const axios = require('axios');
const fs = require("fs");
const { Web3 } = require("web3");
const { calculateFees } = require("./fees");
const providerUrl = process.env.ARBITRUM_HTTP;
const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));

const errorLog = require('../database/errorLog.model')(sequelize, Sequelize);

const gmxabiPath = path.resolve(__dirname, "../contractABI/GMXRouter.json");
const gmxrawData = fs.readFileSync(gmxabiPath);
const gmxRouterAbi = JSON.parse(gmxrawData);
const gmxRouterAddress = "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064";

const gmxPosabiPath = path.resolve(
  __dirname,
  "../contractABI/GMXPositionRouter.json"
);
const gmxPosrawData = fs.readFileSync(gmxPosabiPath);
const gmxPosRouterAbi = JSON.parse(gmxPosrawData);
const gmxPosRouterAddress = "0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868";

const daiAbiPath = path.resolve(__dirname, "../contractABI/DAIcontract.json");
const daiRawData = fs.readFileSync(daiAbiPath);
const daiAbi = JSON.parse(daiRawData);
const daiAddress = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
const apedMultiSig = process.env.APED_MULTISIG_ADD;

const gmxPairMap = new Map([
  ["BTC/USD", "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"],
  ["ETH/USD", "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"],
  ["LINK/USD", "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4"],
  ["UNI/USD", "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0"],
]);

module.exports.getAssetFromGMXAddress = (asset) => {
  if (gmxPairMap.has(asset)) {
    return gmxPairMap.get(asset);
  } else {
    console.log("asset does not exist");
  }
};

module.exports.getPairPriceGMX = async (asset) => {
  const pairContract = this.getAssetFromGMXAddress(asset);
  let price;
  try {
    await axios
      .get("https://api.gmx.io/prices")
      .then((p) => (price = p.data[pairContract]));
    return price;
  } catch (error) {
    console.log(error);
  }
};

module.exports.createPositionGMX = async (
  privateKey,
  indexToken,
  collateralAmount,
  isLong,
  price,
  leverage
) => {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  web3.eth.accounts.wallet.add(account);
  console.log('account: ', account.address)

  const routerContract = new web3.eth.Contract(gmxRouterAbi, gmxRouterAddress);
  const positionRouterContract = new web3.eth.Contract(
    gmxPosRouterAbi,
    gmxPosRouterAddress
  );
  const daiContract = new web3.eth.Contract(daiAbi, daiAddress);

  const fees = calculateFees(collateralAmount);
  const tradeCollateral = parseInt(collateralAmount) * 0.99;
  const collateralAfterFees = web3.utils.toWei(tradeCollateral.toString(), 'ether');

  const sizeDelta = tradeCollateral * leverage * 10 ** 30;
  //fees
 

  try {

    let gasPrice = await web3.eth.getGasPrice();
    let gasEstimate = await daiContract.methods.approve(gmxPosRouterAddress, collateralAfterFees).estimateGas({from: account.address});

    const tx = {
      from: account.address,
      to: daiAddress,
      gasPrice: gasPrice,
      gas: gasEstimate,
      data: daiContract.methods.approve(gmxPosRouterAddress, collateralAfterFees).encodeABI()
    }
    const daiSignature = await web3.eth.accounts.signTransaction(tx, privateKey);

    await web3.eth.sendSignedTransaction(daiSignature.rawTransaction).on("receipt", async (receipt) => {

     const rgasPrice = await web3.eth.getGasPrice();
     const rgasEstimate = await routerContract.methods.approvePlugin(gmxPosRouterAddress).estimateGas({ from: account.address});

      const routerTx = {
        from: account.address,
        to: gmxRouterAddress,
        gasPrice: rgasPrice,
        gasEstimate: rgasEstimate,
        data: routerContract.methods.approvePlugin(gmxPosRouterAddress).encodeABI()
      }

      const routerSignature = await web3.eth.accounts.signTransaction(routerTx, privateKey);

      await web3.eth.sendSignedTransaction(routerSignature.rawTransaction).on("receipt" , async (receipt) => {
        // gasPrice = await web3.eth.getGasPrice();
        // gasEstimate = await positionRouterContract.methods.createIncreasePosition([daiAddress],indexToken,collateralAfterFees,0,BigInt(sizeDelta),isLong,price,BigInt(180000000000000), "0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000").estimateGas({from: account.address});

        // const posRouterTx = {
        //   from: account.address,
        //   to: gmxPosRouterAddress,
        //   gasPrice: gasPrice,
        //   gasEstimate: gasEstimate,
        //   data: positionRouterContract.methods.createIncreasePosition([daiAddress],indexToken,collateralAfterFees,0,BigInt(sizeDelta),isLong,price,BigInt(180000000000000), "0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000").encodeABI()
        // }
        // const posRouterSignature = await web3.eth.accounts.signTransaction(posRouterTx, privateKey);

        // await web3.eth.sendSignedTransaction(posRouterSignature.rawTransaction).on('receipt', (receipt) => {
        //     return "success";
        // })
      })


    })  
    // await daiContract.methods
    //   .approve(gmxPosRouterAddress, collateralAfterFees)
    //   .send({
    //     from: account.address,
    //     gasLimit: "5000000",
    //     transactionBlockTimeout: 200,
    //   })
    //   .on("transactionHash", (hash) => {
    //     routerContract.methods
    //       .approvePlugin(gmxPosRouterAddress)
    //       .send({
    //         from: account.address,
    //         gasLimit: "5000000",
    //         transactionBlockTimeout: 200,
    //       })
    //       .on("transactionHash", (hash) => {
    //         positionRouterContract.methods.createIncreasePosition([daiAddress],indexToken,collateralAfterFees,0,BigInt(sizeDelta),isLong,price,BigInt(180000000000000), "0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000");
    //       })
    //       .send({
    //         from: account.address,
    //         gasLimit: "5000000",
    //         transactionBlockTimeout: 200,
    //       })
    //       .on("receipt", async (receipt) => {
    //         if (receipt.status == true) {

    //           await daiContract.methods.transfer(apedMultiSig, fees).send({ from: account.address,
    //             gasLimit: "210000",
    //             transactionBlockTimeout: 200})

    //           return "success";
    //         } else {
    //           return "fail";
    //         }
    //       });
    //   });
  } catch (error) {
    await errorLog.create({
      error: error.message,
      event: 'openTradeGMX',
      timestamp: new Date()
    })
    console.log(error);
  }
};

module.exports.closePositionGMX = async (
  privateKey,
  asset,
  collateral,
  sizeDelta,
  isLong,
  receiver,
  price
) => {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const positionRouterContract = new web3.eth.Contract(
    gmxPosRouterAbi,
    gmxPosRouterAddress
  );

  const indexToken = this.getAssetFromGMXAddress(asset);

  try {
    await positionRouterContract.methods
      .createDecreasePosition(
        daiAddress,
        indexToken,
        collateral,
        sizeDelta,
        isLong,
        receiver,
        price,
        0,
        BigInt(180000000000000),
        false,
        "0x0000000000000000000000000000000000000000"
      ).send({
        from: account,
        gasLimit: "5000000",
        transactionBlockTimeout: 200,
      })
      .on("receipt", (receipt) => {
        if (receipt.status == true) {
          return "success";
        } else {
          return "fail";
        }
      });
  } catch (error) {
    await errorLog.create({
      error: error.message,
      event: 'closeTradeGMX',
      timestamp: new Date()
    })
    console.log(error.message);
  }
};
