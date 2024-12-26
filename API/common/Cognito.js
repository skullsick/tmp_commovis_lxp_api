const AWS = require("aws-sdk");

const CognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();

module.exports = CognitoIdentityServiceProvider;