
require('dotenv').config()
const {Sequelize} = require('sequelize');
const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: 'postgres', // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  })
const { openTradeGNS, getGnsPairPrice, closeTradeGNS } = require('../helpers/gns');
const {Web3, net} = require('web3')
const gnsPair = require('../database/gnsPair.model')(sequelize, Sequelize)
const gnsMarketOrder = require('../database/gnsMarketOrder.model')(sequelize)(Sequelize);
const userWallet = require('../database/userWallet.model')(sequelize, Sequelize);
//decryption
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const key = process.env.KEY;
const iv = process.env.IV_KEY;


module.exports.OpenMarketGNS = async (req, res) => {
    const {collateral, leverage, asset, tp, sl, network, isLong,  userAddress} = req.body;

    let tradeIndex;

    const pair = await gnsPair.findOne({where: {pairName: asset}});
    const wallet = await userWallet.findOne({ where: { publicKey: userAddress}});

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decryptedData = decipher.update(wallet.privateKey, 'hex', 'utf8');
    decryptedData += decipher.final('utf8');

    const positionSize = Web3.utils.toWei(collateral.toString(), 'ether');
    const price = await getGnsPairPrice(asset);
    const spreadPrice = price * 1.0005
    const convPrice = Web3.utils.toWei(spreadPrice.toString(), 'ether');

    //check tradeindex
    const tradeTotal = await gnsMarketOrder.findAll({where: {username: wallet.walletOwner, asset: asset, trade_status: 0}})

    while(tradeTotal.length == 3) {
        res.status(400).json('Max trades per pair reached!');
    }
    
    if(tradeTotal.length == 0) {
        tradeIndex = 0;
    } else {
        tradeIndex = tradeTotal.length;
    }
    

    try {
        const orderId = await openTradeGNS(decryptedData, network, pair.pairId, positionSize, convPrice, isLong, leverage, tp, sl);

        await gnsMarketOrder.create({
            asset: asset,
            trade_status: 0,
            price: spreadPrice,
            collateral: collateral,
            delta: 0,
            tradeIndex: tradeIndex,
            orderId: orderId,
            isLong: isLong,
            leverage: leverage,
            network: network,
            username: wallet.walletOwner
        })

        res.status(200).json({
            trade_status: 'success'
        })

    } catch (error) {
        res.status(400).json({
            trade_status: error
        })
    }


    
    
}


module.exports.closeMarketOrderGNS = async (req, res) => {
     const { asset, tradeIndex, userAddress} = req.body;

     const pair = await gnsPair.findOne({where: {pairName: asset}});
     
     const wallet = await userWallet.findOne({ where: { publicKey: userAddress}});

     const decipher = crypto.createDecipheriv(algorithm, key, iv);
     let decryptedData = decipher.update(wallet.privateKey, 'hex', 'utf8');
     decryptedData += decipher.final('utf8');

     try {

     const status = await closeTradeGNS(decryptedData, pair.pairId, tradeIndex);

     if(status == 'success') {
        await gnsMarketOrder.update({trade_status: 1}, {where: { username: wallet.walletOwner, asset: asset, tradeIndex: tradeIndex}});

        res.status(200).json({
            closeOrder: 'success'
        })
     } 

    } catch(error) {
        res.status(400).json({
            closeOrder: error
        })
    }

}