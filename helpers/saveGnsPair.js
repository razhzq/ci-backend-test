require("dotenv").config({ path: "../.env" });
const path = require("path");
const fs = require("fs");
const {Web3} = require('web3');


const gnsabiPath = path.resolve(__dirname, "../contractABI/GNSPairStorage.json");
const gnsrawData = fs.readFileSync(gnsabiPath);
const pairStorageAbi = JSON.parse(gnsrawData);

const providerUrl = process.env.ARBITRUM_HTTP;
const polygonProvider = process.env.POLYGON_HTTP;
const web3Polygon = new Web3(new Web3.providers.HttpProvider(polygonProvider))
const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));

const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize(process.env.DB_URL);
const gnsPair = require('../database/gnsPair.model')(sequelize, DataTypes);

const pairMap = [
    'BTC/USD',
    'ETH/USD',
    'LINK/USD', 
    'DOGE/USD',
    'MATIC/USD',
    'ADA/USD',
    'SUSHI/USD',
    'AAVE/USD',
    'ALGO/USD',
    'BAT/USD',
    'COMP/USD', 
    'DOT/USD', 
    'EOS/USD', 
    'LTC/USD', 
    'MANA/USD', 
    'OMG/USD', 
    'SNX/USD', 
    'UNI/USD', 
    'XLM/USD', 
    'XRP/USD', 
    'ZEC/USD', 
    'EUR/USD', 
    'USD/JPY', 
    'GBP/USD', 
    'USD/CHF', 
    'AUD/USD', 
    'USD/CAD', 
    'NZD/USD', 
    'EUR/CHF', 
    'EUR/JPY', 
    'EUR/GBP', 
    'LUNA/USD',
    'YFI/USD', 
    'SOL/USD', 
    'XTZ/USD', 
    'BCH/USD', 
    'BNT/USD', 
    'CRV/USD', 
    'DASH/USD',
    'ETC/USD', 
    'ICP/USD', 
    'MKR/USD', 
    'NEO/USD', 
    'THETA/USD',
    'TRX/USD', 
    'ZRX/USD', 
    'SAND/USD',
    'BNB/USD', 
    'AXS/USD', 
    'GRT/USD', 
    'HBAR/USD',
    'XMR/USD', 
    'ENJ/USD', 
    'FTM/USD', 
    'FTT/USD',
    'APE/USD',
    'CHZ/USD',
    'SHIB/USD', ]




const saveGNSPairContract = async () => {

    const storage = new web3.eth.Contract(pairStorageAbi, "0xf67Df2a4339eC1591615d94599081Dd037960d4b")
    const polyStorage = new web3Polygon.eth.Contract(pairStorageAbi, "0x6e5326e944F528c243B9Ca5d14fe5C9269a8c922")


    for(let i =0; i < 110; i++) {
        const pair = await storage.methods.pairFeed(i).call()
        const pairContract = pair['0']

        if(pairContract == "0x6ce185860a4963106506C203335A2910413708e9" && i > 0) {
            const pairPoly = await polyStorage.methods.pairFeed(i).call()
            const pairContractPoly = pairPoly['0']
            
            if(pairContractPoly == "0xc907E116054Ad103354f2D350FD2514433D57F6f") {
                gnsPair.create({
                    pairId: i,
                    contractAddress: null,
                    pairName: pairMap[i],
                    network: 'polygon'
                }) 

            }
            else {
                gnsPair.create({
                    pairId: i,
                    contractAddress: pairContractPoly,
                    pairName: pairMap[i],
                    network: 'polygon'
                }) 
            }

            
        } else {
            gnsPair.create({
                pairId: i,
                contractAddress: pairContract,
                pairName: pairMap[i],
                network: 'arbitrum'
            })
        }
         
    }

   
}

saveGNSPairContract()