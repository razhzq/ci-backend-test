require('dotenv').config({ path: "../.env" })
const {Sequelize} = require('sequelize');
const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: 'postgres', // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  })

const {io} = require("../index");

const userWallet = require('../database/userWallet.model')(sequelize, Sequelize);
const gnsPair = require("../database/gnsPair.model")(sequelize, Sequelize);
const gnsMarketOrder = require("../database/gnsMarketOrder.model")(sequelize, Sequelize)
const gnsLimitOrder = require("../database/gnsLimitOrder.model")(sequelize, Sequelize);
const userData = require("../database/userData.model")(sequelize, Sequelize);
const path = require("path");
const fs = require("fs");
const {Web3} = require('web3');
  
const polygonProvider = process.env.POLYGON_HTTP;
const web3Polygon = new Web3(new Web3.providers.HttpProvider(polygonProvider))
 
const gnsabiPath = path.resolve(__dirname, "../contractABI/GNSCallback.json");  
const gnsrawData = fs.readFileSync(gnsabiPath);  
const callbackAbi = JSON.parse(gnsrawData);

const callbackAddress = '0x82e59334da8C667797009BBe82473B55c7A6b311'

async function callbackGNSEvent() {

      const callbackContract = new web3Polygon.eth.Contract(callbackAbi, callbackAddress);

      callbackContract.events.LimitExecuted().on(
        'data', async(event) => {
            const eventData = event.returnValues;
            const eventTuple = eventData.t;
            const address = eventTuple.trader;
            const orderType = parseInt(eventData.orderType); //check back

            const existingUser = await userWallet.findOne({where: {publicKey: address}});

            if(existingUser) {
                if(orderType == 3) {
                    const limitIndex = parseInt(eventData.limitIndex);
                    const pairIndex = parseInt(eventData.pairIndex);
                    const pair = await gnsPair.findOne({where: {pairId: pairIndex}});

                    const limitTrade = await gnsLimitOrder.findOne({where: {username: existingUser.walletOwner, tradeIndex: limitIndex, asset: pair.pairName, network: 'polygon'}});
                    const bananaPoints = (limitTrade.collateral * limitTrade.leverage) / 100;

                    if(limitTrade) {
                        const limitTradeOpened  = {
                            username: existingUser.walletOwner,
                            asset: limitTrade.asset,
                            isLong: limitTrade.isLong,
                            collateral: limitTrade.collateral
                        }

                        await gnsMarketOrder.create({
                            asset: limitTrade.asset,
                            trade_status: 0,
                            price: limitTrade.price,
                            collateral: limitTrade.collateral,
                            delta: 0,
                            tradeIndex: 0,
                            orderId: eventData.orderId,
                            isLong: limitTrade.isLong,
                            leverage: limitTrade.leverage,
                            network: 'polygon',
                            username: existingUser.walletOwner
                        })

                        await userData.update({points: bananaPoints}, {where: { username: existingUser.walletOwner}});
                        await gnsLimitOrder.destroy({where: {id: limitTrade.id}});

                        io.emit('tradeActive', limitTradeOpened);
                    }
                } else {
                    const orderId = eventData.orderId;
                    
                    const trade = await gnsMarketOrder.findOne({where: {orderId: orderId, username: existingUser.walletOwner}});

                    if(trade) {
                        await gnsMarketOrder.update({trade_status: 1}, {where: {id: trade.id}});
                    }
                }
            }
        }
      )
}


callbackGNSEvent()