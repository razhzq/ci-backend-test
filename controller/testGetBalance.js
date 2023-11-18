require('dotenv').config({ path: "../.env" })
const path = require("path");
const fs = require("fs");
const {Web3} = require('web3');

const providerUrl = process.env.ARBITRUM_HTTP;
const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));


async function getBalance() {

    const blockNumber = await web3.eth.getBlockNumber();

    const balance = await web3.eth.getBalance('0x3B682A044f6cffe7C8ccfD9D6d18a9463900F82D', blockNumber)
    const ethBalance = web3.utils.fromWei(balance, 'ether');

    console.log(parseInt(ethBalance))
   

}


getBalance()