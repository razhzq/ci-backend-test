
const {Web3} = require('web3')


module.exports.calculateFees = (collateral) => {
     const fees = parseInt(collateral) * 0.01;
     const feesInWei = Web3.utils.toWei(fees.toString(), 'ether');
     return feesInWei;
}