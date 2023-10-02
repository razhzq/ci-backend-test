require('dotenv').config({ path: "../.env" })
const {Sequelize} = require('sequelize');
const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: 'postgres', // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  })



const {getGnsPairPrice} = require('../helpers/gns');
const {getPairPriceGMX} = require('../helpers/gmx');



module.exports.getPriceGNS = async (req, res) => {
    const {asset} = req.body;

    try {
        const price = await getGnsPairPrice(asset);
        res.status(200).json({
            price: price
        })
    } catch(error) {
        res.status(400).json({
            error: error
        })
    }
}


module.exports.getPriceGMX = async (req, res) => {
    const {asset} = req.body;

    try {
        const price = await getPairPriceGMX(asset);
        const convPrice = price / 10 ** 30;
        res.status(200).json({
            price: convPrice
        })


    } catch (error) {
        res.status(400).json({
            error: error
        })
    }
}


