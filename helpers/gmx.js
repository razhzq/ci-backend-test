require("dotenv").config();
const { Sequelize } = require("sequelize");
const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: "postgres", // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
});
const path = require("path");
const fs = require("fs");
const { Web3 } = require("web3");
const providerUrl = process.env.ARBITRUM_HTTP;
const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));

const gmxabiPath = path.resolve(__dirname, "../contractABI/GMXRouter.json");
const gmxrawData = fs.readFileSync(gmxabiPath);
const gmxRouterAbi = JSON.parse(gmxrawData);
const gmxRouterAddress = "";

const gmxPosabiPath = path.resolve(
  __dirname,
  "../contractABI/GMXPositionRouter.json"
);
const gmxPosrawData = fs.readFileSync(gmxPosabiPath);
const gmxPosRouterAbi = JSON.parse(gmxPosrawData);
const gmxPosRouterAddress = "";

const daiAbiPath = path.resolve(__dirname, "../contractABI/DAIcontract.json");
const daiRawData = fs.readFileSync(daiAbiPath);
const daiAbi = JSON.parse(daiRawData);
const daiAddress = "";

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

  const routerContract = new web3.eth.Contract(gmxRouterAbi, gmxRouterAddress);
  const positionRouterContract = new web3.eth.Contract(
    gmxPosRouterAbi,
    gmxPosRouterAddress
  );
  const daiContract = new web3.eth.Contract(daiAbi, daiAddress);

  const collateralConv = await web3.utils.toWei(
    collateralAmount.toString(),
    "ether"
  );
  const sizeDelta = collateralAmount * leverage * 10 ** 30;

  try {
    await daiContract.methods
      .approve(gmxPosRouterAddress, collateralConv)
      .send({
        from: account,
        gasLimit: "5000000",
        transactionBlockTimeout: 200,
      })
      .on("transactionHash", (hash) => {
        routerContract.methods
          .approvePlugin(gmxPosRouterAddress)
          .send({
            from: account,
            gasLimit: "5000000",
            transactionBlockTimeout: 200,
          })
          .on("transactionHash", (hash) => {
            positionRouterContract.methods.createIncreasePosition(
              [daiAddress],
              indexToken,
              collateralConv,
              0,
              BigInt(sizeDelta),
              isLong,
              price,
              BigInt(180000000000000), //execution fees minimum
              "0x0000000000000000000000000000000000000000000000000000000000000000",
              "0x0000000000000000000000000000000000000000"
            );
          })
          .send({
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
      });
  } catch (error) {
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
      )
      .on("receipt", (receipt) => {
        if (receipt.status == true) {
          return "success";
        } else {
          return "fail";
        }
      });
  } catch (error) {
    console.log(error);
  }
};
