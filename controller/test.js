require('dotenv').config({ path: "../.env" })
const {Sequelize} = require('sequelize');
const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: 'postgres', // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  })
const providerUrl = process.env.ETH_URL;
const adminPassword = process.env.adminPassword;
const User = require('../database/user.model')(sequelize, Sequelize);



const main = async () => {
     const users = await User.findAll();
     console.log(users)
}


main()