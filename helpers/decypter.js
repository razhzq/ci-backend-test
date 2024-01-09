require("dotenv").config({ path: "../.env" });
const crypto = require("crypto");
const algorithm = "aes-256-cbc";
const AWS = require("aws-sdk");
const kms = new AWS.KMS();

const iv = Buffer.from(process.env.IV_KEY, "hex");
const keyAlias = 'apedBotBackendKEY';

async function getKMSData(alias) {
  const params = {
    KeyId: alias,
  };

  const response = await kms.describeKey(params).promise();
  return response.KeyMetadata.Arn;
}

async function getKeyFromKMS(alias) {
  const keyArn = await getKMSData(alias);
  const params = {
    KeyId: keyArn,
  };

  const response = await kms.decrypt(params).promise();
  return response.Plaintext;
}

module.exports.decryptor = async (hash) => {
  const key = await getKeyFromKMS(keyAlias);

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decryptedData = decipher.update(hash, "hex", "utf8");
  decryptedData += decipher.final("utf8");

  return decryptedData;
};

module.exports.encryptor = async (hash) => {
  const key = await getKeyFromKMS(keyAlias);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encryptedKey = cipher.update(hash, "utf-8", "hex");
  encryptedKey += cipher.final("hex");

  return encryptedKey;
};
