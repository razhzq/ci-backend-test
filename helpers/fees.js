const { Web3 } = require("web3");

module.exports.calculateFees = (collateral) => {
  const fees = parseInt(collateral) * 0.01;
  const feesInWei = Web3.utils.toWei(fees.toString(), "ether");
  return feesInWei;
};

module.exports.calculateTakeProfit = (
  leverage,
  entryPrice,
  expectedProfitPercent,
  isLong
) => {
  let takeProfitPrice;
  if (isLong == true) {
    takeProfitPrice =
      entryPrice + 0.01 * entryPrice * (expectedProfitPercent / leverage);
  } else {
    takeProfitPrice =
      entryPrice - 0.01 * entryPrice * (expectedProfitPercent / leverage);
  }
  return takeProfitPrice.toFixed(2);
};

module.exports.calculateStopLoss = () => {
  let stopLossPrice;
  if (isLong == true) {
    stopLossPrice =
      entryPrice - 0.01 * entryPrice * (Math.abs(lossPercent) / leverage);
  } else {
    stopLossPrice =
      entryPrice + 0.01 * entryPrice * (Math.abs(lossPercent) / leverage);
  }

  return stopLossPrice.toFixed(2);
};
