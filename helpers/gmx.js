require("dotenv").config({ path: "../.env" });
const { Sequelize } = require("sequelize");
const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: "postgres", // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
});
const path = require("path");
const axios = require("axios");
const fs = require("fs");
const { Web3 } = require("web3");
const { calculateFees } = require("./fees");
const providerUrl = process.env.ARBITRUM_HTTP;
const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));

const errorLog = require("../database/errorLog.model")(sequelize, Sequelize);
const gasOptimize = require("../database/gasOptimize.model")(
  sequelize,
  Sequelize
);

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

const gmxOrderBookabiPath = path.resolve(
  __dirname,
  "../contractABI/GMXOrderbook.json"
);
const gmxOrderBookrawData = fs.readFileSync(gmxOrderBookabiPath);
const gmxOrderBookAbi = JSON.parse(gmxOrderBookrawData);
const gmxOrderBookAddress = "";

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
  leverage,
  daiApprove,
  posRouterPluginApprove,
  username
) => {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  web3.eth.accounts.wallet.add(account);
  console.log("account: ", account.address);

  const routerContract = new web3.eth.Contract(gmxRouterAbi, gmxRouterAddress);
  const positionRouterContract = new web3.eth.Contract(
    gmxPosRouterAbi,
    gmxPosRouterAddress
  );
  const daiContract = new web3.eth.Contract(daiAbi, daiAddress);

  const fees = calculateFees(collateralAmount);
  const tradeCollateral = Math.floor(parseInt(collateralAmount) * 0.99);
  const collateralAfterFees = web3.utils.toWei(
    tradeCollateral.toString(),
    "ether"
  );

  console.log("fees: ", fees);
  console.log("tradeCollateral: ", tradeCollateral);
  console.log("index: ", indexToken);
  const sizeDelta = tradeCollateral * leverage; // - ( tradeCollateral * leverage * 0.05);
  const convSizeDelta = sizeDelta * 10 ** 30;
  const convPrice = price * 10 ** 30;
  console.log("convSizeDelta", convSizeDelta);
  console.log("acceptable price: ", price);
  //fees

  try {
    if (daiApprove == false && posRouterPluginApprove == false) {
      let gasPrice = await web3.eth.getGasPrice();
      const maxUint256BigInt = web3.utils.toBigInt("0x" + "f".repeat(64));
      let gasEstimate = await daiContract.methods
        .approve(gmxRouterAddress, maxUint256BigInt)
        .estimateGas({ from: account.address });

      const daiTx = {
        from: account.address,
        to: daiAddress,
        gasPrice: gasPrice,
        gas: gasEstimate,
        data: daiContract.methods
          .approve(gmxRouterAddress, collateralAfterFees)
          .encodeABI(),
      };

      const daiSignature = await web3.eth.accounts.signTransaction(
        daiTx,
        privateKey
      );

      await web3.eth
        .sendSignedTransaction(daiSignature.rawTransaction)
        .on("receipt", async (receipt) => {
          gasPrice = await web3.eth.getGasPrice();
          const routerTx = {
            from: account.address,
            to: gmxRouterAddress,
            gasPrice: gasPrice,
            gas: 1000000,
            // maxFeePerGas: next_gas_price,
            data: routerContract.methods
              .approvePlugin(gmxPosRouterAddress)
              .encodeABI(),
          };

          const routerSignature = await web3.eth.accounts.signTransaction(
            routerTx,
            privateKey
          );

          await web3.eth
            .sendSignedTransaction(routerSignature.rawTransaction)
            .on("receipt", async (receipt) => {
              if (receipt.status == BigInt(1)) {
                await gasOptimize.update(
                  { gmxDaiApprove: true, gmxPositionRouterApprove: true },
                  { where: { username: username } }
                );
              }
            });
        });
    }

    const pgasPrice = await web3.eth.getGasPrice();

    const posRouterTx = {
      from: account.address,
      to: gmxPosRouterAddress,
      gasPrice: pgasPrice,
      gas: 5000000,
      value: 215000000000000,
      data: positionRouterContract.methods
        .createIncreasePosition(
          [daiAddress, indexToken],
          indexToken,
          collateralAfterFees,
          0,
          BigInt(convSizeDelta),
          isLong,
          BigInt(convPrice),
          BigInt(215000000000000),
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000"
        )
        .encodeABI(),
    };
    const posRouterSignature = await web3.eth.accounts.signTransaction(
      posRouterTx,
      privateKey
    );

    await web3.eth
      .sendSignedTransaction(posRouterSignature.rawTransaction)
      .on("receipt", async (receipt) => {
        console.log("logs: ", receipt.logs);
      });
    return { status: "success" };
  } catch (error) {
    await errorLog.create({
      error: error.message,
      event: "openTradeGMX",
      timestamp: new Date(),
    });
    console.log(error);
    return { status: "fail" };
  }
};

