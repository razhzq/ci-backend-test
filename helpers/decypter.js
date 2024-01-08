
require('dotenv').config({ path: "../.env" })
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.KEY, 'hex');
const iv = Buffer.from(process.env.IV_KEY, 'hex');


module.exports.decryptor = (hash) => {
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decryptedData = decipher.update(hash, 'hex', 'utf8');
    decryptedData += decipher.final('utf8');

    return decryptedData;


}


module.exports.encryptor = (hash) => {

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encryptedKey = cipher.update(hash, "utf-8", "hex");
    encryptedKey += cipher.final("hex");

    return encryptedKey;
    
}