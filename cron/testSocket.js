require('dotenv').config({ path: "../.env" })

const {Sequelize} = require('sequelize');
const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: 'postgres', // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  })
const io = require('socket.io-client');

const gnsLimitOrder = require("../database/gnsLimitOrder.model")(sequelize, Sequelize);
const socket = io('http://localhost:8080');





async function test() {
    
    for(let i =0; i < 100; i++) {
        if(i == 20) {

            await gnsLimitOrder.create({
                asset: 'BTC/USD',
                price: 1200.23,
                collateral: 1000,
                delta: 1000,
                tradeIndex: 0,
                isLong: true,
                leverage: 5,
                network: 'arbitrum',
                username: 'ahhsdsd'
            })

            const order = await gnsLimitOrder.findAll();
            console.log(order[order.length - 1])
            socket.emit('tradeActive', order[order.length - 1]);
        }
    }
}

test()