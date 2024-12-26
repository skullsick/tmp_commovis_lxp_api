"use strict";

///////////////////
///////////////////

const fetch = require("node-fetch");
const jose = require("node-jose");

let publicKeys, keysUrl, username;

async function fetchKeys() {
  const publicKeysResponse = await fetch(keysUrl);
  const responseJson = await publicKeysResponse.json();
  return responseJson.keys;
}

//remember the keys for subsequent calls
async function getPublicKeys() {
  if (!publicKeys) {
    publicKeys = fetchKeys();
  }
  return publicKeys;
}

class Verifier {
  constructor(params, claims = {}) {
    this.debug = true;
    if (!params.userPoolId) throw Error("userPoolId param is required");
    if (!params.region) throw Error("region param is required");
    if (params.debug === false) {
      this.debug = false;
    }

    this.userPoolId = params.userPoolId;
    this.region = params.region;
    this.expectedClaims = claims;

    keysUrl =
      "https://cognito-idp." +
      this.region +
      ".amazonaws.com/" +
      this.userPoolId +
      "/.well-known/jwks.json";
  }

  async verify(token) {
    try {
      if (!token) throw Error("token undefined");

      const sections = token.split(".");
      const header = JSON.parse(jose.util.base64url.decode(sections[0]));
      const kid = header.kid;

      const publicKeys = await getPublicKeys();

      const myPublicKey = publicKeys.find((k) => k.kid === kid);

      if (!myPublicKey) throw Error("Public key not found at " + keysUrl);

      const joseKey = await jose.JWK.asKey(myPublicKey);

      const verifiedToken = await jose.JWS.createVerify(joseKey).verify(token);

      const claims = JSON.parse(verifiedToken.payload);
      //   console.log("Claims");
      //   console.log(claims);
      username = claims.username;
      if (!claims.iss.endsWith(this.userPoolId))
        throw Error("iss claim does not match user pool ID");

      const now = Math.floor(new Date() / 1000);
      //   console.log("now");
      //   console.log(now);
      if (now > claims.exp) throw Error("Token is expired");

      if (
        this.expectedClaims.aud &&
        claims.token_use === "access" &&
        this.debug
      )
        console.warn("WARNING! Access tokens do not have an aud claim");

      for (let claim in this.expectedClaims) {
        //check the expected strings using strict equality against the token's claims
        if (typeof this.expectedClaims[claim] !== "undefined") {
          if (
            ["string", "boolean", "number"].includes(
              typeof this.expectedClaims[claim]
            )
          ) {
            if (this.expectedClaims[claim] !== claims[claim]) {
              throw Error(
                `expected claim "${claim}" to be ${this.expectedClaims[claim]} but was ${claims[claim]}`
              );
            }
          }

          //apply the expected claims that are Functions against the claims that were found on the token
          if (typeof this.expectedClaims[claim] === "function") {
            if (!this.expectedClaims[claim].call(null, claims[claim])) {
              throw Error(`expected claim "${claim}" does not match`);
            }
          }

          if (typeof this.expectedClaims[claim] === "object") {
            throw Error(`use a function with claim "${claim}"`);
          }
        }
      }
      return true;
    } catch (e) {
      if (this.debug) console.log(e);
      return false;
    }
  }

  forgetPublicKeys() {
    publicKeys = null;
  }
}

///////////////////
///////////////////

//const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
var getCommovisToken = function (token) {
  const fulltoken = token;
  //console.log("Full token: " + token);
  let seperate_token = token.split("::::");
  let bearer = seperate_token["0"].substring(7);

  let tenant = seperate_token["1"];
  let decoded = Buffer.from(tenant, "base64");
  //let decoded = atoa(tenant);
  decoded = decoded.toString();
  let res = decoded.split("::");

  let tokendetails = {
    token: bearer,
    clientID: res["0"],
    poolID: res["1"],
    tenant: res["2"],
  };
  // console.log("bearer");
  // console.log(bearer);
  // console.log("ClientID");
  // console.log(res["0"]);
  // console.log("poolID");
  // console.log(res["1"]);
  // console.log("tenant");
  // console.log(res["2"]);

  //   console.log(tokendetails);
  //   console.log("Length 0");
  //   console.log(res["0"].length);
  //   console.log("Length 1");
  //   console.log(res["1"].length);
  //   console.log("Length 2");
  //   console.log(res["2"].length);
  let returndetails = tokendetails;
  // if (res["0"].length != 25) {
  //   returndetails = false;
  // }
  // if (res["1"].length != 19) {
  //   returndetails = false;
  // }
  // if (res["2"].length != 36) {
  //   returndetails = false;
  // }
  return returndetails;
};

