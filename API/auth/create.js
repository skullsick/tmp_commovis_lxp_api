"use strict";

const AWS = require("aws-sdk"); // eslint-disable-line import/no-extraneous-dependencies

const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();

let fs = require("fs"); //Filesystem

let invite_content = fs.readFileSync(
  __dirname + "/email/invite_email.html",
  "utf-8"
);

module.exports.create = (event, context, callback) => {
  const timestamp = new Date().getTime();
  const data = JSON.parse(event.body);

  let invite_email = invite_content.replace("###url###", data.url);
  let params = {
    PoolName: data.name /* required */,
    AccountRecoverySetting: {
      RecoveryMechanisms: [
        {
          Name: "verified_email" /* required */,
          Priority: 1 /* required */,
        },
        /* more items */
      ],
    },
    AdminCreateUserConfig: {
      AllowAdminCreateUserOnly: true,
      InviteMessageTemplate: {
        EmailMessage: invite_email,
        EmailSubject: "You are Invited - Welcome to COMMOVIS",
      },
    },
    EmailConfiguration: {
      ConfigurationSet: "COMMOVIS",
      EmailSendingAccount: "DEVELOPER",
      From: "COMMOVIS <no-reply@commovis.com>",
      SourceArn:
        "arn:aws:ses:eu-west-1:869555217043:identity/no-reply@commovis.com",
    },
    AutoVerifiedAttributes: ["email"],
    MfaConfiguration: "OFF",
    Policies: {
      PasswordPolicy: {
        MinimumLength: 8,
        RequireLowercase: true,
        RequireNumbers: true,
        RequireSymbols: true,
        RequireUppercase: true,
        TemporaryPasswordValidityDays: 3,
      },
    },

    /*  UserPoolAddOns: {
      AdvancedSecurityMode: OFF | AUDIT | ENFORCED ,
    }, */
    UserPoolTags: {
      Stage: data.stage,
    },
    UsernameAttributes: ["email"],
    UsernameConfiguration: {
      CaseSensitive: false /* required */,
    },
    EmailVerificationMessage:
      "this is my password reset eemail {####} here is the url " + data.url,
    EmailVerificationSubject: "message for verificataion subject " + data.url,
  };

  cognitoidentityserviceprovider.createUserPool(
    params,
    function (error, resultdata) {
      if (error) {
        //
        callback(null, {
          statusCode: error.statusCode || 501,
          headers: { "Content-Type": "text/plain" },
          body: error.stack,
        });
        return;
      }
      // an error occurred
      else {
        // callback(null, resultdata);
        params = {
          ClientName: "commovis" /* required */,
          UserPoolId: resultdata.UserPool.Id /* required */,
          GenerateSecret: false,
        };
        cognitoidentityserviceprovider.createUserPoolClient(
          params,
          function (error, resultdata) {
            if (error) {
              console.log(error, error.stack);
              callback(null, {
                statusCode: error.statusCode || 501,
                headers: { "Content-Type": "text/plain" },
                body: error.stack,
              });
              return;
            }
            // an error occurred
            else {
              // create a response
              //write entry into database
              const response = {
                statusCode: 200,
                body: JSON.stringify(resultdata),
              };
              callback(null, response);
            } // successful response
          }
        );
      }
    }
  );
};
