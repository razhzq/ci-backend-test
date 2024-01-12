require("dotenv").config({ path: "../.env" });
const path = require("path");
const fs = require("fs");
const { Web3 } = require("web3");
const puppeteer = require("puppeteer");

const gnsabiPath = path.resolve(
  __dirname,
  "../contractABI/GNSPairStorage.json"
);
const gnsrawData = fs.readFileSync(gnsabiPath);
const pairStorageAbi = JSON.parse(gnsrawData);

const providerUrl = process.env.ARBITRUM_HTTP;
const polygonProvider = process.env.POLYGON_HTTP;
const web3Polygon = new Web3(new Web3.providers.HttpProvider(polygonProvider));
const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));

const { Sequelize, DataTypes } = require("sequelize");
const sequelize = new Sequelize(process.env.DB_URL);
const gnsPair = require("../database/gnsPair.model")(sequelize, DataTypes);

const additionalPair = [
  "FIL/USD",
  "APT/USD",
  "IMX/USD",
  "VET/USD",
  "OP/USD",
  "RNDR/USD",
  "EGLD/USD",
  "TIA/USD",
  "STX/USD",
  "FLOW/USD",
  "GALA/USD",
  "MINA/USD",
  "ORDI/USD",
  "ILV/USD",
  "KLAY/USD",
  "SUI/USD",
  "BLUR/USD",
  "FET/USD",
  "CFX/USD",
  "SEI/USD",
  "WOO/USD",
  "AGIX/USD",
  "ZIL/USD",
  "GMT/USD",
  "1INCH/USD",
  "FLOKI/USD",
  "QTUM/USD",
  "WLD/USD",
  "MASK/USD",
  "CELO/USD",
  "LRC/USD",
  "ENS/USD",
  "MEME/USD",
  "ANKR/USD",
  "IOTX/USD",
  "SKL/USD",
  "SUPER/USD",
  "WTI/USD",
];

const addAdditionalPair = async () => {
  const storage = new web3.eth.Contract(
    pairStorageAbi,
    "0xf67Df2a4339eC1591615d94599081Dd037960d4b"
  );
  const polyStorage = new web3Polygon.eth.Contract(
    pairStorageAbi,
    "0x6e5326e944F528c243B9Ca5d14fe5C9269a8c922"
  );
  let j = 0;
  for (let i = 137; i < 188; i++) {
    const pair = await storage.methods.pairFeed(i).call();
    const pairContract = pair["0"];

    if (pairContract == "0x6ce185860a4963106506C203335A2910413708e9" && i > 0) {
      const pairPoly = await polyStorage.methods.pairFeed(i).call();
      const pairContractPoly = pairPoly["0"];

      if (pairContractPoly == "0xc907E116054Ad103354f2D350FD2514433D57F6f") {
        gnsPair.create({
          pairId: i,
          contractAddress: null,
          pairName: additionalPair[j],
          network: "polygon",
        });
      } else {
        gnsPair.create({
          pairId: i,
          contractAddress: pairContractPoly,
          pairName: additionalPair[j],
          network: "polygon",
        });
      }
    } else {
      gnsPair.create({
        pairId: i,
        contractAddress: pairContract,
        pairName: additionalPair[j],
        network: "arbitrum",
      });
    }
    console.log(j)
    j++;
  }
};

const getArrayGNSPair = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Navigate to the website with the table
  await page.goto(
    "https://gains-network.gitbook.io/docs-home/gtrade-leveraged-trading/pair-list"
  );

  // Wait for the table to be rendered
  await page.waitForSelector("table");

  // Extract data from the third column of the table
  const columnData = await page.evaluate(() => {
    const table = document.querySelector("table");
    const rows = table.querySelectorAll("tr");

    const columnData = [];
    rows.forEach((row) => {
      const cell = row.querySelector("td:nth-child(3)");
      if (cell) {
        columnData.push(cell.innerText.trim());
      }
    });

    return columnData;
  });

  // Print the extracted data from the third column
  console.log(columnData);

  // Close the browser
  await browser.close();

  return columnData;
};

const saveGNSPairContract = async () => {
  const storage = new web3.eth.Contract(
    pairStorageAbi,
    "0xf67Df2a4339eC1591615d94599081Dd037960d4b"
  );
  const polyStorage = new web3Polygon.eth.Contract(
    pairStorageAbi,
    "0x6e5326e944F528c243B9Ca5d14fe5C9269a8c922"
  );
  const pairMap = await getArrayGNSPair();

  for (let i = 0; i < pairMap.length; i++) {
    const pair = await storage.methods.pairFeed(i).call();
    const pairContract = pair["0"];

    if (pairContract == "0x6ce185860a4963106506C203335A2910413708e9" && i > 0) {
      const pairPoly = await polyStorage.methods.pairFeed(i).call();
      const pairContractPoly = pairPoly["0"];

      if (pairContractPoly == "0xc907E116054Ad103354f2D350FD2514433D57F6f") {
        gnsPair.create({
          pairId: i,
          contractAddress: null,
          pairName: pairMap[i],
          network: "polygon",
        });
      } else {
        gnsPair.create({
          pairId: i,
          contractAddress: pairContractPoly,
          pairName: pairMap[i],
          network: "polygon",
        });
      }
    } else {
      gnsPair.create({
        pairId: i,
        contractAddress: pairContract,
        pairName: pairMap[i],
        network: "arbitrum",
      });
    }
  }
};

console.log(additionalPair.length)
