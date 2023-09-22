require('dotenv').config()
const {Sequelize} = require('sequelize');
const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: 'postgres', // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  })
const providerUrl = process.env.ETH_URL;
const User = require('../database/user.model')(sequelize, Sequelize);
const UserWallet = require('../database/userWallet.model')(sequelize, Sequelize);
const bcrypt = require('bcrypt');
const {Web3} = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));

const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
const key = process.env.KEY;
const iv = process.env.IV_KEY;

const cipher = crypto.createCipheriv(algorithm, key, iv);





module.exports.createUser = async (req, res) => {
    const { username, password } = req.body;

    try {
        const saltRounds = 10;
        const hashPassword = await bcrypt.hash(password, saltRounds);

        const newAccount = await web3.eth.accounts.create();
        let encryptedKey = cipher.update(newAccount.privateKey, 'utf-8', 'hex');
        encryptedKey += cipher.final('hex');

        User.create({
            username: username,
            password: hashPassword
        })

        UserWallet.create({
            publicKey: newAccount.address,
            privateKey: encryptedKey,
            walletOwner: username
        })

        res.status(200).json(`User ${username} created successfully`);

    } catch (error) {
        res.status(400).json({
            error: error
        })
    }
}