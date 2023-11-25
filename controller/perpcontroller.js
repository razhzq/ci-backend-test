
require('dotenv').config({ path: "../.env" })
const {Sequelize} = require('sequelize');
const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: 'postgres', // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  })
const { openTradeGNS, getGnsPairPrice, closeTradeGNS } = require('../helpers/gns');
const {Web3, net} = require('web3')
const gnsPair = require('../database/gnsPair.model')(sequelize, Sequelize)
const gnsMarketOrder = require('../database/gnsMarketOrder.model')(sequelize, Sequelize);
const gnsLimitOrder = require("../database/gnsLimitOrder.model")(sequelize, Sequelize);
const gmxMarketOrder = require('../database/gmxMarketOrder.model')(sequelize, Sequelize);
const gmxLimitOrder = require('../database/gmxLimitOrder.model')(sequelize, Sequelize);
const userWallet = require('../database/userWallet.model')(sequelize, Sequelize);
const userData = require('../database/userData.model')(sequelize, Sequelize);
const multiplier = require('../database/multiplier.model')(sequelize, Sequelize);
//decryption
const { getAssetFromGMXAddress, createPositionGMX, getPairPriceGMX, closePositionGMX } = require('../helpers/gmx');
const { decryptor } = require('../helpers/decypter');






module.exports.OpenMarketGNS = async (req, res) => {
    const {collateral, leverage, asset, tp, sl, network, isLong,  userAddress, orderType, limitPrice} = req.body;

    let tradeIndex;
    let tradeTotal;

    const pair = await gnsPair.findOne({where: {pairName: asset}});
    const wallet = await userWallet.findOne({ where: { publicKey: userAddress}});
    const multiply = await multiplier.findAll();

    const privateKey = decryptor(wallet.privateKey);
    const positionSize = Web3.utils.toWei(collateral.toString(), 'ether');
    const price = await getGnsPairPrice(asset);
    const spreadPrice = price * 1.0005;
    const convPrice = Web3.utils.toWei(spreadPrice.toString(), 'ether');
    const bananaPoints = ((collateral * leverage) / 100) * multiply[0].pointsMultiplier ;

    const convLimitPrice = Web3.utils.toWei(limitPrice.toString(), 'ether');

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
       
        if(orderType == 0) {
             // const orderId = await openTradeGNS(privateKey, network, pair.pairId, positionSize, convPrice, isLong, leverage, tp, sl, orderType);
            await gnsMarketOrder.create({
                asset: asset,
                trade_status: 0,
                price: spreadPrice,
                collateral: collateral,
                delta: 0,
                tradeIndex: tradeIndex,
                orderId: 0,  // change to orderId when back to production
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
            // const tradeIndex = await openTradeGNS(privateKey, network, pair.pairId, positionSize, convLimitPrice, isLong, leverage, tp, sl, orderType);
            await gnsLimitOrder.create({
                asset: asset,
                price: limitPrice,
                collateral: collateral,
                delta: 0,
                tradeIndex: 0, // tradeIndex,
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
        console.error(error);
        res.status(400).json({
            trade_status: error
        })
    }
}


module.exports.closeMarketOrderGNS = async (req, res) => {
     const { asset, tradeIndex, userAddress, network} = req.body;

     const pair = await gnsPair.findOne({where: {pairName: asset}});
     
     const wallet = await userWallet.findOne({ where: { publicKey: userAddress}});
     const privateKey = decryptor(wallet.privateKey);

     try {

    //  const status = await closeTradeGNS(privateKey, pair.pairId, tradeIndex, network);

    const status = 'success';

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

    const multiply = await multiplier.findAll()

    const indexToken = getAssetFromGMXAddress(asset);
    const sizeDelta = collateral * leverage;
    const bananaPoints = (sizeDelta / 100) * multiply[0].pointsMultiplier ;

    const wallet = await userWallet.findOne({where: {publicKey: userAddress}});
    const privateKey = decryptor(wallet.privateKey);

    const price = await getPairPriceGMX(asset);


    try {
        // const status = await createPositionGMX(privateKey, indexToken, collateral, isLong, price, leverage);
        const status = 'success';
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
    const {userAddress, asset, collateral, leverage, isLong, limitPrice} = req.body;
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
            price: limitPrice,
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
       const { asset, collateral, isLong, sizeDelta, userAddress} = req.body;

       const wallet = await userWallet.findOne({where: {publicKey: userAddress }})
       const privateKey = decryptor(wallet.privateKey);

       const price = await getPairPriceGMX(asset);
     
       try {
        //    const status = await closePositionGMX(privateKey, asset, collateral, sizeDelta, isLong, wallet.publicKey, price );
        const status = 'success';
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


module.exports.aggregator = async (req, res) => {
    const { asset, isLong } = req.body;

    const gmxPrice = await getPairPriceGMX(asset);
    const gnsPrice = await getGnsPairPrice(asset);

    if(isLong == 'long') {
        if(gmxPrice > gnsPrice) {
             res.status(200).json({
                best: 'gns'
             })
        } else {
            res.status(200).json({
                best: 'gmx'
             })
        }
    } else {
        if(gmxPrice > gnsPrice) {
            res.status(200).json({
               best: 'gmx'
            })
       } else {
           res.status(200).json({
               best: 'gns'
            })
       }
    }

}

module.exports.aggregatorUser = async (req, res) => {
    const { asset, isLong, platform } = req.body;

    let priceArray;
    
    try {
       for(let i = 0; i < platform.length; i++) {
          if(platform[i] == 'gmx') {
            const gmxPrice = await getPairPriceGMX(asset);
            priceArray.push({price: gmxPrice, platform: 'gmx'});
          } else if (platform[i] == 'gns') {
            const gnsPrice = await getGnsPairPrice(asset);
            priceArray.push({price: gnsPrice, platform: 'gns'});
          }
       }

       priceArray.sort((a, b) => a.price - b.price);  // lowest to highest

       if(isLong == true) {
          res.status(200).json({
            best: priceArray[0].platform  
          })
       } else {
        res.status(200).json({
            best: priceArray[priceArray.length - 1].platform  
          })
       }



        
    } catch (error) {
        res.status(400).json('Error getting price');
    }
}



