require('dotenv').config()
const {Sequelize} = require('sequelize');
const { getGnsPairPrice } = require('../helpers/gns');
const { getPairPriceGMX } = require('../helpers/gmx');
const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: 'postgres', // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
    logging: false
  })

  var cron = require('node-cron');

const gnsMarketOrder = require("../database/gmxMarketOrder.model")(sequelize, Sequelize);
const gmxMarketOrder = require("../database/gmxMarketOrder.model")(sequelize, Sequelize);


async function calculateDeltaGNS() {
    try {
            const trades = await gnsMarketOrder.findAll({where: {trade_status: 0}});

            for(let i=0; i < trades.length; i++) {
                 const currentPrice = await getGnsPairPrice(trades[i].asset);
                 const collateral = trades[i].collateral;
                 const openPrice = trades[i].price;
                 const leverage = trades[i].leverage;
                 const delta = ((currentPrice - openPrice) / openPrice) * (collateral * leverage);

                 gnsMarketOrder.update({delta: delta}, {where: {id: trades[i].id}});
            }            
    } catch (error) {
        console.log(error)
    }
      
}

async function calculateDeltaGMX() {
    try {
        const trades = await gmxMarketOrder.findAll({where: {trade_status: 0}});
        for(let i=0; i< trades.length; i++) {
            const currentPrice = await getPairPriceGMX(trades[i].asset);
            const convCurrentPrice = BigInt(currentPrice) / BigInt(10 ** 30);
            const currPrice = parseFloat(convCurrentPrice);
            const openPrice = trades[i].price;
            const delta = (currPrice - openPrice) * (trades[i].sizeDelta / openPrice);
            gmxMarketOrder.update({delta: delta}, {where: {id: trades[i].id}});

        }

    } catch(error) {
        console.log(error)
    }
}





module.exports = {calculateDeltaGMX, calculateDeltaGNS};