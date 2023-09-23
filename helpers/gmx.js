


const gmxPairMap = new Map([
    ['0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', 'BTC/USD'],
    ['0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 'ETH/USD'],
    ['0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', 'LINK/USD'],
    ['0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', 'UNI/USD'],
])

module.exports.getAssetFromGMXAddress = (asset) => {
    if(gmxPairMap.has(asset)) {
        return gmxPairMap.get(asset)
    } else {
        console.log('asset does not exist')
      }
}