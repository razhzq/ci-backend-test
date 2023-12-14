require("dotenv").config({ path: "../.env" });

const path = require("path");
const fs = require("fs");
const { Web3 } = require("web3");
const { getPairPriceGMX } = require("./gmx");


const providerUrl = process.env.ARBITRUM_HTTP;
const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));

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

const privKey = Buffer.from(process.env.TEST_WALLET, 'hex')


async function main() {

    try {
    const account = web3.eth.accounts.privateKeyToAccount(privKey);
    console.log('address: ', account.address)

    const positionRouterContract = new web3.eth.Contract(
        gmxPosRouterAbi,
        gmxPosRouterAddress
      );

    const collateralAfterFees = web3.utils.toWei(
        "10",
        "ether"
      );
    const leverage = 40;

    const indexToken = '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f';
    const currentPrice = await getPairPriceGMX("BTC/USD");
    const convPrice = parseFloat(currentPrice) / 10 ** 30
    const slippPrice = convPrice + (convPrice * 0.008);
    const slippagePrice = slippPrice * 10 ** 30;
    console.log(slippPrice)

    const sizeDelta = 10 * 50 * 10 ** 30;


    const gasPrice = await web3.eth.getGasPrice();
    console.log(gasPrice);
    // const gasEstimate = await positionRouterContract.methods.createIncreasePosition(
    //   [daiAddress, indexToken],
    //   indexToken,
    //   collateralAfterFees,
    //   0,
    //   BigInt(sizeDelta),
    //   true,
    //   BigInt(slippagePrice),
    //   BigInt(215000000000000),
    //   "0x0000000000000000000000000000000000000000000000000000000000000000",
    //   "0x0000000000000000000000000000000000000000"
    // ).estimateGas({from: account.address});

    console.log('collateral: ',collateralAfterFees)
    console.log(sizeDelta)
    console.log(slippagePrice);

    const posRouterTx = {
      from: account.address,
      to: gmxPosRouterAddress,
      gasPrice:  gasPrice,
      gas: 5000000,
      value: 215000000000000,
      data: positionRouterContract.methods
        .createIncreasePosition(
          [daiAddress, indexToken],
          indexToken,
          collateralAfterFees,
          0,
          BigInt(sizeDelta),
          true,
          BigInt(slippagePrice),
          BigInt(215000000000000),
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000"
        )
        .encodeABI(),
    };

    const signature = await web3.eth.accounts.signTransaction(
      posRouterTx,
      privKey
    );

    await web3.eth
              .sendSignedTransaction(signature.rawTransaction)
              .on("receipt", (receipt) => {
                console.log(receipt)
              });
            } catch (error) {
              console.log(error)
            }

    
}

main()