module.exports.authorizerUser = (event, context, callback) => {
  //const timestamp = new Date().getTime();
  //const fulltoken = event.headers.authorization;
  //console.log("Full token: " + event.headers.authorization);
  let details = getCommovisToken(event.headers.authorization);
  // console.log("Authorization");
  // console.log(event.headers.authorization);
  // console.log("getCommovisToken");
  // console.log(details);
  if (!details) {
    callback("Unauthorized", null);
  }
  ////console.log(details);
  // details get 4 value backe
  //details.token;
  //details.clientID
  //details.poolID
  //details.tenant

  // params
  // Todo change region to dynamic
  const params = {
    region: "eu-west-1", // required
    userPoolId: details.poolID, // required
    debug: false, // optional parameter to show console logs
  };

  //optional claims examples
  const claims = {
    client_id: details.clientID,
    //email_verified: true,
    //auth_time: (time) => time <= timestamp,
    // "cognito:groups": (groups) => groups.includes("Admins"),
  };

  const verifier = new Verifier(params, claims);

  //   console.log("Run the Verify function");
  //   console.log(details.token);
  verifier.verify(details.token).then((result) => {
    let isAuthorized = result;
    // console.log("details");
    // console.log(details);
    // console.log("username");
    // console.log(username);
    details.username = username;
    //result will be `true` if token is valid, non-expired, and has matching claims
    //result will be `false` if token is invalid, expired or fails the claims check
    // console.log("verifier.verify");
    // console.log(result);

    let authResponse = {
      isAuthorized: isAuthorized,
      context: details,
    };
    callback(null, authResponse);
  });
};

module.exports.authorizerAdmin = (event, context, callback) => {
  let details = getCommovisToken(event.headers.authorization);
  // console.log("Authorization");
  // console.log(event.headers.authorization);
  // console.log("getCommovisToken");
  // console.log(details);
  if (!details) {
    callback("Unauthorized", null);
  }

  // params
  // Todo change region to dynamic
  const params = {
    region: "eu-west-1", // required
    userPoolId: details.poolID, // required
    debug: false, // optional parameter to show console logs
  };

  //optional claims examples
  const claims = {
    client_id: details.clientID,
    "cognito:groups": (groups) => groups.includes("TenantAdmin"),
  };

  const verifier = new Verifier(params, claims);

  verifier.verify(details.token).then((result) => {
    let isAuthorized = result;
    details.username = username;
    let authResponse = {
      isAuthorized: isAuthorized,
      context: details,
    };
    callback(null, authResponse);
  });
};

module.exports.authorizerAdminOrFacilitator = (event, context, callback) => {
  let details = getCommovisToken(event.headers.authorization);
  // console.log("Authorization");
  // console.log(event.headers.authorization);
  // console.log("getCommovisToken");
  // console.log(details);
  if (!details) {
    callback("Unauthorized", null);
  }

  // params
  // Todo change region to dynamic
  const params = {
    region: "eu-west-1", // required
    userPoolId: details.poolID, // required
    debug: false, // optional parameter to show console logs
  };

  //optional claims examples
  const claims = {
    client_id: details.clientID,
    "cognito:groups": (groups) => {
      return groups.includes("TenantAdmin") || groups.includes("Facilitator")
    },
  };

  const verifier = new Verifier(params, claims);

  verifier.verify(details.token).then((result) => {
    let isAuthorized = result;
    details.username = username;
    let authResponse = {
      isAuthorized: isAuthorized,
      context: details,
    };
    callback(null, authResponse);
  });
};
