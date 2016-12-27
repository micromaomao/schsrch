let sspdf;

try {
  sspdf = require('../build/Debug/sspdf')
} catch (e) {
  try {
    sspdf = require('../build/Release/sspdf')
  } catch (e) {
    throw e
  }
}

module.exports = sspdf
