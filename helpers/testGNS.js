require("dotenv").config({ path: "../.env" });
const path = require("path");
const fs = require("fs");
const { Web3 } = require("web3");
const { getGnsPairPrice } = require("./gns");

const polygonProvider = process.env.POLYGON_HTTP;
const web3Polygon = new Web3(new Web3.providers.HttpProvider(polygonProvider));

const gnsTradingabiPath = path.resolve(
  __dirname,
  "../contractABI/GNSTradingContract.json"
);
const gnsTradingrawData = fs.readFileSync(gnsTradingabiPath);
const tradingContractAbi = JSON.parse(gnsTradingrawData);

const tradingContractPolyAddress = "0xb0901FEaD3112f6CaF9353ec5c36DC3DdE111F61";
const tradingStoragePolyAddress = "0xaee4d11a16B2bc65EDD6416Fb626EB404a6D65BD";

const daiAbiPath = path.resolve(__dirname, "../contractABI/DAIcontract.json");
const daiRawData = fs.readFileSync(daiAbiPath);
const daiAbi = JSON.parse(daiRawData);
const daiAddressArbitrum = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
const daiAddressPolygon = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";

const privKey = Buffer.from(process.env.TEST_WALLET, "hex");

async function main() {
    return new Promise(async (resolve, reject) => {
      const account = web3Polygon.eth.accounts.privateKeyToAccount(privKey);
      const tradingContract = new web3Polygon.eth.Contract(
        tradingContractAbi,
        tradingContractPolyAddress
      );
      const daiContract = new web3Polygon.eth.Contract(daiAbi, daiAddressPolygon);
      const tradingStorage = tradingStoragePolyAddress;
  
      const collateral = 11;
      const tradeCollateral = Math.floor(collateral * 0.99);
  
      const positionSizeAfterFees = web3Polygon.utils.toWei(
        tradeCollateral.toString(),
        "ether"
      );
  
      let finalOrderId;
  
      try {
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
          privKey
        );
  
        await web3Polygon.eth
          .sendSignedTransaction(daiApproveSignature.rawTransaction)
          .on("receipt", async (receipt) => {
            const price = await getGnsPairPrice("BTC/USD");
            const spreadPrice = price * 1.0005;
            const convPrice = BigInt(parseInt(spreadPrice) * 10 ** 10);
  
            const takeProfit =
              spreadPrice + 0.01 * spreadPrice * (50 / 150);
            const convTp = takeProfit.toFixed(2);
            const convTpDecimal = BigInt(Math.floor(convTp * 10 ** 10));
  
            console.log("position size: ", positionSizeAfterFees);
            console.log("address: ", account.address);
            console.log("open price: ", convPrice);
            console.log("tp price: ", convTpDecimal);
  
            const tradeTuple = {
              trader: account.address,
              pairIndex: 0, // pairIndex
              index: 0, // index
              initialPosToken: 0, // 0
              positionSizeDai: positionSizeAfterFees,
              openPrice: convPrice,
              buy: true,
              leverage: 150,
              tp: convTpDecimal,
              sl: 0,
            };
            const tgasPrice = await web3Polygon.eth.getGasPrice();
  
            const tradeTx = {
              from: account.address,
              to: tradingContractPolyAddress,
              gasPrice: tgasPrice,
              gas: 3000000,
              data: tradingContract.methods
                .openTrade(
                  tradeTuple,
                  0,
                  3000000000,
                  "0x0000000000000000000000000000000000000000"
                )
                .encodeABI(),
            };
  
            const tradeSignature = await web3Polygon.eth.accounts.signTransaction(
              tradeTx,
              privKey
            );
  
            await web3Polygon.eth
              .sendSignedTransaction(tradeSignature.rawTransaction)
              .on("receipt", async (receipt) => {
                const tradeLogs = receipt.logs;
                console.log("logs length: ", tradeLogs.length);
  
                for (let i = 0; i < tradeLogs.length; i++) {
                  if (
                    tradeLogs[i].address ==
                    "0xb0901fead3112f6caf9353ec5c36dc3dde111f61"
                  ) {
                    console.log(tradeLogs[i]);
                    const topics = tradeLogs[i].topics;
                    const orderId = topics[1];
                    const convOrderId = web3Polygon.utils.hexToNumber(orderId);
                    console.log("orderId: ", convOrderId);
                    finalOrderId = convOrderId;
                  }
                }
  
                // Resolve the promise with the finalOrderId
                resolve(finalOrderId);
              });
          });
      } catch (error) {
        // Reject the promise if there's an error
        
        reject(error);
      }
    });
  }

async function test() {
    const orderId = await main();
    console.log('test orderid: ', orderId);
}


test()