module.exports.openLimitGMX = async (
  privateKey,
  asset,
  collateral,
  sizeDelta,
  isLong,
  limitPrice,
  daiApprove,
  orderBookApprove,
  username
) => {
  return new Promise(async (resolve, reject) => {
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const orderBookContract = new web3.eth.Contract(
      gmxOrderBookAbi,
      gmxOrderBookAddress
    );

    const routerContract = new web3.eth.Contract(
      gmxRouterAbi,
      gmxRouterAddress
    );
    const daiContract = new web3.eth.Contract(daiAbi, daiAddress);

    const indexToken = this.getAssetFromGMXAddress(asset);

    let gasPrice;

    try {
      if (daiApprove == false && orderBookApprove == false) {
        gasPrice = await web3.eth.getGasPrice();
        const maxUint256BigInt = web3.utils.toBigInt("0x" + "f".repeat(64));
        const gasEstimateApprove = await daiContract.methods
          .approve(gmxRouterAddress, maxUint256BigInt)
          .estimateGas({ from: account.address });

        const daiTx = {
          from: account.address,
          to: daiAddress,
          gasPrice: gasPrice,
          gas: gasEstimateApprove,
          data: daiContract.methods
            .approve(gmxRouterAddress, maxUint256BigInt)
            .encodeABI(),
        };

        const daiSignature = await web3.eth.accounts.signTransaction(
          daiTx,
          privateKey
        );

        await web3.eth
          .sendSignedTransaction(daiSignature.rawTransaction)
          .on("receipt", async (receipt) => {
            gasPrice = await web3.eth.getGasPrice();

            const routerTx = {
              from: account.address,
              to: gmxRouterAddress,
              gasPrice: gasPrice,
              gas: 1000000,
              data: routerContract.methods
                .approvePlugin(gmxOrderBookAddress)
                .encodeABI(),
            };

            const routerSignature = await web3.eth.accounts.signTransaction(
              routerTx,
              privateKey
            );

            await web3.eth
              .sendSignedTransaction(routerSignature.rawTransaction)
              .on("receipt", (receipt) => {
                console.log("approve plugin orderbook succesfull");
              });
          });
      } else if (daiApprove == true && orderBookApprove == false) {
        gasPrice = await web3.eth.getGasPrice();
        const maxUint256BigInt = web3.utils.toBigInt("0x" + "f".repeat(64));
        const gasEstimateApprove = await daiContract.methods
          .approve(gmxRouterAddress, maxUint256BigInt)
          .estimateGas({ from: account.address });

        const daiTx = {
          from: account.address,
          to: daiAddress,
          gasPrice: gasPrice,
          gas: gasEstimateApprove,
          data: daiContract.methods
            .approve(gmxRouterAddress, maxUint256BigInt)
            .encodeABI(),
        };

        const daiSignature = await web3.eth.accounts.signTransaction(
          daiTx,
          privateKey
        );

        await web3.eth
          .sendSignedTransaction(daiSignature.rawTransaction)
          .on("receipt", (receipt) => {
            console.log(receipt.transactionHash);
          });
      } else if (daiApprove == false && orderBookApprove == true) {
        gasPrice = await web3.eth.getGasPrice();

        const routerTx = {
          from: account.address,
          to: gmxRouterAddress,
          gasPrice: gasPrice,
          gas: 1000000,
          data: routerContract.methods
            .approvePlugin(gmxOrderBookAddress)
            .encodeABI(),
        };

        const routerSignature = await web3.eth.accounts.signTransaction(
          routerTx,
          privateKey
        );

        await web3.eth
          .sendSignedTransaction(routerSignature.rawTransaction)
          .on("receipt", (receipt) => {
            console.log(receipt.transactionHash);
          });
      }
      gasPrice = await web3.eth.getGasPrice();

      const tx = {
        from: account.address,
        to: gmxOrderBookAddress,
        gasPrice: gasPrice,
        gas: 3000000,
        value: 300000000000000,
        data: orderBookContract.methods
          .createIncreaseOrder(
            [daiAddress],
            collateral,
            indexToken,
            0,
            sizeDelta,
            indexToken,
            isLong,
            limitPrice,
            false, // triggerAboveThreshold
            BigInt(300000000000000),
            false // _shouldWrap
          )
          .encodeABI(),
      };

      const orderBookSignature = await web3.eth.accounts.signTransaction(
        tx,
        privateKey
      );

      await web3.eth
        .sendSignedTransaction(orderBookSignature.rawTransaction)
        .on("receipt", (receipt) => {
          const tradeLogs = receipt.logs;
          var i = 0;
          while (i < tradeLogs.length) {
            if (
              tradeLogs[i].address ==
              "0x09f77e8a13de9a35a7231028187e9fd5db8a2acb"
            ) {
              const data = tradeLogs[i].data;
              const sizeDelta = parseFloat(data.sizeDelta / 10 ** 30);
              const orderIndex = parseInt(data.orderIndex);

              const limitOrderData = {
                sizeDelta: sizeDelta,
                orderIndex: orderIndex,
                isLong: data.isLong,
              };

              resolve(limitOrderData);
            }

            i++;
          }
        });
    } catch (error) {
      await errorLog.create({
        error: error.message,
        event: "openLimitGMX",
        address: account.address,
        timestamp: new Date(),
      });
      console.log(error.message);
      reject(error.message);
    }
  });
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
  const convPrice = price * 10 ** 30;
  const convSizeDelta = sizeDelta * 10 ** 30;

  try {
    const gasPrice = await web3.eth.getGasPrice();

    const tx = {
      from: account.address,
      to: gmxPosRouterAddress,
      gasPrice: gasPrice,
      gas: 5000000,
      value: 215000000000000,
      data: positionRouterContract.methods
        .createDecreasePosition(
          [indexToken],
          indexToken,
          0,
          BigInt(convSizeDelta),
          isLong,
          receiver,
          BigInt(convPrice),
          0,
          BigInt(215000000000000),
          false,
          "0x0000000000000000000000000000000000000000"
        )
        .encodeABI(),
    };

    const posRouterSignature = await web3.eth.accounts.signTransaction(
      tx,
      privateKey
    );

    await web3.eth
      .sendSignedTransaction(posRouterSignature.rawTransaction)
      .on("receipt", (receipt) => {});
    return { status: "success" };
  } catch (error) {
    await errorLog.create({
      error: error.message,
      event: "closeTradeGMX",
      timestamp: new Date(),
    });
    console.log(error);
    return { status: "fail" };
  }
};
