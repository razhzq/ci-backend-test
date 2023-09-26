
require('dotenv').config()
const {Sequelize} = require('sequelize');
const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: 'postgres', // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  })
const { openTradeGNS, getGnsPairPrice, closeTradeGNS } = require('../helpers/gns');
const {Web3, net} = require('web3')
const gnsPair = require('../database/gnsPair.model')(sequelize, Sequelize)
const gnsMarketOrder = require('../database/gnsMarketOrder.model')(sequelize, Sequelize);
const gnsLimitOrder = require("../database/gnsLimitOrder.model")(sequelize, Sequelize);
const gmxMarketOrder = require('../database/gnsMarketOrder.model')(sequelize, Sequelize);
const gmxLimitOrder = require('../database/gmxLimitOrder.model')(sequelize, Sequelize);
const userWallet = require('../database/userWallet.model')(sequelize, Sequelize);
const userData = require('../database/userData.model')(sequelize, Sequelize);
//decryption
const { getAssetFromGMXAddress, createPositionGMX, getPairPriceGMX, closePositionGMX } = require('../helpers/gmx');
const { decryptor } = require('../helpers/decypter');



module.exports.OpenMarketGNS = async (req, res) => {
    const {collateral, leverage, asset, tp, sl, network, isLong,  userAddress, orderType} = req.body;

    let tradeIndex;
    let tradeTotal;

    const pair = await gnsPair.findOne({where: {pairName: asset}});
    const wallet = await userWallet.findOne({ where: { publicKey: userAddress}});

    const privateKey = decryptor(wallet.privateKey);
    const positionSize = Web3.utils.toWei(collateral.toString(), 'ether');
    const price = await getGnsPairPrice(asset);
    const spreadPrice = price * 1.0005;
    const convPrice = Web3.utils.toWei(spreadPrice.toString(), 'ether');
    const bananaPoints = (collateral * leverage) / 100;

    //check tradeindex
    if(orderType == 0) {
        tradeTotal = await gnsMarketOrder.findAll({where: {username: wallet.walletOwner, asset: asset, trade_status: 0}})
    } else {
        tradeTotal = await gnsLimitOrder.findAll({where: {username: wallet.walletOwner, asset: asset}})
    }
    

    while(tradeTotal.length == 3) {
        res.status(400).json('Max trades per pair reached!');
    }
    
    if(tradeTotal.length == 0) {
        tradeIndex = 0;
    } else {
        tradeIndex = tradeTotal.length;
    }
    

    try {
        const orderId = await openTradeGNS(privateKey, network, pair.pairId, positionSize, convPrice, isLong, leverage, tp, sl, orderType);
        if(orderType == 0) {
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
    
            await userData.update({points: bananaPoints}, {where: {username: wallet.walletOwner}});
    
            res.status(200).json({
                trade_status: 'success'
            })
        } else {
            await gnsLimitOrder.create({
                asset: asset,
                price: spreadPrice,
                collateral: collateral,
                delta: 0,
                tradeIndex: orderId,
                isLong: isLong,
                leverage: leverage,
                network: network,
                username: wallet.walletOwner
            })
            res.status(200).json({
                trade_status: 'success'
            })
        }

        

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
     const privateKey = decryptor(wallet.privateKey);

     try {

     const status = await closeTradeGNS(privateKey, pair.pairId, tradeIndex);

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


module.exports.openMarketGMX = async (req, res) => {
    const {userAddress, asset, collateral, leverage, isLong} = req.body;

    const indexToken = getAssetFromGMXAddress(asset);
    const sizeDelta = collateral * leverage;
    const bananaPoints = sizeDelta / 100;

    const wallet = await userWallet.findOne({where: {publicKey: userAddress}});
    const privateKey = decryptor(wallet.privateKey);

    const price = await getPairPriceGMX(asset);


    try {
        const status = await createPositionGMX(privateKey, indexToken, collateral, isLong, price, leverage);
        if(status == 'success') {
            await gmxMarketOrder.create({
               asset: asset,
               trade_status: 0,
               indexToken: indexToken,
               delta: 0,
               collateral: collateral,
               sizeDelta: sizeDelta,
               isLong: isLong,
               price: price,
               username: wallet.walletOwner
            })

            await userData.update({points: bananaPoints}, {where: {username: wallet.walletOwner}});
            res.status(200).json({
                status: 'success'
            })
        } else {
            res.status(200).json({
                status: 'fail'
            })
        }

    } catch (error) {
       res.status(400).json({
         error: error
       })
    }


}


module.exports.openLimitGMX = async (req, res) => {
    const {userAddress, asset, collateral, leverage, isLong} = req.body;
    const indexToken = getAssetFromGMXAddress(asset);
    const sizeDelta = collateral * leverage;

    const price = await getPairPriceGMX(asset);
    const wallet = await userWallet.findOne({where: {publicKey: userAddress}});

    try {
        await gmxLimitOrder.create({
            asset: asset,
            indexToken: indexToken,
            collateral: collateral,
            sizeDelta: sizeDelta,
            isLong: isLong,
            leverage: leverage,
            price: price,
            username: wallet.walletOwner
        })
        res.status(200).json({
            status: 'success'
        })

    } catch (error) {
        res.status(400).json({
            error: error
        })

    }
}


module.exports.closeMarketGMX = async (req, res) => {
       const { asset, collateral, isLong, leverage, userAddress} = req.body;

       const wallet = await userWallet.findOne({where: {publicKey: userAddress }})
       const privateKey = decryptor(wallet.privateKey);
       const sizeDelta = collateral * leverage;

       const price = await getPairPriceGMX(asset);
     
       try {
           const status = await closePositionGMX(privateKey, asset, collateral, sizeDelta, isLong, wallet.publicKey, price );
           if(status == 'success') {
            await gmxMarketOrder.update({trade_status: 1}, {where: {asset: asset, isLong: isLong, collateral: collateral, username: wallet.walletOwner}})
            res.status(200).json({
                status: 'success'
            })
        } else {
            res.status(200).json({
                status: 'fail'
            })
        }
       } catch (error) {
        res.status(400).json({
            error: error
          })
       }
}



