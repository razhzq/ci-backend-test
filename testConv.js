
const {getPairPriceGMX} = require('./helpers/gmx')


async function main() {
     const price = await getPairPriceGMX('BTC/USD');
     const convPrice = price / 10 ** 30;
}


main();