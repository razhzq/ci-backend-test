require('dotenv').config({ path: "../.env" })
const path = require("path");
const fs = require("fs");
const {Web3} = require('web3');
const {Sequelize} = require('sequelize');
const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: 'postgres', // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  })

const userWallet = require("../database/userWallet.model")(sequelize, Sequelize);
const { decryptor } = require('../helpers/decypter');
const providerUrl = process.env.ARBITRUM_HTTP;
const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));

const polygonProvider = process.env.POLYGON_HTTP;
const web3Polygon = new Web3(new Web3.providers.HttpProvider(polygonProvider))

const daiAbiPath = path.resolve(__dirname, "../contractABI/DAIcontract.json");
const daiRawData = fs.readFileSync(daiAbiPath);
const daiAbi = JSON.parse(daiRawData);

const daiAddress = '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'
const daiPolyAddress = ''

const daiDenominator = BigInt(1e18);



module.exports.transferETH = async (req, res) => {
    const { etherAmount, toAddress, username, network} = req.body;

    const wallet = await userWallet.findOne({where: {walletOwner: username}});
    const privateKey = decryptor(wallet.privateKey);
    const etherValue = web3.utils.toWei(etherAmount.toString()) //check if received is num
    try {
        if(network == 'arbitrum') {
            const nonce = await web3.eth.getTransactionCount(wallet.publicKey);
            const gasPrice = await web3.eth.getGasPrice();
            const account = web3.eth.accounts.privateKeyToAccount(privateKey);

            const txObject = {
                nonce: web3.utils.toHex(nonce),
                gasPrice: web3.utils.toHex(gasPrice),
                gasLimit: web3.utils.toHex(21000),
                to: toAddress,
                value: etherValue
            }
            const signedTx = await account.signTransaction(txObject);

            web3.eth.sendSignedTransaction(signedTx.rawTransaction)
               .on('receipt', receipt => {
                  res.status(200).json({
                    transactionHash: receipt.transactionHash
                  })
               }).on('error', error => {
                  res.status(400).json('transaction failed')
               })

        } else {
            const nonce = await web3Polygon.eth.getTransactionCount(wallet.publicKey);
            const gasPrice = await web3Polygon.eth.getGasPrice();
            const account = web3Polygon.eth.accounts.privateKeyToAccount();

            const txObject = {
                nonce: web3Polygon.utils.toHex(nonce),
                gasPrice: web3Polygon.utils.toHex(gasPrice),
                gasLimit: web3Polygon.utils.toHex(21000),
                to: toAddress,
                value: etherValue
            }
            const signedTx = await account.signTransaction(txObject);

            web3Polygon.eth.sendSignedTransaction(signedTx.rawTransaction)
               .on('receipt', receipt => {
                  res.status(200).json({
                    transactionHash: receipt.transactionHash
                  })
               }).on('error', error => {
                  res.status(400).json('transaction failed')
               })

        }

    } catch (error) {
        res.status(400).json({
            error: error
        })
    }
}

module.exports.transferDAI = async (req, res) => {
    const {daiAmount, toAddress, username, network } = req.body;
    const wallet = await userWallet.findOne({where: { walletOwner: username}});
    const privateKey = decryptor(wallet.privateKey);
    
    try {
        if(network == 'arbitrum') {
            const account = web3.eth.accounts.privateKeyToAccount(privateKey);
            const daiContract = new web3.eth.Contract(daiAbi, daiAddress);
            const daiToTransfer = web3.utils.toWei(daiAmount.toString());

            await daiContract.methods.transfer(toAddress, daiToTransfer).send({from: account, gasLimit: '21000', transactionBlockTimeout: 200})
               .on('receipt', receipt => {
                   res.status(200).json({
                    transactionHash: receipt.transactionHash
                   })
               })

        } else {
            const account = web3Polygon.eth.accounts.privateKeyToAccount(privateKey);
            const daiContract = new web3Polygon.eth.Contract(daiAbi, daiAddress);
            const daiToTransfer = web3Polygon.utils.toWei(daiAmount.toString());

            await daiContract.methods.transfer(toAddress, daiToTransfer).send({from: account, gasLimit: '21000', transactionBlockTimeout: 200})
               .on('receipt', receipt => {
                   res.status(200).json({
                    transactionHash: receipt.transactionHash
                   })
               })
        }

    } catch(error) {
        res.status(400).json({
            error: error
        })
    }
}


module.exports.getUserWalletDetails = async (req, res) => {
    const {username} = req.params;

    try {
        const wallet = await userWallet.findOne({where: {walletOwner: username}});
        res.status(200).json({
            wallet: wallet
        })
    } catch (error) {
         res.status(400).json({
            error: error
         })
    }

}


module.exports.getETHBalance = async (req, res) => {
    const { username } = req.params;

    try {

        const user = await userWallet.findOne({where: {walletOwner: username}});

        const blockNumber = await web3.eth.getBlockNumber();
        const balance = await web3.eth.getBalance(user.publicKey, blockNumber);
        const ethBalance = parseInt(web3.utils.fromWei(balance, 'ether'));

        res.status(200).json({
            ethBalance: ethBalance
        })



    } catch(error) {
       res.status(400).json('error balance')
    }
}

module.exports.getDAIBalance = async (req, res) => {
    const { username } = req.params;


      try {
        const user = await userWallet.findOne({where: {walletOwner: username}});
        const daiContract = new web3.eth.Contract(daiAbi, daiAddress);
        const balance = await daiContract.methods.balanceOf(user.publicKey).call();

        const convBalance = parseInt(balance.toString()) / parseInt(daiDenominator.toString());
        res.status(200).json({
            daiBalance: convBalance
        })
      } catch (error) {
          console.log(error);
          res.status(400).json({
            error: 'error getting DAI balance'
          })
      } 
}