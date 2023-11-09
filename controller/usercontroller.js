require('dotenv').config({ path: "../.env" })
const {Sequelize} = require('sequelize');
const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: 'postgres', // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  })
const providerUrl = process.env.ETH_URL;
const adminPassword = process.env.adminPassword;
const User = require('../database/user.model')(sequelize, Sequelize);
const gnsMarketOrder = require('../database/gnsMarketOrder.model')(sequelize, Sequelize);
const gmxMarketOrder = require('../database/gmxMarketOrder.model')(sequelize, Sequelize);
const UserWallet = require('../database/userWallet.model')(sequelize, Sequelize);
const UserData = require('../database/userData.model')(sequelize, Sequelize);
const multiplier = require('../database/multiplier.model')(sequelize, Sequelize);
const bcrypt = require('bcrypt');
const {Web3} = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));

const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.KEY, 'hex');
const iv = Buffer.from(process.env.IV_KEY, 'hex');

const cipher = crypto.createCipheriv(algorithm, key, iv);





module.exports.createUser = async (req, res) => {
    const { username, password } = req.body;

    try {
        const saltRounds = 10;
        const hashPassword = await bcrypt.hash(password, saltRounds);

        const newAccount = await web3.eth.accounts.create();
        let encryptedKey = cipher.update(newAccount.privateKey, 'utf-8', 'hex');
        encryptedKey += cipher.final('hex');

        await User.create({
            username: username,
            password: hashPassword
        })

        await UserWallet.create({
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




module.exports.userAuthentication = async (req, res) => {
     const { username , password} = req.body;

     try {
        const user = await User.findOne({where: {username: username}});
        const hashedPassword = user.password;

        const matchedPassword = await bcrypt.compare(password, hashedPassword);

        if(!matchedPassword) {
            res.status(400).json({
                auth: 'fail'
            })
        }

        res.status(200).json({
            auth: 'success'
        })
     } catch (error) {
        res.status(400).json('auth failed')
     }
     


}


module.exports.getAllUserTrades = async (req, res) => {

    const { username } = req.params;

    try {
       const gmxTrade = await gmxMarketOrder.findAll({where: {trade_status: 0, username: username}});
       const gnsTrade = await gnsMarketOrder.findAll({where: {trade_status: 0, username: username}});

       for(let i = 0; i < gmxTrade.length; i++) {
           gmxTrade[i].platform = 'GMX';
       }

       for(let i = 0; i < gnsTrade.length; i++) {
        gnsTrade[i].platform = 'GAINS';
       }
       const allTrades = gnsTrade.concat(gmxTrade);
       res.status(200).json(allTrades);
    } catch(error) {
       res.status(400).json(error)
    }

}

module.exports.getLeaderboards = async (_, res) => {
       const users = await UserData.findAll();

       try {
        if(users.length > 0) {
            users.sort((a,b) => a.pnl - b.pnl);
            res.status(200).json(users)
        } else {
            res.status(200).json({user: 'no users'})
        }
        
     } catch (error) {
        res.status(400).json('error leaderboard');
     }
}


module.exports.userAirdropPoints = async (req, res) => {
    const { username, points, masterPassword } = req.body;

    while(masterPassword == adminPassword) {
       const user = await UserData.findOne({where: {username: username}});
       if(user) {
           const totalPoints = user.points + points;
           UserData.update({points: totalPoints}, {where: {username: username}});

           res.status(200).json({
              status: 'success',
              totalPoints: totalPoints
           })
       }

       break

    }
    res.status(400).json('incorrect master password');


}
