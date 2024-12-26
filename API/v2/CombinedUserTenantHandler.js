"use strict";
const AWS = require("aws-sdk");
const Responses = require("../common/API_Responses");
const Dynamo = require("../common/Dynamo");
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const CognitoIdentityServiceProvider = require("../common/Cognito");
const cognitoidentityserviceproviderDirect =
  new AWS.CognitoIdentityServiceProvider();
AWS.config.update({ region: process.env.AWS_REGION });
const s3 = new AWS.S3({ signatureVersion: "v4" });
const S3_BUCKET = process.env.stage + "-upload-assets";
const uuid = require("uuid");
let fs = require("fs");
const cache = new Map(); // Simple in-memory cache
var parser = require("ua-parser-js");
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY); // Store your secret key in an environment variable
const stripe_webhook = process.env.STRIPE_WEBHOOK_SECRET;
const cmvTenant = process.env.CMV_TENANT;
const sharp = require('sharp'); // Image processing library
const Excel = require('exceljs');
const moment = require('moment');
const https = require('https');

const JourneyTableName = process.env.DYNAMODB_JOURNEY_TABLE;
const JourneyParticipantRelationTableName = process.env.DYNAMODB_JOURNEY_PARTICIPANT_RELATION_TABLE;
const JourneyCategoryTableName = process.env.DYNAMODB_JOURNEY_CATEGORY_TABLE;
const JourneyReusableTemplatesTableName = process.env.DYNAMODB_JOURNEY_REUSABLE_TEMPLATES_TABLE;
const TreasureChestTableName = process.env.DYNAMODB_TREASURE_CHEST_TABLE;
const UserNotificationsTableName = process.env.DYNAMODB_USER_NOTIFICATIONS_TABLE;
const UserPreferencesTableName = process.env.DYNAMODB_USER_PREFERENCES_TABLE;
const InternalCurrencyTableName = process.env.DYNAMODB_INTERNAL_CURRENCY_TABLE;
const InternalCurrencyTransfersTableName = process.env.DYNAMODB_INTERNAL_CURRENCY_TRANSFERS_TABLE;
const TenantTableName = process.env.DYNAMODB_TENANT_TABLE;
const LedgerEntryTableName = process.env.DYNAMODB_LEDGER_ENTRY_TABLE;

//console.log("run CombineUserTenantHandler.js");

let invite_content = fs.readFileSync(
  __dirname + "/email/invite_email.html",
  "utf-8"
);

let reset_content = fs.readFileSync(
  __dirname + "/email/reset_email.html",
  "utf-8"
);

//console.log("run loaded html");

exports.handler = async (event) => {
  const path = event.requestContext.http.path;
  const method = event.requestContext.http.method;

  //console.log("run exports handler and event " + event);
  //console.log("run exports handler and method " + method);

  if (method === "GET") {
    if (method === 'GET' && path.startsWith('/v2/image/')) {
      return getImage(event);
    }
    //console.log("checking method GET");
    switch (path) {
      case "/v2/user/devicelist":
        return userDeviceList(event);

      default:
        return Responses._404({ message: "Endpoint not found" });
    }
  } else if (method === "POST") {
    //console.log("checking method POST");

    if (path.startsWith("/v2/tenantinfo/")) {
      const name = path.split("/")[3];
      return tenantInfo(event, name);
    }
    switch (path) {
      case "/v2/tenant":
        return tenantCreate(event);
      case "/v2/tenant/update-logo":
        return tenantUpdateLogo(event);
     // case "/v2/cmv/tenant":
     //   return cmvTenant(event);
      case "/v2/cmv/tenants":
        return cmvTenants(event);
      case "/v2/cmv/paymentexport":
        return cmvMonthExport(event);
      //case "/v2/cmv/users":
      //  return cmvUsers(event);
      //case "/v2/cmv/ic/balance":
      //  return cmvBalance(event);
      case "/v2/add-custom-attributes-to-user-pool":
        return addCustomAttributesToUserPool(event);
      case "/v2/align-users-expiration-date":
        return alignUsersExpirationDate(event);
      case "/v2/check-existing-users":
        return checkExistingUsers(event);
      case "/v2/create-users":
        return createUsers(event);
      case "/v2/delete-users":
        return deleteUsers(event);
      case "/v2/list-users":
        return listUsers(event);
      case "/v2/list-users-by-role":
        return listUsersByRole(event);
      case "/v2/tenant-admin-update-users":
        return tenantAdminUpdateUsers(event);
      case "/v2/user/verifyUserEmail":
        return verifyUserEmail(event);
      case "/v2/upload/profile/check":
        return uploadProfileCheck(event);
      case "/v2/user-notifications/get":
        return getUserNotifications(event);
      case "/v2/user-preferences/get":
        return getUserPreferences(event);
      case "/v2/user-preferences/update-journeys-notes":
        return updateJourneysNotes(event);
      case "/v2/user-preferences/update-language":
        return updateLanguage(event);
      case "/v2/user-preferences/update-last-journey-id":
        return updateLastJourneyId(event);
      case "/v2/user-preferences/update-tags":
        return updateTags(event);
      case "/v2/user-preferences/update-treasure-chest-filters":
        return updateTreasureChestFilters(event);
      case "/v2/user-preferences/update-user-extra-attributes":
        return updateUserExtraAttributes(event);
      case "/v2/internal-currency/get-amount":
        return getInternalCurrencyAmount(event);
      case "/v2/internal-currency/transfer-user-commovis-credits":
        return transferUserCommovisCredits(event);
      case "/v2/internal-currency/get-user-internal-currency-transfers":
        return getUserInternalCurrencyTransfers(event);
      //case "/v2/internal-currency/get-payment-link":
      //  return getPaymentLink(event);
      //case "/v2/internal-currency/on-payment-success":
      //  return onPaymentSuccess(event);
      case "/v2/ic/customer-manage":
        return billingPortalManage(event);
      case "/v2/ic/invoice-create":
        return invoiceCreate(event);
      case "/v2/ic/paymentconfirmation":
        return paymentConfirmation(event);
      case "/v2/ic/ledgerentry":
        return ledgerEntry(event);
      case "/v2/resend-users-temporary-password": {
        return resendUsersTemporaryPassword(event);
      }
      default:
        return Responses._404({ message: "Endpoint not found" });
    }
  } else if (method === "PUT") {
    //console.log("checking method PUT");
    if (path.startsWith("/v2/tenant/")) {
      const id = path.split("/")[3];
      return tenantUpdate(event, id);
    } else if (path.startsWith("/v2/user/picture/")) {
      const id = path.split("/")[4];
      return userPictureUpdate(event, id);
    } else if (path.startsWith("/v2/user/")) {
      const id = path.split("/")[3];
      return userUpdate(event, id);
    } else if (path.startsWith("/v2/user-update-roles/")) {
      const id = path.split("/")[3];
      return userUpdateRoles(event, id);
    }
    switch (path) {
      //  case "/v2/tenant":
      //    return tenantCreate(event);
      default:
        return Responses._404({ message: "Endpoint not found" });
    }
  } else if (method === "DELETE") {
    //console.log("checking method DELETE");
    if (path.startsWith("/v2/tenant/")) {
      const id = path.split("/")[3];
      return deleteTenant(event, id);
    } else if(path.startsWith("/v2/user-notifications/")){
      const id = path.split("/")[3];
      return deleteUserNotification(event, id);
    } else {
      return Responses._404({ message: "Endpoint not found" });
    }
  } else {
    console.log("no method identified. fallback");
    return Responses._405({
      message: "Method not allowed, Path: " + path + " Method: " + method,
    });
  }
};

/// GET Methots

const userDeviceList = async (event) => {
  console.log("User Device List: " + event);
  const authorizer_context = event.requestContext.authorizer.lambda;

  // console.log(authorizer_context.clientID);
  // console.log(authorizer_context.poolID);
  // console.log(authorizer_context.tenant);
  // console.log(authorizer_context.username);
  // console.log(authorizer_context.token)
  let devices = {};
  var params = {
    //AccessToken: authorizer_context.token /* required */,
    UserPoolId: authorizer_context.poolID /* required */,
    Username: authorizer_context.username /* required */,
  };
  cognitoidentityserviceproviderDirect.adminListDevices(
    params,
    function (err, data) {
      if (err) {
        console.log(err, err.stack);
        const response = {
          statusCode: 501,
          body: JSON.stringify(err),
        };
        return response;
      }
      // an error occurred
      else {
        console.log(data); // successful response
        devices = data.Devices;
        let count = 0;
        let device_obj = {};
        for (const listdevice of devices) {
          for (const devicedetail of listdevice.DeviceAttributes) {
            if (devicedetail.Name == "device_name") {
              var ua = parser(devicedetail.Value);

              device_obj[count] = {
                devicevendor: ua.device.vendor,
                devicemodel: ua.device.model,
                osname: ua.os.name,
                osversion: ua.os.version,
                browser: ua.browser.name,
                browserversion: ua.browser.version,
              };
            } else if (devicedetail.Name == "last_ip_used") {
              console.log(devicedetail.Value);
              device_obj[count].lastip = devicedetail.Value;
            }
          }
          device_obj[count].devicelastmodifieddate =
            listdevice.DeviceLastModifiedDate;
          device_obj[count].devicelastauthenticateddate =
            listdevice.DeviceLastAuthenticatedDate;
          device_obj[count].devicecreatedatee = listdevice.DeviceCreateDate;
          count++;
        }
        const response = {
          statusCode: 200,
          body: JSON.stringify(device_obj),
        };
        return response;
      }
    }
  );
};


/*
 let envDOMAIN = null;
  let findStage = process.env.DYNAMODB_TENANT_TABLE;
  let stage = null;
  if (findStage.includes("dev")) {
    envDOMAIN = ".dev.commovis.com";
    stage = "DEV";
  } else {
    envDOMAIN = ".commovis.com";
    stage = "PROD";
  } 
    */

// Helper function to trigger background processing via API Gateway
const triggerBackgroundProcessing = async (event, size) => {
  // Start timing for this background process
  const startTime = Date.now();
  const correlationId = event.requestContext.requestId;

  // Determine environment and domain
  let envDOMAIN = null;
  let stage = null;
  let findStage = process.env.DYNAMODB_TENANT_TABLE;
  
  if (findStage.includes("dev")) {
    envDOMAIN = "api.dev.commovis.com";
    stage = "DEV";
  } else {
    envDOMAIN = "api.commovis.com";
    stage = "PROD";
  }

  // Construct the path
  const originalPath = event.rawPath || event.path;
  const newPath = originalPath.replace(
    /\/(x-small|small|medium|large|x-large)\//,
    `/${size}/`
  );

  // Log the start of background processing
  console.log('Initiating background processing:', {
    correlationId,
    size,
    stage,
    domain: envDOMAIN,
    path: newPath,
    startTime: new Date(startTime).toISOString(),
    requestId: event.requestContext.requestId
  });

  const options = {
    hostname: envDOMAIN,
    path: newPath,
    method: 'GET',
    headers: {
      'Authorization': event.headers.Authorization || event.headers.authorization,
      'x-background-processing': 'true',
      'x-correlation-id': correlationId,
      'x-process-start-time': startTime.toString()
    }
  };

  // Log the full request URL for debugging
  console.log('Background processing request details:', {
    correlationId,
    fullUrl: `https://${envDOMAIN}${newPath}`,
    size,
    headers: options.headers
  });

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log('Background processing response received:', {
          correlationId,
          size,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString()
        });

        resolve();
      });
    });

    req.on('error', (error) => {
      const errorTime = Date.now();
      console.error('Background processing error:', {
        correlationId,
        size,
        error: error.message,
        duration: `${errorTime - startTime}ms`,
        startTime: new Date(startTime).toISOString(),
        errorTime: new Date(errorTime).toISOString()
      });
      resolve(); // Still resolve as this is background processing
    });

    req.setTimeout(2000, () => {
      const timeoutTime = Date.now();
      console.warn('Background processing timeout:', {
        correlationId,
        size,
        duration: `${timeoutTime - startTime}ms`,
        startTime: new Date(startTime).toISOString(),
        timeoutTime: new Date(timeoutTime).toISOString()
      });
      req.destroy();
      resolve();
    });

    req.end();
  });
};

const getImage = async (event) => {
  console.log('getImage function started', { requestId: event.requestContext.requestId });
  const authorizer_context = event.requestContext.authorizer.lambda;
  const tenantID = authorizer_context.tenant;
  
  // Extract all parameters from path
  const {
    journeyID,
    type: imageType,
    imageID,
    size: requestedSize = 'medium',
    format: requestedFormat = 'original'
  } = event.pathParameters || {};

  // Validate parameters
  if (!journeyID || !imageType || !imageID) {
    return Responses._400({ message: 'Missing required parameters' });
  }

  if (!['o', 'a'].includes(imageType)) {
    return Responses._400({ message: 'Invalid image type' });
  }

  const widths = {
    'x-small': 300,
    'small': 640,
    'medium': 1024,
    'large': 1440,
    'x-large': 2560
  };

  if (!widths[requestedSize]) {
    return Responses._400({ message: 'Invalid size parameter' });
  }

  // Extract original format from filename
  const formatMatch = imageID.match(/\.([^.]+)$/);
  const originalFormat = formatMatch ? formatMatch[1].toLowerCase() : 'jpg';
  const supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  const outputFormat = requestedFormat === 'original' ? originalFormat : requestedFormat;

  // Build paths
  const basePath = `uploads/${tenantID}/journey/${journeyID}`;
  const imagePath = imageType === 'o' ? 
    `${basePath}/${imageID}` : 
    `${basePath}/assets/${imageID}`;

  const cleanFileName = imageID.replace(/-(x-small|small|medium|large|x-large)\./, '.');
  const originalKey = imagePath;

  try {
    // Function to get the key for a specific size and format
    const getSizeKey = (size, format) => 
      `${basePath}/resized/${cleanFileName.replace(/\.[^.]+$/, `-${size}.${format}`)}`;

    // Check if the requested version exists first
    const requestedSizeKey = getSizeKey(requestedSize, outputFormat);
    try {
      const resizedImage = await s3.getObject({
        Bucket: S3_BUCKET,
        Key: requestedSizeKey
      }).promise();

      // If the requested size exists, return it immediately without triggering background processing
      return {
        statusCode: 200,
        headers: {
          'Content-Type': `image/${outputFormat === 'jpg' ? 'jpeg' : outputFormat}`,
          'Cache-Control': 'public, max-age=31536000',
          'Content-Disposition': 'inline',
          'Vary': 'Accept'
        },
        body: resizedImage.Body.toString('base64'),
        isBase64Encoded: true
      };
    } catch (error) {
      if (error.code !== 'NoSuchKey') throw error;
      // Continue with processing if the size doesn't exist
    }

    // Get original image for processing
    const originalImage = await s3.getObject({
      Bucket: S3_BUCKET,
      Key: originalKey
    }).promise();

    if (!originalImage.Body) {
      return Responses._404({ message: 'Original image not found' });
    }

    // Check for animated GIF
    if (originalFormat === 'gif') {
      const metadata = await sharp(originalImage.Body, { animated: true }).metadata();
      if (metadata.pages > 1) {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'image/gif',
            'Cache-Control': 'public, max-age=31536000',
            'Content-Disposition': 'inline',
          },
          body: originalImage.Body.toString('base64'),
          isBase64Encoded: true
        };
      }
    }

    // Create a base sharp instance for the requested size
    const baseInstance = sharp(originalImage.Body).resize({
      width: widths[requestedSize],
      withoutEnlargement: true,
      fit: sharp.fit.inside
    });

    // Process both WebP and original format in parallel
    const processFormatPromises = [];
    
    // Always process WebP version
    const webpPromise = (async () => {
      const buffer = await baseInstance
        .clone()
        .webp({ quality: 80 })
        .toBuffer();
      
      if (buffer && buffer.length > 0) {
        const webpKey = getSizeKey(requestedSize, 'webp');
        await s3.putObject({
          Bucket: S3_BUCKET,
          Key: webpKey,
          Body: buffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000'
        }).promise();

        if (outputFormat === 'webp') {
          return buffer;
        }
      }
    })();
    processFormatPromises.push(webpPromise);

    // Process original format
    const originalFormatPromise = (async () => {
      let instance = baseInstance.clone();
      let buffer;
      
      switch(originalFormat) {
        case 'png':
          buffer = await instance.png({ compressionLevel: 9 }).toBuffer();
          break;
        case 'jpg':
        case 'jpeg':
          buffer = await instance.jpeg({ quality: 80 }).toBuffer();
          break;
        case 'gif':
          buffer = await instance.gif().toBuffer();
          break;
        default:
          buffer = await instance.jpeg({ quality: 80 }).toBuffer();
      }
      
      if (buffer && buffer.length > 0) {
        const originalFormatKey = getSizeKey(requestedSize, originalFormat);
        await s3.putObject({
          Bucket: S3_BUCKET,
          Key: originalFormatKey,
          Body: buffer,
          ContentType: `image/${originalFormat === 'jpg' ? 'jpeg' : originalFormat}`,
          CacheControl: 'public, max-age=31536000'
        }).promise();

        if (outputFormat === 'original' || outputFormat === originalFormat) {
          return buffer;
        }
      }
    })();
    processFormatPromises.push(originalFormatPromise);

    // Wait for all formats to be processed
    const results = await Promise.all(processFormatPromises);

// When triggering background processing for other sizes
if (!event.headers['x-background-processing']) {
  const otherSizes = Object.keys(widths).filter(size => size !== requestedSize);
  
  console.log('Starting parallel background processing:', {
    correlationId: event.requestContext.requestId,
    requestedSize,
    otherSizes,
    totalSizesToProcess: otherSizes.length,
    timestamp: new Date().toISOString()
  });

  // Trigger all sizes in parallel
  await Promise.allSettled(otherSizes.map(size => 
    triggerBackgroundProcessing(event, size)
  ));

  console.log('All background processing triggered:', {
    correlationId: event.requestContext.requestId,
    completedAt: new Date().toISOString()
  });
}
    
    // Get the buffer for the requested format
    const requestedBuffer = results.find(buffer => buffer !== undefined);

    if (!requestedBuffer) {
      console.error('No buffer found for format:', {
        originalFormat,
        outputFormat,
        results: results.map(r => r ? 'buffer present' : 'undefined')
      });
      throw new Error('Failed to process image in requested format');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': `image/${outputFormat === 'jpg' ? 'jpeg' : outputFormat}`,
        'Cache-Control': 'public, max-age=31536000',
        'Content-Disposition': 'inline',
        'Vary': 'Accept'
      },
      body: requestedBuffer.toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error("Error processing image:", error);
    return Responses._500({ message: 'Image processing error' });
  }
};

/// end GET Methots


///POST Methots
const tenantCreate = async (event) => {
  const timestamp = new Date().getTime();
  const data = JSON.parse(event.body);
  const tenantid = uuid.v4();
  if (
    typeof data.name !== "string" &&
    typeof data.description !== "string" &&
    typeof data.primarycolor !== "string" &&
    typeof data.secondarycolor !== "string" &&
    //typeof data.stage !== "string" &&
    // typeof data.Id !== "string" &&
    // typeof data.CId !== "string" &&
    typeof data.title !== "string" &&
    typeof data.email !== "string"
  ) {
    console.error("Validation Failed");
    // callback(null, {
    //   statusCode: 400,
    //   headers: { "Content-Type": "text/plain" },
    //   body: "Couldn't create the Tenant item.",
    // });
    return '{ statusCode: 400, headers: { "Content-Type": "text/plain" }, body: "Couldn\'t create the Tenant item."}';
  }

  let envDOMAIN = null;
  let findStage = process.env.DYNAMODB_TENANT_TABLE;
  let stage = null;
  if (findStage.includes("dev")) {
    envDOMAIN = ".dev.commovis.com";
    stage = "DEV";
  } else {
    envDOMAIN = ".commovis.com";
    stage = "PROD";
  }
  const fulldomain = "https://" + data.name + envDOMAIN;

  let invite_email = invite_content.replace(/###url###/g, fulldomain);
  let invite_email_p = invite_email.replace(
    /###primarycolor###/g,
    data.primarycolor
  );
  let invite_email_s = invite_email_p.replace(
    /###secondarycolor###/g,
    data.secondarycolor
  );
  let reset_email = reset_content.replace(/###url###/g, fulldomain);
  let reset_email_p = reset_email.replace(
    /###primarycolor###/g,
    data.primarycolor
  );
  let reset_email_s = reset_email_p.replace(
    /###secondarycolor###/g,
    data.secondarycolor
  );
  let params = {
    PoolName: tenantid /* required */,
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
        EmailMessage: invite_email_s,
        EmailSubject: "You're invited! Welcome to HansenBeck LXP",
      },
    },
    DeviceConfiguration: {
      ChallengeRequiredOnNewDevice: false,
      DeviceOnlyRememberedOnUserPrompt: true,
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
        TemporaryPasswordValidityDays: 7,
      },
    },

    /*  UserPoolAddOns: {
      AdvancedSecurityMode: OFF | AUDIT | ENFORCED ,
    }, */
    UserPoolTags: {
      Stage: stage,
    },
    UsernameAttributes: ["email"],
    UsernameConfiguration: {
      CaseSensitive: false /* required */,
    },
    EmailVerificationMessage: reset_email_s,
    EmailVerificationSubject: "COMMOVIS: Verification code",
  };

  cognitoidentityserviceproviderDirect.createUserPool(
    params,
    function (error, resultdata) {
      if (error) {
        //
        // callback(null, {
        //   statusCode: error.statusCode || 501,
        //   headers: { "Content-Type": "text/plain" },
        // //   body: error.stack,
        // // });
        return (
          "{ statusCode: " +
          error.statusCode +
          ' || 501, headers: { "Content-Type": "text/plain" }, body: ' +
          error.stack +
          " }"
        );
      }
      // an error occurred
      else {
        // callback(null, resultdata);
        params = {
          ClientName: "commovis" /* required */,
          UserPoolId: resultdata.UserPool.Id /* required */,
          GenerateSecret: false,
        };
        cognitoidentityserviceproviderDirect.createUserPoolClient(
          params,
          function (error, resultdataClient) {
            if (error) {
              console.log(error, error.stack);
              //   callback(null, {
              //     statusCode: error.statusCode || 501,
              //     headers: { "Content-Type": "text/plain" },
              //     body: error.stack,
              //   });
              return (
                "{ statusCode: " +
                error.statusCode +
                ' || 501, headers: { "Content-Type": "text/plain" }, body: ' +
                error.stack +
                " }"
              );
            }
            // an error occurred
            else {
              var params = {
                CustomAttributes: [
                  {
                    Name: "academic_degree",
                    AttributeDataType: "String",
                    DeveloperOnlyAttribute: false,
                    Mutable: true,
                    Required: false,
                  },
                  {
                    Name: "job_title",
                    AttributeDataType: "String",
                    DeveloperOnlyAttribute: false,
                    Mutable: true,
                    Required: false,
                  },
                  {
                    Name: "company",
                    AttributeDataType: "String",
                    DeveloperOnlyAttribute: false,
                    Mutable: true,
                    Required: false,
                  },
                  {
                    Name: "position",
                    AttributeDataType: "String",
                    DeveloperOnlyAttribute: false,
                    Mutable: true,
                    Required: false,
                  },
                  // {
                  //   Name: "reports_to",
                  //   AttributeDataType: "String",
                  //   DeveloperOnlyAttribute: false,
                  //   Mutable: true,
                  //   Required: false,
                  // },
                  {
                    Name: "private_email",
                    AttributeDataType: "String",
                    DeveloperOnlyAttribute: false,
                    Mutable: true,
                    Required: false,
                  },
                  {
                    Name: "social_linkedIn",
                    AttributeDataType: "String",
                    DeveloperOnlyAttribute: false,
                    Mutable: true,
                    Required: false,
                  },
                  {
                    Name: "social_instagram",
                    AttributeDataType: "String",
                    DeveloperOnlyAttribute: false,
                    Mutable: true,
                    Required: false,
                  },
                  {
                    Name: "social_facebook",
                    AttributeDataType: "String",
                    DeveloperOnlyAttribute: false,
                    Mutable: true,
                    Required: false,
                  },
                  {
                    Name: "social_other",
                    AttributeDataType: "String",
                    DeveloperOnlyAttribute: false,
                    Mutable: true,
                    Required: false,
                  },
                  {
                    Name: "bio",
                    AttributeDataType: "String",
                    DeveloperOnlyAttribute: false,
                    Mutable: true,
                    Required: false,
                  },
                  {
                    Name: "expiration_date",
                    AttributeDataType: "String",
                    DeveloperOnlyAttribute: false,
                    Mutable: true,
                    Required: false,
                  },
                  // {
                  //   Name: "zip_code_location_land",
                  //   AttributeDataType: "String",
                  //   DeveloperOnlyAttribute: false,
                  //   Mutable: true,
                  //   Required: false,
                  // },
                  // {
                  //   Name: "social_xing",
                  //   AttributeDataType: "String",
                  //   DeveloperOnlyAttribute: false,
                  //   Mutable: true,
                  //   Required: false,
                  // },
                  // {
                  //   Name: "social_twitter",
                  //   AttributeDataType: "String",
                  //   DeveloperOnlyAttribute: false,
                  //   Mutable: true,
                  //   Required: false,

                  /* more items */
                ],
                UserPoolId: resultdata.UserPool.Id /* required */,
              };
              cognitoidentityserviceproviderDirect.addCustomAttributes(
                params,
                function (error, resultdataCustomeAttributes) {
                  if (error) {
                    // callback(null, {
                    //   statusCode: error.statusCode || 501,
                    //   headers: { "Content-Type": "text/plain" },
                    //   body: error.stack,
                    // });
                    return (
                      "{ statusCode: " +
                      error.statusCode +
                      ' || 501, headers: { "Content-Type": "text/plain" }, body: ' +
                      error.stack +
                      " }"
                    );
                  } else {
                    // create the Group in Cognito
                    var paramsAdmin = {
                      GroupName: "TenantAdmin" /* required */,
                      UserPoolId: resultdata.UserPool.Id /* required */,
                      Description: "Administrator of this Tenant",
                    };
                    var paramsFacilitator = {
                      GroupName: "Facilitator" /* required */,
                      UserPoolId: resultdata.UserPool.Id /* required */,
                      Description:
                        "Facilitators are able to create new Journeys",
                    };
                    var paramsParticipant = {
                      GroupName: "Participant" /* required */,
                      UserPoolId: resultdata.UserPool.Id /* required */,
                      Description: "Participants can attend Journeys ",
                    };
                    // var paramsManager = {
                    //   GroupName: "Manager" /* required */,
                    //   UserPoolId: resultdata.UserPool.Id /* required */,
                    //   Description:
                    //       "Managers role",
                    // };
                    // var paramsAssistant = {
                    //   GroupName: "Assistant" /* required */,
                    //   UserPoolId: resultdata.UserPool.Id /* required */,
                    //   Description:
                    //       "Assistants role",
                    // };
                    let errorCreateGroup = true;
                    cognitoidentityserviceproviderDirect.createGroup(
                      paramsAdmin,
                      function (error, resultdataCreateGroup) {
                        if (error) errorCreateGroup = true;
                        else errorCreateGroup = false;
                      }
                    );
                    cognitoidentityserviceproviderDirect.createGroup(
                      paramsFacilitator,
                      function (error, resultdataCreateGroup) {
                        if (error) errorCreateGroup = true;
                        else errorCreateGroup = false;
                      }
                    );
                    cognitoidentityserviceproviderDirect.createGroup(
                      paramsParticipant,
                      function (error, resultdataCreateGroup) {
                        if (error) errorCreateGroup = true;
                        else errorCreateGroup = false;
                      }
                    );
                    // cognitoidentityserviceproviderDirect.createGroup(
                    //     paramsManager,
                    //     function (error, resultdataCreateGroup) {
                    //       if (error) errorCreateGroup = true;
                    //       else errorCreateGroup = false;
                    //     }
                    // );
                    // cognitoidentityserviceproviderDirect.createGroup(
                    //     paramsAssistant,
                    //     function (error, resultdataCreateGroup) {
                    //       if (error) errorCreateGroup = true;
                    //       else errorCreateGroup = false;
                    //     }
                    // );

                    if (!errorCreateGroup) {
                      //   callback(null, {
                      //     statusCode: error.statusCode || 501,
                      //     headers: { "Content-Type": "text/plain" },
                      //     body: error.stack,
                      //   });
                      return (
                        "{ statusCode: " +
                        error.statusCode +
                        ' || 501, headers: { "Content-Type": "text/plain" }, body: ' +
                        error.stack +
                        " }"
                      );
                    } else {
                      // create a response
                      //write entry into database
                      //set Parameter for this function

                      const tenantparams = {
                        TableName: process.env.DYNAMODB_TENANT_TABLE,
                        Item: {
                          id: tenantid,
                          title: data.title,
                          tenantname: data.name,
                          primarycolor: data.primarycolor,
                          secondarycolor: data.secondarycolor,
                          redirect: false,
                          createdAt: timestamp,
                          updatedAt: timestamp,
                          description: data.description,
                          logo: "",
                          paymentOption: "TF",
                          userRoleCost: {
                            Participant: 1,
                            Facilitator: 1,
                            TenantAdmin: 1,
                          },
                          euroExchangeRate: 5,
                          details: {
                            Id: resultdata.UserPool.Id,
                            CId: resultdataClient.UserPoolClient.ClientId,
                          },
                        },
                      };
                      dynamoDB.put(tenantparams, async (error) => {
                        // handle potential errors
                        if (error) {
                          console.error(error);
                          //   callback(null, {
                          //    statusCode: error.statusCode || 501,
                          //    headers: { "Content-Type": "text/plain" },
                          //    body: "Couldn't create the tenant item.",
                          //  });
                          return '{ statusCode: error.statusCode || 501, headers: { "Content-Type": "text/plain" }, body: "Couldn\'t create the tenant item."}';
                        }

                        // add tenant to internal currency table for T/TF payment options cases
                        let paramsInternalCurrency = {
                          ID: uuid.v4(),
                          OwnerID: tenantid,
                          Amount: 0,
                          TenantID: tenantid,
                        };

                        await Dynamo.write(
                          paramsInternalCurrency,
                          InternalCurrencyTableName
                        ).catch((error) => {
                          return Responses._500({ message: error.message });
                        });

                        if ("email" in data) {
                          let email = data.email.toLowerCase();
                          let paramsNewUser = {
                            UserPoolId: resultdata.UserPool.Id /* required */,
                            Username: email /* required */,
                            DesiredDeliveryMediums: ["EMAIL"],
                            ForceAliasCreation: false,
                            UserAttributes: [
                              {
                                Name: "email" /* required */,
                                Value: email,
                              },
                              {
                                Name: "custom:expiration_date",
                                Value: "",
                              },
                            ],
                          };

                          let createdUserSub = null;
                          let userAppRole = "TenantAdmin";
                          let userPoolId = resultdata.UserPool.Id;

                          const cognitoResponseAdminCreateUser =
                            await cognitoidentityserviceproviderDirect
                              .adminCreateUser(paramsNewUser)
                              .promise();
                          if (
                            cognitoResponseAdminCreateUser.hasOwnProperty(
                              "User"
                            )
                          ) {
                            let userSubObject =
                              cognitoResponseAdminCreateUser.User.Attributes.find(
                                (attribute) => attribute.Name === "sub"
                              );

                            if (userSubObject !== undefined) {
                              createdUserSub = userSubObject.Value;
                            }

                            // cognitoResponseAdminCreateUser.User.Attributes.forEach((attribute) => {
                            //     if (attribute.Name === 'sub') {
                            //         createdUserSub = attribute.Value;
                            //     }
                            // });

                            // add user to group
                            let paramsAddUserToGroup = {
                              GroupName: userAppRole /* required */,
                              UserPoolId: userPoolId /* required */,
                              Username:
                                cognitoResponseAdminCreateUser.User
                                  .Username /* required */,
                            };
                            await CognitoIdentityServiceProvider.adminAddUserToGroup(
                              paramsAddUserToGroup
                            ).promise();

                            // make an entry for the new user in treasure chest table
                            let paramsTreasureChest = {
                              ID: uuid.v4(),
                              UserID: createdUserSub,
                              Assets: Dynamo.typeConvertorJavascriptToDynamoDB(
                                []
                              ),
                              TenantID: tenantid,
                            };

                            await Dynamo.write(
                              paramsTreasureChest,
                              TreasureChestTableName
                            ).catch((error) => {
                              return Responses._500({ message: error.message });
                            });

                            // make an entry for the new user in user preferences table
                            let paramsUserPreferences = {
                              ID: uuid.v4(),
                              UserID: createdUserSub,
                              Language: "en",
                              TreasureChestFilters:
                                Dynamo.typeConvertorJavascriptToDynamoDB({
                                  Types: [],
                                  Sources: [],
                                  Tags: [],
                                }),
                              Tags: Dynamo.typeConvertorJavascriptToDynamoDB(
                                []
                              ),
                              JourneysNotes:
                                Dynamo.typeConvertorJavascriptToDynamoDB([]),
                              TenantID: tenantid,
                              LastJourneyID: "",
                              ExtraAttributes: Dynamo.typeConvertorJavascriptToDynamoDB({})
                            };

                            await Dynamo.write(
                              paramsUserPreferences,
                              UserPreferencesTableName
                            ).catch((error) => {
                              return Responses._500({ message: error.message });
                            });
                          }

                          // create a response
                          const response = {
                            statusCode: 200,
                            body: "OK: Tenant Created",
                          };
                          return response;
                        } else {
                          // create a response
                          const response = {
                            statusCode: 200,
                            body: "OK: Tenant Created",
                          };
                          return response;
                        }
                      });
                    }
                  }
                }
              );
            } // successful response
          }
        );
      }
    }
  );
};
const tenantInfo = async (event, name) => {
  console.log("Tenant Information: " + name);
  const tenantName = event.pathParameters.name;
  console.log("Tenant Name: " + tenantName);

  // Check cache first
  if (cache.has(tenantName)) {
    const cachedResponse = cache.get(tenantName);
    const response =
      "{ statusCode: 200, body: " + JSON.stringify(cachedResponse) + " })";
    //return response;
    return Responses._200(cachedResponse);
  }

  const params = {
    TableName: process.env.DYNAMODB_TENANT_TABLE,
    IndexName: "tenantGSI",
    KeyConditionExpression: "tenantname = :TenanteName",
    ExpressionAttributeValues: { ":TenanteName": tenantName },
    ProjectionExpression:
      "id, tenantname, title, primarycolor, secondarycolor, redirect, details, description, logo, paymentOption, userRoleCost, euroExchangeRate",
    ScanIndexForward: false,
  };

  try {
    const result = await dynamoDB.query(params).promise();

    if (!result.Items || result.Items.length === 0) {
      const response = {
        statusCode: 404,
        body: `Couldn't fetch the tenant item. Please provide a valid name: ${tenantName}`,
      };
      //return response;
      return Responses._404(`Couldn't fetch the tenant item. Please provide a valid name: ${tenantName}`);
    }

    const tenantInfo = result.Items[0];
    cache.set(tenantName, tenantInfo); // Cache the result

    const response = JSON.stringify(tenantInfo);
    //callback(null, response);
    return Responses._200(tenantInfo);
  } catch (error) {
    console.error(error);
    const response =
      '{statusCode: error.statusCode || 501, headers: { "Content-Type": "text/plain" }, body: "Couldn\'t fetch the tenant item. Please provide a valid name: ' +
      tenantName +
      ". Error: " +
      error +
      '" });';
    //return response;
    return Responses._500("Couldn\'t fetch the tenant item. Please provide a valid name: " + tenantName +". Error: " + error +"");
  }
};
const tenantUpdateLogo = async (event) => {
  console.log("Tenant Update Logo: " + event);
  let requestData = JSON.parse(event.body);
  //
  const hasRequiredParams = (requestData) => {
    return requestData.hasOwnProperty("logo");
  };

  if (!hasRequiredParams(requestData)) {
    return Responses._400({ message: "Missing required parameters!" });
  }

  try {
    const authorizer_context = event.requestContext.authorizer.lambda;

    const tenantID = `${authorizer_context.tenant}`;

    let params = {
      TableName: TenantTableName,
      Key: {
        id: tenantID,
      },
      UpdateExpression: "SET #logo = :logo",
      ExpressionAttributeNames: {
        "#logo": "logo",
      },
      ExpressionAttributeValues: {
        ":logo": requestData.logo,
      },
      ReturnValues: "UPDATED_NEW",
    };

    const response = await dynamoDB.update(params).promise();

    let updatedLogo = response.Attributes;

    return Responses._200({ updatedLogo });
  } catch (error) {
    return Responses._500({ message: error.message });
  }
};
const addCustomAttributesToUserPool = async (event) => {
  console.log("Add Custom Attributes To User Pool: " + event);
  // Cognito generates a temporary password if not specified in params
  let requestData = JSON.parse(event.body);
  //
  const hasRequiredParams = (requestData) => {
    return (
      requestData.hasOwnProperty("UserPoolId") &&
      requestData.hasOwnProperty("CustomAttributes")
    );
  };

  if (!hasRequiredParams(requestData)) {
    return Responses._400({ message: "Missing required parameters!" });
  }

  if (!Array.isArray(requestData.CustomAttributes)) {
    return Responses._400({ message: "Custom Attributes must be array" });
  }

  try {
    await CognitoIdentityServiceProvider.addCustomAttributes(
      requestData
    ).promise();

    return Responses._200({ message: "Attributes added successfully" });
  } catch (error) {
    return Responses._500({ message: error.message });
  }
};
const alignUsersExpirationDate = async (event) => {
  console.log("Align Users Expiration Date: " + event);
  let requestData = JSON.parse(event.body);

  const getAmountForTenant = async () => {
    let paramsInternalCurrencyScan = {
      TableName: InternalCurrencyTableName,
      FilterExpression: `#OwnerID = :OwnerID and #TenantID = :TenantID`,
      ExpressionAttributeNames: {
        "#OwnerID": "OwnerID",
        "#TenantID": "TenantID",
      },
      ExpressionAttributeValues: {
        ":OwnerID": tenantID,
        ":TenantID": tenantID,
      },
    };

    const responseInternalCurrencyTableScan = await dynamoDB
      .scan(paramsInternalCurrencyScan)
      .promise();

    if (
      responseInternalCurrencyTableScan.hasOwnProperty("Count") &&
      responseInternalCurrencyTableScan.hasOwnProperty("Items")
    ) {
      if (responseInternalCurrencyTableScan.Count < 1) {
        return 0;
      }

      if (responseInternalCurrencyTableScan.Count === 1) {
        currencyTableEntryID = responseInternalCurrencyTableScan.Items[0].ID;
        return responseInternalCurrencyTableScan.Items[0].Amount;
      }

      if (responseInternalCurrencyTableScan.Count > 1) {
        return 0;
      }
    }
  };

  const calculateDailyPrice = (monthlyPrice) => {
    const daysInYear = 365;
    const totalAnnualPrice = monthlyPrice * 12;
    const dailyPrice = totalAnnualPrice / daysInYear;
    return dailyPrice;
  };

  const calculateDaysBetween = (date1, date2) => {
    // Normalize the dates to ignore the time part
    const start = new Date(
      date1.getFullYear(),
      date1.getMonth(),
      date1.getDate()
    );
    const end = new Date(
      date2.getFullYear(),
      date2.getMonth(),
      date2.getDate()
    );

    // Calculate the difference in time
    const differenceInTime = end - start; // difference in milliseconds

    // Convert the difference from milliseconds to days
    const differenceInDays = differenceInTime / (1000 * 60 * 60 * 24);

    return Math.round(differenceInDays);
  };

  const getLatestExpirationDate = (arr) => {
    // Filter the array to get objects with the 'custom:expiration_date' property
    const dates = arr
      .filter((obj) => obj["custom:expiration_date"])
      .map((obj) => new Date(obj["custom:expiration_date"]));

    // If no dates found, return null or an appropriate value
    if (dates.length === 0) {
      return null;
    }

    // Find the latest date
    const latestDate = new Date(Math.max(...dates));

    return latestDate.toDateString(); // Convert back to 'Fri Jul 11 2025' format
  };

  const calculateAlignExpirationDatePriceToPay = (group) => {
    let monthlyPrice = 0;

    switch (group) {
      case "TenantAdmin": {
        monthlyPrice = userRoleCost.TenantAdmin;
        break;
      }
      case "Facilitator": {
        monthlyPrice = userRoleCost.Facilitator;
        break;
      }
      case "Participant": {
        monthlyPrice = userRoleCost.Participant;
        break;
      }
      default: {
        break;
      }
    }

    requestData.Users.forEach((user) => {
      if (
        user.hasOwnProperty("custom:expiration_date") &&
        user["custom:expiration_date"] !== ""
      ) {
        const startDate = new Date(user["custom:expiration_date"]);
        const endDate = new Date(latestExpirationDate);

        const dailyPrice = calculateDailyPrice(monthlyPrice);
        const daysBetween = calculateDaysBetween(startDate, endDate);

        let totalPrice = dailyPrice * daysBetween;
        totalPrice = totalPrice.toFixed(2);
        alignExpirationDatePriceToPay += parseFloat(totalPrice);
      }
    });
  };

  const updateUsersExpirationDate = async () => {
    for (const user of requestData.Users) {
      if (
        user.hasOwnProperty("custom:expiration_date") &&
        user["custom:expiration_date"] !== ""
      ) {
        user["custom:expiration_date"] = latestExpirationDate;
        let paramsUpdateUser = {
          UserAttributes: [
            {
              Name: "custom:expiration_date",
              Value: user["custom:expiration_date"],
            },
          ],
          UserPoolId: userPoolID,
          Username: user.sub,
        };
        await CognitoIdentityServiceProvider.adminUpdateUserAttributes(
          paramsUpdateUser
        ).promise();
      }
    }
  };

  // const saveNewUsers = async () => {
  //     for (const newUser of requestData.NewUsers) {
  //
  //         let userAppRole = newUser.hasOwnProperty('Group') ? newUser.Group : 'Participant';
  //
  //         let createdUserSub = null;
  //
  //         try {
  //
  //             // user does not already exist
  //
  //             let paramsNewUser = {
  //                 UserPoolId: userPoolID /* required */,
  //                 Username: newUser.email /* required */,
  //                 DesiredDeliveryMediums: ["EMAIL"],
  //                 ForceAliasCreation: false,
  //                 UserAttributes: [
  //                     {
  //                         Name: "given_name",
  //                         Value: newUser.given_name,
  //                     },
  //                     {
  //                         Name: "family_name",
  //                         Value: newUser.family_name,
  //                     },
  //                     {
  //                         Name: "email",
  //                         Value: newUser.email,
  //                     },
  //                     {
  //                         Name: "custom:company",
  //                         Value: newUser['custom:company'],
  //                     },
  //                     {
  //                         Name: "custom:position",
  //                         Value: newUser['custom:position'],
  //                     },
  //                     {
  //                         Name: "phone_number",
  //                         Value: newUser.phone_number,
  //                     },
  //                 ],
  //             };
  //
  //             // create user
  //             const cognitoResponseAdminCreateUser = await CognitoIdentityServiceProvider.adminCreateUser(paramsNewUser).promise();
  //             if (cognitoResponseAdminCreateUser.hasOwnProperty('User')) {
  //
  //                 let userSubObject = cognitoResponseAdminCreateUser.User.Attributes.find((attribute) => attribute.Name === 'sub');
  //
  //                 if (userSubObject !== undefined) {
  //                     createdUserSub = userSubObject.Value;
  //                 }
  //
  //                 // cognitoResponseAdminCreateUser.User.Attributes.forEach((attribute) => {
  //                 //     if (attribute.Name === 'sub') {
  //                 //         createdUserSub = attribute.Value;
  //                 //     }
  //                 // });
  //
  //                 // add user to group
  //                 let paramsAddUserToGroup = {
  //                     GroupName: userAppRole /* required */,
  //                     UserPoolId: userPoolID /* required */,
  //                     Username: cognitoResponseAdminCreateUser.User.Username /* required */,
  //                 }
  //                 await CognitoIdentityServiceProvider.adminAddUserToGroup(paramsAddUserToGroup).promise();
  //
  //
  //                 // make an entry for the new user in treasure chest table
  //                 let paramsTreasureChest = {
  //                     ID: uuid.v4(),
  //                     UserID: createdUserSub,
  //                     Assets: Dynamo.typeConvertorJavascriptToDynamoDB([]),
  //                     TenantID: tenantID,
  //                 }
  //
  //                 await Dynamo.write(paramsTreasureChest, TreasureChestTableName).catch(error => {
  //                     return Responses._500({message: error.message});
  //                 });
  //
  //                 // make an entry for the new user in user preferences table
  //                 let paramsUserPreferences = {
  //                     ID: uuid.v4(),
  //                     UserID: createdUserSub,
  //                     Language: 'en',
  //                     TreasureChestFilters: Dynamo.typeConvertorJavascriptToDynamoDB({
  //                         Types: [],
  //                         Sources: [],
  //                         Tags: []
  //                     }),
  //                     Tags: Dynamo.typeConvertorJavascriptToDynamoDB([]),
  //                     JourneysNotes: Dynamo.typeConvertorJavascriptToDynamoDB([]),
  //                     TenantID: tenantID,
  //                 }
  //
  //                 await Dynamo.write(paramsUserPreferences, UserPreferencesTableName).catch(error => {
  //                     return Responses._500({message: error.message});
  //                 });
  //
  //                 // if facilitator, make entry in the internal currency table
  //                 if (userAppRole === 'Facilitator') {
  //                     let paramsInternalCurrency = {
  //                         ID: uuid.v4(),
  //                         OwnerID: createdUserSub,
  //                         Amount: 0,
  //                         TenantID: tenantID,
  //                     }
  //
  //                     await Dynamo.write(paramsInternalCurrency, InternalCurrencyTableName).catch(error => {
  //                         return Responses._500({message: error.message});
  //                     });
  //                 }
  //
  //             }
  //
  //         } catch (error) {
  //             return Responses._500({message: error.message});
  //         }
  //
  //     }
  // };

  // let addedUsers = [];

  const hasRequiredParams = (requestData) => {
    return requestData.hasOwnProperty("Users");
  };

  if (!hasRequiredParams(requestData)) {
    return Responses._400({ message: "Missing required parameters!" });
  }

  const authorizer_context = event.requestContext.authorizer.lambda;
  const userPoolID = authorizer_context.poolID;
  const tenantID = authorizer_context.tenant;

  let paymentOption = "";
  let userRoleCost = {};
  let alignExpirationDatePriceToPay = 0;
  let availableAmount = 0;
  let remainingAlignExpirationDateAmount = 0;
  let currencyTableEntryID = null;

  const latestExpirationDate = getLatestExpirationDate(requestData.Users);

  let usersAppRole = "";
  usersAppRole = requestData.Users[0].Group;

  // get tenant payment option
  let paramsTenantQuery = {
    TableName: TenantTableName,
    KeyConditionExpression: `#id = :id`,
    ExpressionAttributeNames: {
      "#id": "id",
    },
    ExpressionAttributeValues: {
      ":id": tenantID,
    },
    ScanIndexForward: false,
  };

  const tenantEntry = await dynamoDB.query(paramsTenantQuery).promise();

  if (tenantEntry.Count === 1) {
    paymentOption = tenantEntry.Items[0].paymentOption;
    userRoleCost = tenantEntry.Items[0].userRoleCost;

    switch (paymentOption) {
      case "FR": {
        try {
          await updateUsersExpirationDate();
        } catch (err) {
          return Responses._500({ message: err.message });
        }

        break;
      }
      case "T":
      case "TF": {
        try {
          availableAmount = await getAmountForTenant();
          calculateAlignExpirationDatePriceToPay(usersAppRole);
          let difference = availableAmount - alignExpirationDatePriceToPay;
          difference = difference.toFixed(2);
          remainingAlignExpirationDateAmount = parseFloat(difference);

          if (remainingAlignExpirationDateAmount < 0) {
            return Responses._500({
              message: "Insufficient amount of credits",
            });
          } else {
            let paramsUpdateInternalCurrencyEntry = {
              TableName: InternalCurrencyTableName,
              Key: {
                ID: currencyTableEntryID,
              },
              UpdateExpression: "SET #Amount = :Amount",
              ExpressionAttributeNames: {
                "#Amount": "Amount",
              },
              ExpressionAttributeValues: {
                ":Amount": remainingAlignExpirationDateAmount,
              },
              ReturnValues: "NONE",
            };

            await dynamoDB.update(paramsUpdateInternalCurrencyEntry).promise();
            await updateUsersExpirationDate();
          }
        } catch (err) {
          return Responses._500({ message: err.message });
        }

        break;
      }
      case "F": {
        // to be developed

        break;
      }
      default: {
        break;
      }
    }

    return Responses._200({
      message: "Users expiration date successfully aligned",
    });

    // const currentDate = new Date();
    // const expirationDate = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate());
    //
    // switch (paymentOption) {
    //     // we do not care about amount for flat rate
    //     case 'FR': {
    //         for (const newUser of requestData.NewUsers) {
    //
    //             let userAppRole = newUser.hasOwnProperty('Group') ? newUser.Group : 'Participant';
    //
    //             let createdUserSub = null;
    //
    //             let expirationDateBackup = expirationDate.toDateString();
    //
    //             try {
    //
    //                 // user does not already exist
    //
    //                 let paramsNewUser = {
    //                     UserPoolId: userPoolID /* required */,
    //                     Username: newUser.email /* required */,
    //                     DesiredDeliveryMediums: ["EMAIL"],
    //                     ForceAliasCreation: false,
    //                     UserAttributes: [
    //                         {
    //                             Name: "given_name",
    //                             Value: newUser.given_name,
    //                         },
    //                         {
    //                             Name: "family_name",
    //                             Value: newUser.family_name,
    //                         },
    //                         {
    //                             Name: "email",
    //                             Value: newUser.email,
    //                         },
    //                         {
    //                             Name: "custom:company",
    //                             Value: newUser['custom:company'],
    //                         },
    //                         {
    //                             Name: "custom:position",
    //                             Value: newUser['custom:position'],
    //                         },
    //                         {
    //                             Name: "phone_number",
    //                             Value: newUser.phone_number,
    //                         },
    //                         {
    //                             Name: "custom:expiration_date",
    //                             Value: expirationDateBackup,
    //                         },
    //                     ],
    //                 };
    //
    //                 // create user
    //                 const cognitoResponseAdminCreateUser = await CognitoIdentityServiceProvider.adminCreateUser(paramsNewUser).promise();
    //                 if (cognitoResponseAdminCreateUser.hasOwnProperty('User')) {
    //
    //                     let userSubObject = cognitoResponseAdminCreateUser.User.Attributes.find((attribute) => attribute.Name === 'sub');
    //
    //                     if (userSubObject !== undefined) {
    //                         createdUserSub = userSubObject.Value;
    //                     }
    //
    //                     // add user to group
    //                     let paramsAddUserToGroup = {
    //                         GroupName: userAppRole /* required */,
    //                         UserPoolId: userPoolID /* required */,
    //                         Username: cognitoResponseAdminCreateUser.User.Username /* required */,
    //                     }
    //                     await CognitoIdentityServiceProvider.adminAddUserToGroup(paramsAddUserToGroup).promise();
    //
    //
    //                     // make an entry for the new user in treasure chest table
    //                     let paramsTreasureChest = {
    //                         ID: uuid.v4(),
    //                         UserID: createdUserSub,
    //                         Assets: Dynamo.typeConvertorJavascriptToDynamoDB([]),
    //                         TenantID: tenantID,
    //                     }
    //
    //                     await Dynamo.write(paramsTreasureChest, TreasureChestTableName).catch(error => {
    //                         return Responses._500({message: error.message});
    //                     });
    //
    //                     // make an entry for the new user in user preferences table
    //                     let paramsUserPreferences = {
    //                         ID: uuid.v4(),
    //                         UserID: createdUserSub,
    //                         Language: 'en',
    //                         TreasureChestFilters: Dynamo.typeConvertorJavascriptToDynamoDB({
    //                             Types: [],
    //                             Sources: [],
    //                             Tags: []
    //                         }),
    //                         Tags: Dynamo.typeConvertorJavascriptToDynamoDB([]),
    //                         JourneysNotes: Dynamo.typeConvertorJavascriptToDynamoDB([]),
    //                         TenantID: tenantID,
    //                         LastJourneyID: '',
    //                     }
    //
    //                     await Dynamo.write(paramsUserPreferences, UserPreferencesTableName).catch(error => {
    //                         return Responses._500({message: error.message});
    //                     });
    //
    //                     // if facilitator, make entry in the internal currency table
    //                     if (userAppRole === 'TenantAdmin' || userAppRole === 'Facilitator') {
    //                         let paramsInternalCurrency = {
    //                             ID: uuid.v4(),
    //                             OwnerID: createdUserSub,
    //                             Amount: 0,
    //                             TenantID: tenantID,
    //                         }
    //
    //                         await Dynamo.write(paramsInternalCurrency, InternalCurrencyTableName).catch(error => {
    //                             return Responses._500({message: error.message});
    //                         });
    //                     }
    //
    //                 }
    //
    //             } catch (error) {
    //                 return Responses._500({message: error.message});
    //             }
    //
    //         }
    //         return Responses._200({message: 'Users successfully created'});
    //         break;
    //     }
    //     // tenant pays for everything
    //     case 'T':
    //     case 'TF': {
    //
    //         availableAmount = await getAmountForTenant();
    //
    //         let numberOfNewUsers = requestData.NewUsers.length;
    //
    //         let userAppRole = requestData.NewUsers[0].hasOwnProperty('Group') ? requestData.NewUsers[0].Group : 'Participant';
    //
    //         switch (userAppRole) {
    //
    //             case 'TenantAdmin': {
    //                 // first 3 tenant admins are free
    //                 let numberOfMaxFreeTenantAdmins = 3;
    //                 let paramsListUsersByGroup = {
    //                     UserPoolId: userPoolID,
    //                     GroupName: 'TenantAdmin'
    //                 }
    //
    //                 const groupResponse = await CognitoIdentityServiceProvider.listUsersInGroup(paramsListUsersByGroup).promise();
    //
    //                 let numberOfExistingTenantAdmins = groupResponse.Users.length;
    //
    //                 if (numberOfExistingTenantAdmins < numberOfMaxFreeTenantAdmins) {
    //                     freeTenantAdmins = numberOfMaxFreeTenantAdmins - numberOfExistingTenantAdmins;
    //                     numberOfNewUsers -= freeTenantAdmins;
    //                 }
    //
    //                 // calculate price for tenant admins
    //                 const monthlyPrice = userRoleCost.TenantAdmin ;
    //                 const dailyPrice = calculateDailyPrice(monthlyPrice);
    //                 const daysBetween = calculateDaysBetween(currentDate, expirationDate);
    //                 let totalPrice = dailyPrice * daysBetween * numberOfNewUsers;
    //                 totalPrice = totalPrice.toFixed(2);
    //                 priceToPay += parseFloat(totalPrice);
    //
    //                 break;
    //             }
    //             case 'Facilitator': {
    //
    //                 // calculate price for facilitator
    //                 const monthlyPrice = userRoleCost.Facilitator;
    //                 const dailyPrice = calculateDailyPrice(monthlyPrice);
    //                 const daysBetween = calculateDaysBetween(currentDate, expirationDate);
    //                 let totalPrice = dailyPrice * daysBetween * numberOfNewUsers;
    //                 totalPrice = totalPrice.toFixed(2);
    //                 priceToPay += parseFloat(totalPrice);
    //
    //                 break;
    //             }
    //             case 'Participant': {
    //
    //                 // calculate price for facilitator
    //                 const monthlyPrice = userRoleCost.Participant;
    //                 const dailyPrice = calculateDailyPrice(monthlyPrice);
    //                 const daysBetween = calculateDaysBetween(currentDate, expirationDate);
    //                 let totalPrice = dailyPrice * daysBetween * numberOfNewUsers;
    //                 totalPrice = totalPrice.toFixed(2);
    //                 priceToPay += parseFloat(totalPrice);
    //
    //                 break;
    //             }
    //             default: {
    //
    //                 break;
    //             }
    //
    //         }
    //
    //         remainingAmount = availableAmount - priceToPay;
    //
    //         if (remainingAmount >= 0) {
    //             let paramsUpdateInternalCurrencyEntry = {
    //                 TableName: InternalCurrencyTableName,
    //                 Key: {
    //                     ID: currencyTableEntryID,
    //                 },
    //                 UpdateExpression: 'SET #Amount = :Amount',
    //                 ExpressionAttributeNames: {
    //                     '#Amount': 'Amount',
    //                 },
    //                 ExpressionAttributeValues: {
    //                     ':Amount': remainingAmount,
    //                 },
    //                 ReturnValues: 'NONE',
    //             };
    //
    //             await dynamoDB.update(paramsUpdateInternalCurrencyEntry).promise();
    //
    //             // after amount was paid, add the new users
    //             for (const newUser of requestData.NewUsers) {
    //
    //                 let expirationDateBackup = expirationDate.toDateString();
    //
    //                 // if free tenant admins places are taken, user gets expiration date 1 year into the future
    //                 // free tenant admins have null expiration date
    //                 if (newUser.Group === 'TenantAdmin' && freeTenantAdmins > 0) {
    //
    //                     expirationDateBackup = '';
    //
    //                     freeTenantAdmins -= 1;
    //
    //                 }
    //
    //                 let createdUserSub = null;
    //
    //                 try {
    //
    //                     // user does not already exist
    //
    //                     let paramsNewUser = {
    //                         UserPoolId: userPoolID /* required */,
    //                         Username: newUser.email /* required */,
    //                         DesiredDeliveryMediums: ["EMAIL"],
    //                         ForceAliasCreation: false,
    //                         UserAttributes: [
    //                             {
    //                                 Name: "given_name",
    //                                 Value: newUser.given_name,
    //                             },
    //                             {
    //                                 Name: "family_name",
    //                                 Value: newUser.family_name,
    //                             },
    //                             {
    //                                 Name: "email",
    //                                 Value: newUser.email,
    //                             },
    //                             {
    //                                 Name: "custom:company",
    //                                 Value: newUser['custom:company'],
    //                             },
    //                             {
    //                                 Name: "custom:position",
    //                                 Value: newUser['custom:position'],
    //                             },
    //                             {
    //                                 Name: "phone_number",
    //                                 Value: newUser.phone_number,
    //                             },
    //                             {
    //                                 Name: "custom:expiration_date",
    //                                 Value: expirationDateBackup,
    //                             },
    //                         ],
    //                     };
    //
    //                     // create user
    //                     const cognitoResponseAdminCreateUser = await CognitoIdentityServiceProvider.adminCreateUser(paramsNewUser).promise();
    //                     if (cognitoResponseAdminCreateUser.hasOwnProperty('User')) {
    //
    //                         let userSubObject = cognitoResponseAdminCreateUser.User.Attributes.find((attribute) => attribute.Name === 'sub');
    //
    //                         if (userSubObject !== undefined) {
    //                             createdUserSub = userSubObject.Value;
    //                         }
    //
    //                         // add user to group
    //                         let paramsAddUserToGroup = {
    //                             GroupName: userAppRole /* required */,
    //                             UserPoolId: userPoolID /* required */,
    //                             Username: cognitoResponseAdminCreateUser.User.Username /* required */,
    //                         }
    //                         await CognitoIdentityServiceProvider.adminAddUserToGroup(paramsAddUserToGroup).promise();
    //
    //
    //                         // make an entry for the new user in treasure chest table
    //                         let paramsTreasureChest = {
    //                             ID: uuid.v4(),
    //                             UserID: createdUserSub,
    //                             Assets: Dynamo.typeConvertorJavascriptToDynamoDB([]),
    //                             TenantID: tenantID,
    //                         }
    //
    //                         await Dynamo.write(paramsTreasureChest, TreasureChestTableName).catch(error => {
    //                             return Responses._500({message: error.message});
    //                         });
    //
    //                         // make an entry for the new user in user preferences table
    //                         let paramsUserPreferences = {
    //                             ID: uuid.v4(),
    //                             UserID: createdUserSub,
    //                             Language: 'en',
    //                             TreasureChestFilters: Dynamo.typeConvertorJavascriptToDynamoDB({
    //                                 Types: [],
    //                                 Sources: [],
    //                                 Tags: []
    //                             }),
    //                             Tags: Dynamo.typeConvertorJavascriptToDynamoDB([]),
    //                             JourneysNotes: Dynamo.typeConvertorJavascriptToDynamoDB([]),
    //                             TenantID: tenantID,
    //                         }
    //
    //                         await Dynamo.write(paramsUserPreferences, UserPreferencesTableName).catch(error => {
    //                             return Responses._500({message: error.message});
    //                         });
    //
    //                         // if tenant admin or facilitator, make entry in the internal currency table
    //                         if (userAppRole === 'TenantAdmin' || userAppRole === 'Facilitator') {
    //                             let paramsInternalCurrency = {
    //                                 ID: uuid.v4(),
    //                                 OwnerID: createdUserSub,
    //                                 Amount: 0,
    //                                 TenantID: tenantID,
    //                             }
    //
    //                             await Dynamo.write(paramsInternalCurrency, InternalCurrencyTableName).catch(error => {
    //                                 return Responses._500({message: error.message});
    //                             });
    //                         }
    //
    //                     }
    //
    //                 } catch (error) {
    //                     return Responses._500({message: error.message});
    //                 }
    //
    //             }
    //
    //             return Responses._200({message: 'Users successfully created'});
    //
    //         }
    //         else {
    //             return Responses._500({ message: 'Insufficient amount of credits' });
    //         }
    //
    //         break;
    //     }
    //     case 'F': {
    //         // what happens here???
    //
    //         break;
    //     }
    //     default: {
    //
    //         break;
    //     }
    // }
  }
};
const checkExistingUsers = async (event) => {
  console.log("Check Existing Users: " + event);
  let requestData = JSON.parse(event.body);

  const authorizer_context = event.requestContext.authorizer.lambda;
  const userPoolID = authorizer_context.poolID;

  const hasRequiredParams = (requestData) => {
    return requestData.hasOwnProperty("UsersEmails");
  };

  if (!hasRequiredParams(requestData)) {
    return Responses._400({ message: "Missing required parameters!" });
  }

  let responseArray = [];

  for (const userEmail of requestData.UsersEmails) {
    // check if user email already exists
    try {
      let user = await CognitoIdentityServiceProvider.adminGetUser({
        UserPoolId: userPoolID,
        Username: userEmail,
      }).promise();

      // user already exists

      let expirationDate = "";
      user.UserAttributes.forEach((attribute) => {
        if (attribute.Name === "custom:expiration_date") {
          expirationDate = attribute.Value;
        }
      });

      responseArray.push({
        Email: userEmail,
        Exists: true,
        ExpirationDate: expirationDate,
      });
    } catch (err) {
      // user does not already exist
      if (err.code === "UserNotFoundException") {
        responseArray.push({
          Email: userEmail,
          Exists: false,
        });
      } else {
        return Responses._500({
          message: `Something is wrong with user ${userEmail}`,
        });
      }
    }
  }

  return Responses._200({
    checkedUsers: responseArray,
  });
};
const createUsers = async (event) => {
  let requestData = JSON.parse(event.body);

  const authorizer_context = event.requestContext.authorizer.lambda;
  const userPoolID = authorizer_context.poolID;
  const tenantID = authorizer_context.tenant;

  let paymentOption = "";
  let userRoleCost = {};
  let priceToPay = 0;
  let availableAmount = 0;
  let remainingAmount = 0;
  let currencyTableEntryID = null;

  const getAmountForTenant = async () => {
    let paramsInternalCurrencyScan = {
      TableName: InternalCurrencyTableName,
      FilterExpression: `#OwnerID = :OwnerID and #TenantID = :TenantID`,
      ExpressionAttributeNames: {
        "#OwnerID": "OwnerID",
        "#TenantID": "TenantID",
      },
      ExpressionAttributeValues: {
        ":OwnerID": tenantID,
        ":TenantID": tenantID,
      },
    };

    const responseInternalCurrencyTableScan = await dynamoDB
      .scan(paramsInternalCurrencyScan)
      .promise();

    if (
      responseInternalCurrencyTableScan.hasOwnProperty("Count") &&
      responseInternalCurrencyTableScan.hasOwnProperty("Items")
    ) {
      if (responseInternalCurrencyTableScan.Count < 1) {
        return 0;
      }

      if (responseInternalCurrencyTableScan.Count === 1) {
        currencyTableEntryID = responseInternalCurrencyTableScan.Items[0].ID;
        return responseInternalCurrencyTableScan.Items[0].Amount;
      }

      if (responseInternalCurrencyTableScan.Count > 1) {
        return 0;
      }
    }
  };

  const calculateDailyPrice = (monthlyPrice) => {
    const daysInYear = 365;
    const totalAnnualPrice = monthlyPrice * 12;
    const dailyPrice = totalAnnualPrice / daysInYear;
    return dailyPrice;
  };

  const calculateDaysBetween = (date1, date2) => {
    // Normalize the dates to ignore the time part
    const start = new Date(
      date1.getFullYear(),
      date1.getMonth(),
      date1.getDate()
    );
    const end = new Date(
      date2.getFullYear(),
      date2.getMonth(),
      date2.getDate()
    );

    // Calculate the difference in time
    const differenceInTime = end - start; // difference in milliseconds

    // Convert the difference from milliseconds to days
    const differenceInDays = differenceInTime / (1000 * 60 * 60 * 24);

    return Math.round(differenceInDays);
  };

  const calculatePriceToPay = (monthlyPrice, numberOfNewUsers) => {
    const currentDate = new Date();
    const expirationDate = new Date(
      currentDate.getFullYear() + 1,
      currentDate.getMonth(),
      currentDate.getDate()
    );

    // const monthlyPrice = userRoleCost.TenantAdmin;
    const dailyPrice = calculateDailyPrice(monthlyPrice);
    const daysBetween = calculateDaysBetween(currentDate, expirationDate);
    let totalPrice = dailyPrice * daysBetween * numberOfNewUsers;
    totalPrice = totalPrice.toFixed(2);

    return parseFloat(totalPrice);
  };

  // const saveNewUsers = async () => {
  //     for (const newUser of requestData.NewUsers) {
  //
  //         let userAppRole = newUser.hasOwnProperty('Group') ? newUser.Group : 'Participant';
  //
  //         let createdUserSub = null;
  //
  //         try {
  //
  //             // user does not already exist
  //
  //             let paramsNewUser = {
  //                 UserPoolId: userPoolID /* required */,
  //                 Username: newUser.email /* required */,
  //                 DesiredDeliveryMediums: ["EMAIL"],
  //                 ForceAliasCreation: false,
  //                 UserAttributes: [
  //                     {
  //                         Name: "given_name",
  //                         Value: newUser.given_name,
  //                     },
  //                     {
  //                         Name: "family_name",
  //                         Value: newUser.family_name,
  //                     },
  //                     {
  //                         Name: "email",
  //                         Value: newUser.email,
  //                     },
  //                     {
  //                         Name: "custom:company",
  //                         Value: newUser['custom:company'],
  //                     },
  //                     {
  //                         Name: "custom:position",
  //                         Value: newUser['custom:position'],
  //                     },
  //                     {
  //                         Name: "phone_number",
  //                         Value: newUser.phone_number,
  //                     },
  //                 ],
  //             };
  //
  //             // create user
  //             const cognitoResponseAdminCreateUser = await CognitoIdentityServiceProvider.adminCreateUser(paramsNewUser).promise();
  //             if (cognitoResponseAdminCreateUser.hasOwnProperty('User')) {
  //
  //                 let userSubObject = cognitoResponseAdminCreateUser.User.Attributes.find((attribute) => attribute.Name === 'sub');
  //
  //                 if (userSubObject !== undefined) {
  //                     createdUserSub = userSubObject.Value;
  //                 }
  //
  //                 // cognitoResponseAdminCreateUser.User.Attributes.forEach((attribute) => {
  //                 //     if (attribute.Name === 'sub') {
  //                 //         createdUserSub = attribute.Value;
  //                 //     }
  //                 // });
  //
  //                 // add user to group
  //                 let paramsAddUserToGroup = {
  //                     GroupName: userAppRole /* required */,
  //                     UserPoolId: userPoolID /* required */,
  //                     Username: cognitoResponseAdminCreateUser.User.Username /* required */,
  //                 }
  //                 await CognitoIdentityServiceProvider.adminAddUserToGroup(paramsAddUserToGroup).promise();
  //
  //
  //                 // make an entry for the new user in treasure chest table
  //                 let paramsTreasureChest = {
  //                     ID: uuid.v4(),
  //                     UserID: createdUserSub,
  //                     Assets: Dynamo.typeConvertorJavascriptToDynamoDB([]),
  //                     TenantID: tenantID,
  //                 }
  //
  //                 await Dynamo.write(paramsTreasureChest, TreasureChestTableName).catch(error => {
  //                     return Responses._500({message: error.message});
  //                 });
  //
  //                 // make an entry for the new user in user preferences table
  //                 let paramsUserPreferences = {
  //                     ID: uuid.v4(),
  //                     UserID: createdUserSub,
  //                     Language: 'en',
  //                     TreasureChestFilters: Dynamo.typeConvertorJavascriptToDynamoDB({
  //                         Types: [],
  //                         Sources: [],
  //                         Tags: []
  //                     }),
  //                     Tags: Dynamo.typeConvertorJavascriptToDynamoDB([]),
  //                     JourneysNotes: Dynamo.typeConvertorJavascriptToDynamoDB([]),
  //                     TenantID: tenantID,
  //                 }
  //
  //                 await Dynamo.write(paramsUserPreferences, UserPreferencesTableName).catch(error => {
  //                     return Responses._500({message: error.message});
  //                 });
  //
  //                 // if facilitator, make entry in the internal currency table
  //                 if (userAppRole === 'Facilitator') {
  //                     let paramsInternalCurrency = {
  //                         ID: uuid.v4(),
  //                         OwnerID: createdUserSub,
  //                         Amount: 0,
  //                         TenantID: tenantID,
  //                     }
  //
  //                     await Dynamo.write(paramsInternalCurrency, InternalCurrencyTableName).catch(error => {
  //                         return Responses._500({message: error.message});
  //                     });
  //                 }
  //
  //             }
  //
  //         } catch (error) {
  //             return Responses._500({message: error.message});
  //         }
  //
  //     }
  // };

  // let addedUsers = [];

  // Cognito generates a temporary password if not specified in params

  const hasRequiredParams = (requestData) => {
    return requestData.hasOwnProperty("NewUsers");
  };

  if (!hasRequiredParams(requestData)) {
    return Responses._400({ message: "Missing required parameters!" });
  }

  // get tenant payment option
  let paramsTenantQuery = {
    TableName: TenantTableName,
    KeyConditionExpression: `#id = :id`,
    ExpressionAttributeNames: {
      "#id": "id",
    },
    ExpressionAttributeValues: {
      ":id": tenantID,
    },
    ScanIndexForward: false,
  };

  const tenantEntry = await dynamoDB.query(paramsTenantQuery).promise();

  if (tenantEntry.Count === 1) {
    paymentOption = tenantEntry.Items[0].paymentOption;
    userRoleCost = tenantEntry.Items[0].userRoleCost;

    let freeTenantAdmins = 0;

    const currentDate = new Date();
    const expirationDate = new Date(
      currentDate.getFullYear() + 1,
      currentDate.getMonth(),
      currentDate.getDate()
    );

    switch (paymentOption) {
      // we do not care about amount for flat rate
      case "FR": {
        for (const newUser of requestData.NewUsers) {
          let userAppRole = newUser.hasOwnProperty("Group")
            ? newUser.Group
            : "Participant";

          let createdUserSub = null;

          let expirationDateBackup = expirationDate.toDateString();

          try {
            // user does not already exist

            let paramsNewUser = {
              UserPoolId: userPoolID /* required */,
              Username: newUser.email /* required */,
              DesiredDeliveryMediums: ["EMAIL"],
              ForceAliasCreation: false,
              UserAttributes: [
                {
                  Name: "given_name",
                  Value: newUser.given_name,
                },
                {
                  Name: "family_name",
                  Value: newUser.family_name,
                },
                {
                  Name: "email",
                  Value: newUser.email,
                },
                {
                  Name: "address",
                  Value: newUser["address"],
                },
                {
                  Name: "custom:position",
                  Value: newUser["custom:position"],
                },
                // {
                //   Name: "phone_number",
                //   Value: newUser.phone_number,
                // },
                {
                  Name: "custom:expiration_date",
                  Value: expirationDateBackup,
                },
              ],
            };

            // create user
            const cognitoResponseAdminCreateUser =
              await CognitoIdentityServiceProvider.adminCreateUser(
                paramsNewUser
              ).promise();
            if (cognitoResponseAdminCreateUser.hasOwnProperty("User")) {
              let userSubObject =
                cognitoResponseAdminCreateUser.User.Attributes.find(
                  (attribute) => attribute.Name === "sub"
                );

              if (userSubObject !== undefined) {
                createdUserSub = userSubObject.Value;
              }

              // add user to group
              let paramsAddUserToGroup = {
                GroupName: userAppRole /* required */,
                UserPoolId: userPoolID /* required */,
                Username:
                  cognitoResponseAdminCreateUser.User.Username /* required */,
              };
              await CognitoIdentityServiceProvider.adminAddUserToGroup(
                paramsAddUserToGroup
              ).promise();

              // make an entry for the new user in treasure chest table
              let paramsTreasureChest = {
                ID: uuid.v4(),
                UserID: createdUserSub,
                Assets: Dynamo.typeConvertorJavascriptToDynamoDB([]),
                TenantID: tenantID,
              };

              await Dynamo.write(
                paramsTreasureChest,
                TreasureChestTableName
              ).catch((error) => {
                return Responses._500({ message: error.message });
              });

              // make an entry for the new user in user preferences table
              let paramsUserPreferences = {
                ID: uuid.v4(),
                UserID: createdUserSub,
                Language: "en",
                TreasureChestFilters: Dynamo.typeConvertorJavascriptToDynamoDB({
                  Types: [],
                  Sources: [],
                  Tags: [],
                }),
                Tags: Dynamo.typeConvertorJavascriptToDynamoDB([]),
                JourneysNotes: Dynamo.typeConvertorJavascriptToDynamoDB([]),
                TenantID: tenantID,
                LastJourneyID: "",
                ExtraAttributes: Dynamo.typeConvertorJavascriptToDynamoDB({}),
              };

              await Dynamo.write(
                paramsUserPreferences,
                UserPreferencesTableName
              ).catch((error) => {
                return Responses._500({ message: error.message });
              });

              // if facilitator, make entry in the internal currency table
              if (
                userAppRole === "TenantAdmin" ||
                userAppRole === "Facilitator"
              ) {
                let paramsInternalCurrency = {
                  ID: uuid.v4(),
                  OwnerID: createdUserSub,
                  Amount: 0,
                  TenantID: tenantID,
                };

                await Dynamo.write(
                  paramsInternalCurrency,
                  InternalCurrencyTableName
                ).catch((error) => {
                  return Responses._500({ message: error.message });
                });
              }
            }
          } catch (error) {
            return Responses._500({ message: error.message });
          }
        }
        return Responses._200({ message: "Users successfully created" });
        break;
      }
      // tenant pays for everything
      case "T":
      case "TF": {
        availableAmount = await getAmountForTenant();

        let numberOfNewUsers = requestData.NewUsers.length;

        let userAppRole = requestData.NewUsers[0].hasOwnProperty("Group")
          ? requestData.NewUsers[0].Group
          : "Participant";

        switch (userAppRole) {
          case "TenantAdmin": {
            // let paramsListUsersByGroup = {
            //   UserPoolId: userPoolID,
            //   GroupName: "TenantAdmin",
            // };
            //
            // const groupResponse =
            //   await CognitoIdentityServiceProvider.listUsersInGroup(
            //     paramsListUsersByGroup
            //   ).promise();


            // first 3 tenant admins are free
            let numberOfMaxFreeTenantAdmins = 3;

            let usersInGroup = await listUsersInGroup(userPoolID, "TenantAdmin");

            let numberOfExistingTenantAdmins = usersInGroup.length;

            if (numberOfExistingTenantAdmins < numberOfMaxFreeTenantAdmins) {
              freeTenantAdmins =
                numberOfMaxFreeTenantAdmins - numberOfExistingTenantAdmins;
              numberOfNewUsers -= freeTenantAdmins;
            }

            priceToPay = calculatePriceToPay(
              userRoleCost.TenantAdmin,
              numberOfNewUsers
            );
            break;
          }
          case "Facilitator": {
            priceToPay = calculatePriceToPay(
              userRoleCost.Facilitator,
              numberOfNewUsers
            );
            break;
          }
          case "Participant": {
            priceToPay = calculatePriceToPay(
              userRoleCost.Participant,
              numberOfNewUsers
            );
            break;
          }
          default: {
            break;
          }
        }

        let difference = availableAmount - priceToPay;
        difference = difference.toFixed(2);
        remainingAmount = parseFloat(difference);

        if (remainingAmount >= 0) {
          let paramsUpdateInternalCurrencyEntry = {
            TableName: InternalCurrencyTableName,
            Key: {
              ID: currencyTableEntryID,
            },
            UpdateExpression: "SET #Amount = :Amount",
            ExpressionAttributeNames: {
              "#Amount": "Amount",
            },
            ExpressionAttributeValues: {
              ":Amount": remainingAmount,
            },
            ReturnValues: "NONE",
          };

          await dynamoDB.update(paramsUpdateInternalCurrencyEntry).promise();

          // after amount was paid, add the new users
          for (const newUser of requestData.NewUsers) {
            let expirationDateBackup = expirationDate.toDateString();

            // if free tenant admins places are taken, user gets expiration date 1 year into the future
            // free tenant admins have null expiration date
            if (newUser.Group === "TenantAdmin" && freeTenantAdmins > 0) {
              expirationDateBackup = "";

              freeTenantAdmins -= 1;
            }

            let createdUserSub = null;

            try {
              // user does not already exist

              let paramsNewUser = {
                UserPoolId: userPoolID /* required */,
                Username: newUser.email /* required */,
                DesiredDeliveryMediums: ["EMAIL"],
                ForceAliasCreation: false,
                UserAttributes: [
                  {
                    Name: "given_name",
                    Value: newUser.given_name,
                  },
                  {
                    Name: "family_name",
                    Value: newUser.family_name,
                  },
                  {
                    Name: "email",
                    Value: newUser.email,
                  },
                  {
                    Name: "address",
                    Value: newUser["address"],
                  },
                  {
                    Name: "custom:position",
                    Value: newUser["custom:position"],
                  },
                  // {
                  //   Name: "phone_number",
                  //   Value: newUser.phone_number,
                  // },
                  {
                    Name: "custom:expiration_date",
                    Value: expirationDateBackup,
                  },
                ],
              };

              // create user
              const cognitoResponseAdminCreateUser =
                await CognitoIdentityServiceProvider.adminCreateUser(
                  paramsNewUser
                ).promise();
              if (cognitoResponseAdminCreateUser.hasOwnProperty("User")) {
                let userSubObject =
                  cognitoResponseAdminCreateUser.User.Attributes.find(
                    (attribute) => attribute.Name === "sub"
                  );

                if (userSubObject !== undefined) {
                  createdUserSub = userSubObject.Value;
                }

                // add user to group
                let paramsAddUserToGroup = {
                  GroupName: userAppRole /* required */,
                  UserPoolId: userPoolID /* required */,
                  Username:
                    cognitoResponseAdminCreateUser.User.Username /* required */,
                };
                await CognitoIdentityServiceProvider.adminAddUserToGroup(
                  paramsAddUserToGroup
                ).promise();

                // make an entry for the new user in treasure chest table
                let paramsTreasureChest = {
                  ID: uuid.v4(),
                  UserID: createdUserSub,
                  Assets: Dynamo.typeConvertorJavascriptToDynamoDB([]),
                  TenantID: tenantID,
                };

                await Dynamo.write(
                  paramsTreasureChest,
                  TreasureChestTableName
                ).catch((error) => {
                  return Responses._500({ message: error.message });
                });

                // make an entry for the new user in user preferences table
                let paramsUserPreferences = {
                  ID: uuid.v4(),
                  UserID: createdUserSub,
                  Language: "en",
                  TreasureChestFilters:
                    Dynamo.typeConvertorJavascriptToDynamoDB({
                      Types: [],
                      Sources: [],
                      Tags: [],
                    }),
                  Tags: Dynamo.typeConvertorJavascriptToDynamoDB([]),
                  JourneysNotes: Dynamo.typeConvertorJavascriptToDynamoDB([]),
                  TenantID: tenantID,
                  ExtraAttributes: Dynamo.typeConvertorJavascriptToDynamoDB({}),
                };

                await Dynamo.write(
                  paramsUserPreferences,
                  UserPreferencesTableName
                ).catch((error) => {
                  return Responses._500({ message: error.message });
                });

                // if tenant admin or facilitator, make entry in the internal currency table
                if (
                  userAppRole === "TenantAdmin" ||
                  userAppRole === "Facilitator"
                ) {
                  let paramsInternalCurrency = {
                    ID: uuid.v4(),
                    OwnerID: createdUserSub,
                    Amount: 0,
                    TenantID: tenantID,
                  };

                  await Dynamo.write(
                    paramsInternalCurrency,
                    InternalCurrencyTableName
                  ).catch((error) => {
                    return Responses._500({ message: error.message });
                  });
                }
              }
            } catch (error) {
              return Responses._500({ message: error.message });
            }
          }

          return Responses._200({ message: "Users successfully created" });
        } else {
          return Responses._500({ message: "Insufficient amount of credits" });
        }

        break;
      }
      case "F": {
        // what happens here???

        break;
      }
      default: {
        break;
      }
    }
  }
};
const deleteUsers = async (event) => {
  console.log("Delete User: " + event);
  let requestData = JSON.parse(event.body);

  const authorizer_context = event.requestContext.authorizer.lambda;

  requestData.UserPoolId = authorizer_context.poolID;
  requestData.CurrentUserId = authorizer_context.username;
  const tenantID = authorizer_context.tenant;

  const hasRequiredParams = (requestData) => {
    return (
      requestData.hasOwnProperty("UserPoolId") &&
      requestData.hasOwnProperty("CurrentUserId") &&
      requestData.hasOwnProperty("DeletedUsers")
    );
  };

  if (!hasRequiredParams(requestData)) {
    return Responses._400({ message: "Missing required parameters!" });
  }

  try {

    for (let DeletedUser of requestData.DeletedUsers) {

      // remove all the links with this user from other participants
      let paramsScanJourneyParticipantRelation = {
        TableName: JourneyParticipantRelationTableName,
        FilterExpression: `#TenantID = :TenantID and (#AuthorID = :DeletedUserID or #ParticipantID = :DeletedUserID)`,
        ExpressionAttributeNames: {
          "#AuthorID": "AuthorID",
          "#ParticipantID": "ParticipantID",
          "#TenantID": "TenantID",
        },
        ExpressionAttributeValues: {
          ":DeletedUserID": DeletedUser.sub,
          ":TenantID": tenantID,
        },
        ProjectionExpression: "ID, JourneyID, AuthorID, ParticipantID",
      };

      let journeyParticipantRelations = [];
      let lastEvaluatedKey = null;

      do {
        const response = await dynamoDB.scan({
          ...paramsScanJourneyParticipantRelation,
          ExclusiveStartKey: lastEvaluatedKey,
        }).promise();

        journeyParticipantRelations = journeyParticipantRelations.concat(response.Items);

        lastEvaluatedKey = response.LastEvaluatedKey;
      } while (lastEvaluatedKey); // Keep scanning until no more data

      if (journeyParticipantRelations !== undefined && journeyParticipantRelations.length > 0) {
        // the links found for this deleted user id
        const foundItems = journeyParticipantRelations;

        // the links in which the deleted user id is a Participant
        const deletedUserIsParticipantInstances = foundItems.filter(
            (item) => item.ParticipantID === DeletedUser.sub
        );
        // the links in which the deleted user id is an Author
        const deletedUserIsAuthorInstances = foundItems.filter(
            (item) => item.AuthorID === DeletedUser.sub
        );

        // delete each item found from Journey Participant Relation Table where deleted user is Participant
        const deletePromisesFromJourneyParticipantRelationTable =
            deletedUserIsParticipantInstances.map((item) => {
              const deleteParams = {
                TableName: JourneyParticipantRelationTableName,
                Key: {
                  ID: item.ID,
                },
              };

              return dynamoDB.delete(deleteParams).promise();
            });

        // update each item found from Journey Participant Relation Table where deleted user is Author
        const updatePromisesFromJourneyParticipantRelationTable =
            deletedUserIsAuthorInstances.map((item) => {
              const updateParams = {
                TableName: JourneyParticipantRelationTableName,
                Key: {
                  ID: item.ID,
                },
                UpdateExpression: "SET #AuthorID = :AuthorID",
                ExpressionAttributeNames: {
                  "#AuthorID": "AuthorID",
                },
                ExpressionAttributeValues: {
                  ":AuthorID": requestData.CurrentUserId,
                },
                ReturnValues: "NONE",
              };

              return dynamoDB.update(updateParams).promise();
            });

        // update each item found from Journey Table where deleted user is Author
        const updatePromisesFromJourneyTable = deletedUserIsAuthorInstances.map(
            (item) => {
              const updateParams = {
                TableName: JourneyTableName,
                Key: {
                  ID: item.JourneyID,
                },
                UpdateExpression: "SET #AuthorID = :AuthorID, #Active = :Active",
                ExpressionAttributeNames: {
                  "#AuthorID": "AuthorID",
                  "#Active": "Active",
                },
                ExpressionAttributeValues: {
                  ":AuthorID": requestData.CurrentUserId,
                  ":Active": false,
                },
                ReturnValues: "NONE",
              };

              return dynamoDB.update(updateParams).promise();
            }
        );

        //
        // // Delete every Journey for which the deleted user was an Author
        // const deletePromisesFromJourneyTable = foundItemsLinkedToJourneysTable.map(item => {
        //     const deleteParams = {
        //         TableName: JourneyTableName,
        //         Key: {
        //             ID: item.JourneyID,
        //         },
        //     };
        //
        //     return dynamoDB.delete(deleteParams).promise();
        // });
        //
        // // Wait for all delete operations to complete
        // await Promise.all(deletePromisesFromJourneyParticipantRelationTable);
        //
        // if (foundItemsLinkedToJourneysTable.length > 0) {
        //     await Promise.all(deletePromisesFromJourneyTable);
        // }

        // Wait for all delete operations to complete
        if (deletedUserIsParticipantInstances.length > 0) {
          await Promise.all(deletePromisesFromJourneyParticipantRelationTable);
        }

        if (deletedUserIsAuthorInstances.length > 0) {
          await Promise.all(updatePromisesFromJourneyParticipantRelationTable);
          await Promise.all(updatePromisesFromJourneyTable);
        }
      }

      // delete the user from cognito user pool
      let paramsAdminDeleteUser = {
        UserPoolId: requestData.UserPoolId,
        Username: DeletedUser.sub,
      };
      await CognitoIdentityServiceProvider.adminDeleteUser(
          paramsAdminDeleteUser
      ).promise();

      // delete user from treasure chest table
      const paramsQueryTreasureChest = {
        TableName: TreasureChestTableName,
        IndexName: "treasureChestGSI",
        KeyConditionExpression: "#UserID = :UserID",
        ExpressionAttributeNames: {
          "#UserID": "UserID",
        },
        ExpressionAttributeValues: {
          ":UserID": DeletedUser.sub,
        },
        ScanIndexForward: false,
      };

      const linkedTreasureChestEntries = await dynamoDB
          .query(paramsQueryTreasureChest)
          .promise();

      if (linkedTreasureChestEntries.Count > 0) {
        const deletePromisesTreasureChest = linkedTreasureChestEntries.Items.map(
            (item) => {
              const paramsDeleteUserTreasureChest = {
                TableName: TreasureChestTableName,
                Key: {
                  ID: item.ID,
                },
              };
              return dynamoDB.delete(paramsDeleteUserTreasureChest).promise();
            }
        );

        await Promise.all(deletePromisesTreasureChest);
      }

      // delete user from user preferences table
      const paramsQueryUserPreferencesTable = {
        TableName: UserPreferencesTableName,
        IndexName: "userPreferencesGSI",
        KeyConditionExpression: "#UserID = :UserID",
        ExpressionAttributeNames: {
          "#UserID": "UserID",
        },
        ExpressionAttributeValues: {
          ":UserID": DeletedUser.sub,
        },
        ScanIndexForward: false,
      };

      const linkedUserPreferencesEntries = await dynamoDB
          .query(paramsQueryUserPreferencesTable)
          .promise();

      if (linkedUserPreferencesEntries.Count > 0) {
        const deletePromisesUserPreferences =
            linkedUserPreferencesEntries.Items.map((item) => {
              const paramsDeleteUserPreferencesEntry = {
                TableName: UserPreferencesTableName,
                Key: {
                  ID: item.ID,
                },
              };
              return dynamoDB.delete(paramsDeleteUserPreferencesEntry).promise();
            });

        await Promise.all(deletePromisesUserPreferences);
      }

      // delete user from treasure chest table

      // check if user has entry
      let paramsInternalCurrencyScan = {
        TableName: InternalCurrencyTableName,
        FilterExpression: `#OwnerID = :OwnerID and #TenantID = :TenantID`,
        ExpressionAttributeNames: {
          "#OwnerID": "OwnerID",
          "#TenantID": "TenantID",
        },
        ExpressionAttributeValues: {
          ":OwnerID": DeletedUser.sub,
          ":TenantID": tenantID,
        },
      };

      const responseInternalCurrencyTableScan = await dynamoDB
          .scan(paramsInternalCurrencyScan)
          .promise();

      if (responseInternalCurrencyTableScan.Count > 0) {
        const deletePromisesInternalCurrency =
            responseInternalCurrencyTableScan.Items.map((item) => {
              const paramsDeleteInternalCurrencyEntry = {
                TableName: InternalCurrencyTableName,
                Key: {
                  ID: item.ID,
                },
              };
              return dynamoDB.delete(paramsDeleteInternalCurrencyEntry).promise();
            });

        await Promise.all(deletePromisesInternalCurrency);
      }


      // delete user picture from S3
      if (DeletedUser.hasOwnProperty('picture') && DeletedUser.picture !== undefined && DeletedUser.picture !== null && DeletedUser.picture !== '') {

        let key = `uploads/${tenantID}/profile/${DeletedUser.picture}`;

        const s3Params = {
          Bucket: S3_BUCKET,
          Key: key,
        };

        await s3.deleteObject(s3Params).promise();
      }

    }

    return Responses._200({ message: "Users deleted successfully" });
  } catch (error) {
    return Responses._500({ message: error.message });
  }
};
const listUsers = async (event) => {

  const authorizer_context = event.requestContext.authorizer.lambda;

  const userPoolID = authorizer_context.poolID;
  const tenantID = authorizer_context.tenant;

  try {

    let allCognitoUsers = await listUsersInUserPool(userPoolID);
    let usersList = [];

    // get all journeys
    let paramsListJourneys = {
      TableName: JourneyTableName,
      FilterExpression: `#TenantID = :TenantID`,
      ExpressionAttributeNames: {
        '#TenantID': 'TenantID', // The column name to filter by
      },
      ExpressionAttributeValues: {
        ':TenantID': tenantID, // The value to filter for
      },
    };

    let journeysList = [];
    let lastEvaluatedKey = null;

    do {
      const response = await dynamoDB.scan({
        ...paramsListJourneys,
        ExclusiveStartKey: lastEvaluatedKey,
      }).promise();

      journeysList = journeysList.concat(response.Items);

      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey); // Keep scanning until no more data

    let allJourneys = [];

    for (const journey of journeysList) {
      allJourneys.push({
        ID: journey.ID,
        Name: journey.Name,
        AuthorID: journey.AuthorID,
      });
    }

    // loop through users
    for (const user of allCognitoUsers) {
      // Specify an array of allowed "Name" values for Attributes
      const attributesToGet = [
        "sub",
        "given_name",
        "family_name",
        "email",
        "picture",
        "address",
        "custom:position",
        // "phone_number",
        "custom:expiration_date",
      ];

      let userObject = {};

      attributesToGet.forEach((attributeName) => {
        let foundAttribute = user.Attributes.find(
          (userAttribute) => userAttribute.Name === attributeName
        );
        userObject[attributeName] =
          foundAttribute !== undefined ? foundAttribute.Value : "";
      });

      // Create an object by reducing the values from the first array
      // let userObject = user.Attributes.reduce((acc, item) => {
      //     // Check if the "Name" is in the allowedNames array before adding to the object
      //     if (attributesToGet.includes(item.Name)) {
      //         acc[item.Name] = item.Value;
      //     }
      //     else {
      //
      //     }
      //     return acc;
      // }, {});

      userObject.Group = null;
      userObject.Journeys = [];
      userObject.UserStatus = user.UserStatus;

      // get groups for user
      let paramsListGroupsForUser = {
        UserPoolId: userPoolID,
        Username: user.Username,
      };

      const cognitoResponseUserGroups =
        await CognitoIdentityServiceProvider.adminListGroupsForUser(
          paramsListGroupsForUser
        ).promise();

      // get the highest priority group
      if (cognitoResponseUserGroups.hasOwnProperty("Groups")) {
        let isTenantAdmin = cognitoResponseUserGroups.Groups.some(
          (group) => group.GroupName === "TenantAdmin"
        );

        if (isTenantAdmin) {
          userObject.Group = "TenantAdmin";
        } else {
          let isFacilitator = cognitoResponseUserGroups.Groups.some(
            (group) => group.GroupName === "Facilitator"
          );

          if (isFacilitator) {
            userObject.Group = "Facilitator";
          } else {
            let isParticipant = cognitoResponseUserGroups.Groups.some(
              (group) => group.GroupName === "Participant"
            );

            if (isParticipant) {
              userObject.Group = "Participant";
            }
          }
        }
        // for (const group of cognitoResponseUserGroups.Groups) {
        //     userObject.Group.push(group.GroupName);
        // }
      }


      // add the journeys for which the user is an author
      allJourneys.forEach((journey) => {
        if (journey.AuthorID === userObject.sub) {
          userObject.Journeys.push({
            ID: journey.ID,
            Name: journey.Name,
          })
        }
      })


      // get the journeys IDs linked to the Participant from pivot table
      let paramsJourneyParticipantRelation = {
        TableName: JourneyParticipantRelationTableName,
        FilterExpression: `#TenantID = :TenantID AND #ParticipantID = :UserID`,
        ExpressionAttributeNames: {
          "#ParticipantID": "ParticipantID",
          "#TenantID": "TenantID",
        },
        ExpressionAttributeValues: {
          ":UserID": userObject.sub,
          ":TenantID": tenantID,
        },
        ProjectionExpression:
            "JourneyID",
      };

      const responseJourneyParticipantRelationTableScan = await dynamoDB
        .scan(paramsJourneyParticipantRelation)
        .promise();

      if (
        responseJourneyParticipantRelationTableScan.hasOwnProperty("Count") &&
        responseJourneyParticipantRelationTableScan.hasOwnProperty("Items") &&
        responseJourneyParticipantRelationTableScan.Count > 0
      ) {

        for (const linkRow of responseJourneyParticipantRelationTableScan.Items) {

          // using the found journeyID, get the name all journeys array
          let linkedJourney = allJourneys.find((journey) => journey.ID === linkRow.JourneyID);

          // skip duplicates, for cases where user is both author and participant
          let alreadyAddedJourney = userObject.Journeys.find((journey) => journey.ID === linkedJourney.ID);

          if (linkedJourney !== undefined && alreadyAddedJourney === undefined) {

            userObject.Journeys.push({
              ID: linkedJourney.ID,
              Name: linkedJourney.Name,
            });
          }
        }
      }

      usersList.push(userObject);
    }

    return Responses._200({ usersList });
  } catch (error) {
    return Responses._500({ message: error.message });
  }
};
const listUsersByRole = async (event) => {
  console.log("List Users By Role: " + event);
  let requestData = JSON.parse(event.body);

  const authorizer_context = event.requestContext.authorizer.lambda;

  requestData.UserPoolId = authorizer_context.poolID;

  const hasRequiredParams = (requestData) => {
    return requestData.hasOwnProperty("Roles");
  };

  if (!hasRequiredParams(requestData)) {
    return Responses._400({ message: "Missing required parameters!" });
  }

  try {
    let users = [];

    for (const role of requestData.Roles) {

      let usersInGroup = await listUsersInGroup(requestData.UserPoolId, role);

      const foundUsers = usersInGroup.map((user) => {

        let userObject = {};

        user.Attributes.forEach((attribute) => {
          if (attribute.Name === "sub") {
            userObject.sub = attribute.Value;
          }
          if (attribute.Name === "given_name") {
            userObject.given_name = attribute.Value;
          }
          if (attribute.Name === "family_name") {
            userObject.family_name = attribute.Value;
          }
          if (attribute.Name === "email") {
            userObject.email = attribute.Value;
          }
        });
        return userObject;
      });

      users = users.concat(foundUsers);
    }

    return Responses._200({ users });
  } catch (error) {
    return Responses._500({ message: error.message });
  }
};
const tenantAdminUpdateUsers = async (event) => {
  console.log("Tenant Admin Update User: " + event);
  let requestData = JSON.parse(event.body);

  const authorizer_context = event.requestContext.authorizer.lambda;
  const userPoolID = authorizer_context.poolID;
  const tenantID = authorizer_context.tenant;

  const hasRequiredParams = (requestData) => {
    return (requestData.hasOwnProperty("UpdatedUsers"));
  };

  if (!hasRequiredParams(requestData)) {
    return Responses._400({ message: "Missing required parameters!" });
  }

  try {

    for (let UpdatedUser of requestData.UpdatedUsers) {

      if (UpdatedUser.hasOwnProperty('sub')) {

        let updateUserParams = {
          UserAttributes: [],
          UserPoolId: authorizer_context.poolID,
          Username: UpdatedUser.sub,
        };

        if (UpdatedUser.hasOwnProperty("given_name")) {
          updateUserParams.UserAttributes.push({
            Name: "given_name",
            Value: UpdatedUser.given_name,
          });
        }
        if (UpdatedUser.hasOwnProperty("family_name")) {
          updateUserParams.UserAttributes.push({
            Name: "family_name",
            Value: UpdatedUser.family_name,
          });
        }
        // if (UpdatedUser.hasOwnProperty("phone_number")) {
        //   updateUserParams.UserAttributes.push({
        //     Name: "phone_number",
        //     Value: UpdatedUser.phone_number,
        //   });
        // }
        if (UpdatedUser.hasOwnProperty("address")) {
          updateUserParams.UserAttributes.push({
            Name: "address",
            Value: UpdatedUser["address"],
          });
        }
        if (UpdatedUser.hasOwnProperty("custom:position")) {
          updateUserParams.UserAttributes.push({
            Name: "custom:position",
            Value: UpdatedUser["custom:position"],
          });
        }

        await CognitoIdentityServiceProvider.adminUpdateUserAttributes(
            updateUserParams
        ).promise();

        if (UpdatedUser.hasOwnProperty("Group")) {
          const getUserParams = {
            UserPoolId: userPoolID,
            Username: UpdatedUser.sub,
          };

          const userData =
              await CognitoIdentityServiceProvider.adminListGroupsForUser(
                  getUserParams
              ).promise();
          const existingGroups = userData.Groups.map((group) => group.GroupName);

          // add to group
          if (!existingGroups.includes(UpdatedUser.Group)) {
            let updateGroupsParams = {
              UserPoolId: userPoolID,
              Username: UpdatedUser.sub,
              GroupName: UpdatedUser.Group,
            };
            await CognitoIdentityServiceProvider.adminAddUserToGroup(
                updateGroupsParams
            ).promise();

            if (UpdatedUser.Group === "TenantAdmin" || UpdatedUser.Group === "Facilitator") {
              let paramsInternalCurrencyScan = {
                TableName: InternalCurrencyTableName,
                FilterExpression: `#OwnerID = :OwnerID and #TenantID = :TenantID`,
                ExpressionAttributeNames: {
                  "#OwnerID": "OwnerID",
                  "#TenantID": "TenantID",
                },
                ExpressionAttributeValues: {
                  ":OwnerID": UpdatedUser.sub,
                  ":TenantID": tenantID,
                },
              };

              const responseInternalCurrencyTableScan = await dynamoDB
                  .scan(paramsInternalCurrencyScan)
                  .promise();

              if (
                  responseInternalCurrencyTableScan.hasOwnProperty("Count") &&
                  responseInternalCurrencyTableScan.hasOwnProperty("Items")
              ) {
                if (responseInternalCurrencyTableScan.Count <= 0) {
                  // user has no entry in Internal Currency Table
                  let paramsInternalCurrency = {
                    ID: uuid.v4(),
                    OwnerID: UpdatedUser.sub,
                    Amount: 0,
                    TenantID: tenantID,
                  };

                  await Dynamo.write(
                      paramsInternalCurrency,
                      InternalCurrencyTableName
                  ).catch((error) => {
                    return Responses._500({message: error.message});
                  });
                } else {
                  // has entry, do nothing
                }
              }
            }
          }

          // remove from other groups
          const groupsToRemove = existingGroups.filter(
              (group) => group !== UpdatedUser.Group
          );
          if (groupsToRemove.length > 0) {
            const removeGroupsParams = {
              UserPoolId: userPoolID,
              Username: UpdatedUser.sub,
            };
            for (const group of groupsToRemove) {
              removeGroupsParams.GroupName = group;
              await CognitoIdentityServiceProvider.adminRemoveUserFromGroup(
                  removeGroupsParams
              ).promise();
            }
          }
        }

        // // Calculate the groups to add and remove
        // const groupsToAdd = newGroups.filter(group => !existingGroups.includes(group));
        // const groupsToRemove = existingGroups.filter(group => !newGroups.includes(group));
        //
        // // Add user to new groups
        // if (groupsToAdd.length > 0) {
        //
        //     let updateGroupsParams = {
        //         UserPoolId: userPoolId,
        //         Username: userSub,
        //     };
        //
        //     for (const group of groupsToAdd) {
        //         updateGroupsParams.GroupName = group;
        //         await CognitoIdentityServiceProvider.adminAddUserToGroup(updateGroupsParams).promise();
        //     }
        //
        // }
        //
        // // Remove user from old groups
        // if (groupsToRemove.length > 0) {
        //
        //     const removeGroupsParams = {
        //         UserPoolId: userPoolId,
        //         Username: userSub,
        //     };
        //
        //     for (const group of groupsToRemove) {
        //         removeGroupsParams.GroupName = group;
        //         await CognitoIdentityServiceProvider.adminRemoveUserFromGroup(removeGroupsParams).promise();
        //     }
        //
        // }
        //
        // return Responses._200({message: 'User roles updated successfully'});
      }

    }

    return Responses._200({ message: "Users successfully updated" });

  } catch (error) {
    return Responses._500({ message: error.message });
  }
};
const verifyUserEmail = async (event) => {
  console.log("Verify User Email: " + event);
  try {
    const authorizer_context = event.requestContext.authorizer.lambda;

    const params = {
      UserAttributes: [
        {
          Name: "email_verified",
          Value: "true",
        },
      ],
      UserPoolId: authorizer_context.poolID,
      Username: authorizer_context.username,
    };

    // Set email_verified attribute to true
    await CognitoIdentityServiceProvider.adminUpdateUserAttributes(
      params
    ).promise();

    return Responses._200({ message: "Email verified successfully" });
  } catch (error) {
    return Responses._500({ message: error.message });
  }
};
const uploadProfileCheck = async (event) => {
  console.log('Upload Profile Check: '+ event);
  try {
    const authorizer_context = event.requestContext.authorizer.lambda;

    // console.log(authorizer_context.clientID);
    // console.log(authorizer_context.poolID);
    // console.log(authorizer_context.tenant);
    // console.log(authorizer_context.username);

    const data = JSON.parse(event.body);
    const validateinput = (fields) => {
      let check = true;
      // list of allowed field to update
      let allowedfields = ["name", "ext"];

      Object.entries(fields).forEach(([key, item]) => {
        if (allowedfields.indexOf(key) == -1) {
          check = false;
        }
      });
      return check;
    };

    let isValid = validateinput(data);
    const Key = `assets/${authorizer_context.tenant}/profile/${data.name}.${data.ext}`;

    if (isValid) {
      // generate signedURL to check file
      // Get signed URL from S3
      const s3Params = {
        Bucket: S3_BUCKET,
        Key: Key,
        // Expires: URL_EXPIRATION_SECONDS,

        // This ACL makes the uploaded object publicly readable. You must also uncomment
        // the extra permission for the Lambda function in the SAM template.

        // ACL: 'public-read'
      };

      console.log("Params: ", s3Params);
      s3.getObject(s3Params, function (err, data) {
        console.log("inside getObject");
        if (err) {
          console.log("ierror");
          console.log(err, err.stack);
          return {
            statusCode: 401,
            body: "Error in HTTP call with details",
          };
          // file does not exist, do something
        } else {
          console.log("file exist");
          console.log(data);
          return {
            statusCode: 200,
            body: "OK",
          };
          //file exist, do something
        }
      });
      const response = await new Promise((resolve, reject) => {
        s3.getObject(s3Params, function (err, data) {
          console.log("inside getObject");
          if (err) {
            console.log("ierror");
            console.log(err, err.stack);
            reject({
              statusCode: 401,
              body: "Error in HTTP call with details",
            });
            // file does not exist, do something
          } else {
            console.log("file exist");
            console.log(data);
            resolve({
              statusCode: 200,
              body: "OK",
            });
            //file exist, do something
          }
        });
        console.log("insige prommis");
      });

      return response;
      console.log("after getObject");
      //   const uploadURL = await s3.getSignedUrlPromise("getObject", s3Params);
      //   console.log("signed URL to check: ", uploadURL);

      //   let dataString = "";

      // return {
      //   statusCode: 401,
      //   body: "Error in HTTP call",
      // };

      //   const response = await new Promise((resolve, reject) => {
      //     const req = https.get(uploadURL, function (res) {
      //       res.on("data", (chunk) => {
      //         dataString += chunk;
      //       });
      //       res.on("end", () => {
      //         resolve({
      //           statusCode: 200,
      //           body: JSON.stringify(JSON.parse(dataString), null, 4),
      //         });
      //       });
      //     });

      //     req.on("error", (e) => {
      //       reject({
      //         statusCode: 417,
      //         body: "Something went wrong!",
      //       });
      //     });
      //   });

      //   return response;
      //   https
      //     .get(uploadURL, (res) => {
      //       let data = [];
      //       const headerDate =
      //         res.headers && res.headers.date
      //           ? res.headers.date
      //           : "no response date";
      //       console.log("Status Code:", res.statusCode);
      //       console.log("Date in Response header:", headerDate);

      //       res.on("data", (chunk) => {
      //         data.push(chunk);
      //       });

      //       res.on("end", () => {
      //         console.log("Response ended: ");
      //         const users = JSON.parse(Buffer.concat(data).toString());

      //         for (user of users) {
      //           console.log(`Got user with id: ${user.id}, name: ${user.name}`);
      //         }
      //       });
      //     })
      //     .on("error", (err) => {
      //       console.log("Error: ", err.message);
      //     });
      //   return {
      //     statusCode: 401,
      //     body: "Error in HTTP call",
      //   };

      //   const request = https
      //     .get(uploadURL, (resp) => {
      //       console.log("HTTPS Get Request startet");
      //       let data = "";

      //       // A chunk of data has been received.
      //       resp.on("data", (chunk) => {
      //         data += chunk;
      //         console.log("HTTPS Get Request get data");
      //       });

      //       // The whole response has been received. Print out the result.
      //       resp.on("end", () => {
      //         console.log("HTTPS Get Request END");
      //         console.log(JSON.parse(data).explanation);
      //         console.log(resp.statusCode);
      //         return {
      //           statusCode: 200,
      //           body: "OK",
      //         };
      //       });
      //     })
      //     .on("error", (err) => {
      //       console.log("HTTPS Get Request END ERROR");
      //       console.log("Error: " + err.message);
      //       console.log(resp.statusCode);
      //       return {
      //         statusCode: 401,
      //         body: "Error in HTTP call",
      //       };
      //     });

      //   const request = http.get(uploadURL, (response) => {
      //     // check if response is success
      //     if (response.statusCode !== 200) {
      //       return {
      //         statusCode: response.statusCode,
      //         body: "Asset Error",
      //       };
      //     } else if (response.statusCode === 200) {
      //       return {
      //         statusCode: response.statusCode,
      //         body: "Asset OK",
      //       };
      //     }
      //   });

      //   // no callback here
      //   const result = await cognitoidentityserviceprovider
      //     .adminUpdateUserAttributes(params)
      //     .promise();
      //   //console.log("success", result);
      //   return {
      //     statusCode: 200,
      //     body: "OK",
      //   };
    } else {
      return {
        statusCode: 400,
        body: "Wrong input Value",
      };
    }
  } catch (error) {
    //sconsole.error("error", error);
    return {
      statusCode: 417,
      body: JSON.stringify(error),
    };
  }
}
const getUserNotifications = async (event) => {
  console.log('Get User Notifications: '+ event);
  let requestData = JSON.parse(event.body);

    // const hasRequiredParams = (requestData) => {
    //     return (requestData.hasOwnProperty('JourneyID'));
    // };
    //
    // if (!hasRequiredParams(requestData)) {
    //     return Responses._400({ message: 'Missing required parameters!' });
    // }

    const authorizer_context = event.requestContext.authorizer.lambda;

    requestData.UserID = authorizer_context.username;
    const tenantID = authorizer_context.tenant;

    try {

        let userNotificationMessages = [];

        let paramsNotificationTableScan = {
            TableName: UserNotificationsTableName,
            FilterExpression: `#UserID = :UserID and #TenantID = :TenantID`,
            ExpressionAttributeNames: {
                '#UserID': 'UserID',
                '#TenantID': 'TenantID',
            },
            ExpressionAttributeValues: {
                ':UserID': requestData.UserID,
                ':TenantID': tenantID,
            },
        }

        const responseNotificationTableScan = await dynamoDB.scan(paramsNotificationTableScan).promise();

        if (responseNotificationTableScan.hasOwnProperty('Count')
            && responseNotificationTableScan.hasOwnProperty('Items')
            && responseNotificationTableScan.Count > 0) {

            userNotificationMessages = responseNotificationTableScan.Items;
        }

        return Responses._200({ userNotificationMessages });


    } catch (error) {
        return Responses._500({ message: error.message });
    }
}
const getUserPreferences = async (event) => {
  console.log('Get User Preferences: '+ event);
  const authorizer_context = event.requestContext.authorizer.lambda;

    let userID = authorizer_context.username;

    try {

        const paramsQuery = {
            TableName: UserPreferencesTableName,
            IndexName: 'userPreferencesGSI',
            KeyConditionExpression: "#UserID = :UserID",
            ExpressionAttributeNames: {
                '#UserID': 'UserID',
            },
            ExpressionAttributeValues: {
                ":UserID": userID
            },
            ScanIndexForward: false,
        };

        const foundEntries = await dynamoDB.query(paramsQuery).promise();

        if (foundEntries.Count === 0) {
            return Responses._200({ userPreferences: [] });
        }

        if (foundEntries.Count === 1) {

          let row = foundEntries.Items[0];

          if (row.hasOwnProperty('TreasureChestFilters')) {
            row.TreasureChestFilters = Dynamo.typeConvertorDynamoDBToJavascript(row.TreasureChestFilters);
          }
          if (row.hasOwnProperty('Tags')) {
            row.Tags = Dynamo.typeConvertorDynamoDBToJavascript(row.Tags);
          }
          if (row.hasOwnProperty('JourneysNotes')) {
            row.JourneysNotes = Dynamo.typeConvertorDynamoDBToJavascript(row.JourneysNotes);
          }
          if (row.hasOwnProperty('ExtraAttributes')) {
            row.ExtraAttributes = Dynamo.typeConvertorDynamoDBToJavascript(row.ExtraAttributes);
          }

            return Responses._200({ userPreferences: row });

        }

        if (foundEntries.Count > 1) {
            return Responses._500({ message: 'Found more that 1 entries in user preferences table' });
        }


    } catch (error) {
        return Responses._500({ message: error.message });
    }

}
const updateJourneysNotes = async (event) => {
  console.log('Update Journeys Notes: '+ event);
  let requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('ID')
            && requestData.hasOwnProperty('JourneysNotes')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        const paramsGet = {
            TableName: UserPreferencesTableName,
            Key: {
                ID: requestData.ID
            }
        };

        const data = await dynamoDB.get(paramsGet).promise();

        if (data.Item) {
            // Entry exists, update it
            const updateParams = {
                TableName: UserPreferencesTableName,
                Key: {
                    ID: requestData.ID
                },
                UpdateExpression: 'SET #JourneysNotes = :JourneysNotes',
                ExpressionAttributeNames: {
                    '#JourneysNotes': 'JourneysNotes'
                },
                ExpressionAttributeValues: {
                    ':JourneysNotes': Dynamo.typeConvertorJavascriptToDynamoDB(requestData.JourneysNotes)
                }
            };

            await dynamoDB.update(updateParams).promise();
            return Responses._200({ message: 'Entry updated successfully' });

        } else {
            return Responses._200({ message: 'User does not have an entry in user preferences table' });
        }


    } catch (error) {
        return Responses._500({ message: error.message });
    }
}
const updateLanguage = async (event) => {
  let requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('ID')
            && requestData.hasOwnProperty('Language')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        const paramsGet = {
            TableName: UserPreferencesTableName,
            Key: {
                ID: requestData.ID
            }
        };

        const data = await dynamoDB.get(paramsGet).promise();

        if (data.Item) {
            // Entry exists, update it
            const updateParams = {
                TableName: UserPreferencesTableName,
                Key: {
                    ID: requestData.ID
                },
                UpdateExpression: 'SET #Language = :Language',
                ExpressionAttributeNames: {
                    '#Language': 'Language'
                },
                ExpressionAttributeValues: {
                    ':Language': requestData.Language
                }
            };

            await dynamoDB.update(updateParams).promise();
            return Responses._200({ message: 'Entry updated successfully' });

        } else {
            return Responses._200({ message: 'User does not have an entry in user preferences table' });
        }


    } catch (error) {
        return Responses._500({ message: error.message });
    }
}
const updateUserExtraAttributes = async (event) => {
  let requestData = JSON.parse(event.body);

  const hasRequiredParams = (requestData) => {
    return (requestData.hasOwnProperty('ID')
        && requestData.hasOwnProperty('ExtraAttributes')
    );
  };

  if (!hasRequiredParams(requestData)) {
    return Responses._400({ message: 'Missing required parameters!' });
  }

  try {

    const paramsGet = {
      TableName: UserPreferencesTableName,
      Key: {
        ID: requestData.ID
      }
    };

    const data = await dynamoDB.get(paramsGet).promise();

    if (data.Item) {
      // Entry exists, update it

       // Entry exists, update it
       let updatedExtraAttributes = requestData.ExtraAttributes;
       // Check if ExtraAttributes exist in the current data
      if (data.Item.ExtraAttributes) {
        // Check if Billing_Stripe_CustomerID exists in the current ExtraAttributes
        let toJavascriptExtraAttributes = Dynamo.typeConvertorDynamoDBToJavascript(data.Item.ExtraAttributes);
        if (toJavascriptExtraAttributes.Billing_Stripe_CustomerID) {
          // Ensure Billing_Stripe_CustomerID is preserved or updated
          updatedExtraAttributes.Billing_Stripe_CustomerID = toJavascriptExtraAttributes.Billing_Stripe_CustomerID;
        }
      }


      const updateParams = {
        TableName: UserPreferencesTableName,
        Key: {
          ID: requestData.ID
        },
        UpdateExpression: 'SET #ExtraAttributes = :ExtraAttributes',
        ExpressionAttributeNames: {
          '#ExtraAttributes': 'ExtraAttributes'
        },
        ExpressionAttributeValues: {
          ':ExtraAttributes': Dynamo.typeConvertorJavascriptToDynamoDB(updatedExtraAttributes)
        }
      };

      await dynamoDB.update(updateParams).promise();
      return Responses._200({ message: 'Entry updated successfully' });

    } else {
      return Responses._200({ message: 'User does not have an entry in user preferences table' });
    }


  } catch (error) {
    return Responses._500({ message: error.message });
  }
}
const updateLastJourneyId = async (event) => {
  console.log('Update Last Journey ID: '+ event);
  let requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('ID')
            && requestData.hasOwnProperty('LastJourneyID')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        const paramsGet = {
            TableName: UserPreferencesTableName,
            Key: {
                ID: requestData.ID
            }
        };

        const data = await dynamoDB.get(paramsGet).promise();

        if (data.Item) {
            // Entry exists, update it
            const updateParams = {
                TableName: UserPreferencesTableName,
                Key: {
                    ID: requestData.ID
                },
                UpdateExpression: 'SET #LastJourneyID = :LastJourneyID',
                ExpressionAttributeNames: {
                    '#LastJourneyID': 'LastJourneyID'
                },
                ExpressionAttributeValues: {
                    ':LastJourneyID': requestData.LastJourneyID
                }
            };

            await dynamoDB.update(updateParams).promise();
            return Responses._200({ message: 'Entry updated successfully' });

        } else {
            return Responses._200({ message: 'User does not have an entry in user preferences table' });
        }


    } catch (error) {
        return Responses._500({ message: error.message });
    }
}
const updateTags = async (event) => {
  console.log('Update Tags: '+ event);
  let requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('ID')
            && requestData.hasOwnProperty('Tags')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        const paramsGet = {
            TableName: UserPreferencesTableName,
            Key: {
                ID: requestData.ID
            }
        };

        const data = await dynamoDB.get(paramsGet).promise();

        if (data.Item) {
            // Entry exists, update it
            const updateParams = {
                TableName: UserPreferencesTableName,
                Key: {
                    ID: requestData.ID
                },
                UpdateExpression: 'SET #Tags = :Tags',
                ExpressionAttributeNames: {
                    '#Tags': 'Tags'
                },
                ExpressionAttributeValues: {
                    ':Tags': Dynamo.typeConvertorJavascriptToDynamoDB(requestData.Tags)
                }
            };

            await dynamoDB.update(updateParams).promise();
            return Responses._200({ message: 'Entry updated successfully' });

        } else {
            return Responses._200({ message: 'User does not have an entry in user preferences table' });
        }


    } catch (error) {
        return Responses._500({ message: error.message });
    }
}
const updateTreasureChestFilters = async (event) => {
  console.log('Update Treasure Chest Filters: '+ event);
  let requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('ID')
            && requestData.hasOwnProperty('TreasureChestFilters')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        const paramsGet = {
            TableName: UserPreferencesTableName,
            Key: {
                ID: requestData.ID
            }
        };

        const data = await dynamoDB.get(paramsGet).promise();

        if (data.Item) {
            // Entry exists, update it
            const updateParams = {
                TableName: UserPreferencesTableName,
                Key: {
                    ID: requestData.ID
                },
                UpdateExpression: 'SET #TreasureChestFilters = :TreasureChestFilters',
                ExpressionAttributeNames: {
                    '#TreasureChestFilters': 'TreasureChestFilters'
                },
                ExpressionAttributeValues: {
                    ':TreasureChestFilters': Dynamo.typeConvertorJavascriptToDynamoDB(requestData.TreasureChestFilters)
                }
            };

            await dynamoDB.update(updateParams).promise();
            return Responses._200({ message: 'Entry updated successfully' });

        } else {
            return Responses._200({ message: 'User does not have an entry in user preferences table' });
        }


    } catch (error) {
        return Responses._500({ message: error.message });
    }

}
const getInternalCurrencyAmount = async (event) => {
  console.log('Get Internal Currency Amount: '+ event);
  const authorizer_context = event.requestContext.authorizer.lambda;
    const tenantID = authorizer_context.tenant;
    const currentUserID = authorizer_context.username;
    const userPoolID = authorizer_context.poolID;

    // let requestData = JSON.parse(event.body);

    // const hasRequiredParams = (requestData) => {
    // };
    //
    // if (!hasRequiredParams(requestData)) {
    //     return Responses._400({ message: 'Missing required parameters!' });
    // }

    const getAmountForTenant = async () => {
        let paramsInternalCurrencyScan = {
            TableName: InternalCurrencyTableName,
            FilterExpression: `#OwnerID = :OwnerID and #TenantID = :TenantID`,
            ExpressionAttributeNames: {
                '#OwnerID': 'OwnerID',
                '#TenantID': 'TenantID',
            },
            ExpressionAttributeValues: {
                ':OwnerID': tenantID,
                ':TenantID': tenantID,
            },
        }

        const responseInternalCurrencyTableScan = await dynamoDB.scan(paramsInternalCurrencyScan).promise();

        if (responseInternalCurrencyTableScan.hasOwnProperty('Count') && responseInternalCurrencyTableScan.hasOwnProperty('Items')) {

            if (responseInternalCurrencyTableScan.Count < 1) {
                return 0;
            }

            if (responseInternalCurrencyTableScan.Count === 1) {
                return responseInternalCurrencyTableScan.Items[0].Amount;
            }

            if (responseInternalCurrencyTableScan.Count > 1) {
                return 0;
            }
        }
    };

    const getAmountForUser = async () => {
        let paramsInternalCurrencyScan = {
            TableName: InternalCurrencyTableName,
            FilterExpression: `#OwnerID = :OwnerID and #TenantID = :TenantID`,
            ExpressionAttributeNames: {
                '#OwnerID': 'OwnerID',
                '#TenantID': 'TenantID',
            },
            ExpressionAttributeValues: {
                ':OwnerID': currentUserID,
                ':TenantID': tenantID,
            },
        }

        const responseInternalCurrencyTableScan = await dynamoDB.scan(paramsInternalCurrencyScan).promise();

        if (responseInternalCurrencyTableScan.hasOwnProperty('Count') && responseInternalCurrencyTableScan.hasOwnProperty('Items')) {

            if (responseInternalCurrencyTableScan.Count < 1) {
                return 0;
            }

            if (responseInternalCurrencyTableScan.Count === 1) {
                return responseInternalCurrencyTableScan.Items[0].Amount;
            }

            if (responseInternalCurrencyTableScan.Count > 1) {
                return 0;
            }
        }
    };

    try {

        let paymentOption = '';
        let userRoleCost = {};

        // get tenant payment option
        let paramsTenantQuery = {
            TableName: TenantTableName,
            KeyConditionExpression: `#id = :id`,
            ExpressionAttributeNames: {
                '#id': 'id',
            },
            ExpressionAttributeValues: {
                ':id': tenantID,
            },
            ScanIndexForward: false,
        }

        const tenantEntry = await dynamoDB.query(paramsTenantQuery).promise();

        if (tenantEntry.Count === 1) {
            paymentOption = tenantEntry.Items[0].paymentOption;
            userRoleCost = tenantEntry.Items[0].userRoleCost;

            switch (paymentOption) {
                // we do not care about amount for flat rate
                case 'FR': {
                    return Responses._200({
                        tenantAmount: null,
                        userAmount: null,
                        userRoleCost: {
                            Participant: 0,
                            Facilitator: 0,
                            TenantAdmin: 0,
                        }
                    });
                }
                // tenant pays for everything
                case 'T': {
                    let tenantAmount = await getAmountForTenant();
                    return Responses._200({
                        tenantAmount: tenantAmount,
                        userAmount: null,
                        userRoleCost
                    });
                }
                case 'TF': {

                    // tenant admins get amount from tenant, facilitators get their own amounts
                    const paramsListGroupsForUser = {
                        UserPoolId: userPoolID,
                        Username: currentUserID
                    };

                    const cognitoResponseUserGroups = await CognitoIdentityServiceProvider.adminListGroupsForUser(paramsListGroupsForUser).promise();

                    if (cognitoResponseUserGroups.hasOwnProperty('Groups')) {

                        let tenantAmount = await getAmountForTenant();
                        let userAmount = null;

                        let isTenantAdmin = cognitoResponseUserGroups.Groups.some((group) => group.GroupName === 'TenantAdmin');
                        let isFacilitator = cognitoResponseUserGroups.Groups.some((group) => group.GroupName === 'Facilitator');

                        if (isTenantAdmin || isFacilitator) {
                            userAmount = await getAmountForUser();
                        }
                        return Responses._200({
                            tenantAmount: tenantAmount,
                            userAmount: userAmount,
                            userRoleCost
                        });

                    }

                    break;
                }
                case 'F': {
                    // to be developed

                    break;
                }
                default: {

                    break;
                }
            }

        }


    } catch (error) {
        return Responses._500({ message: error.message });
    }
}
const transferUserCommovisCredits = async (event) => {

  const authorizer_context = event.requestContext.authorizer.lambda;
  const tenantID = authorizer_context.tenant;
  const currentUserID = authorizer_context.username;

  let requestData = JSON.parse(event.body);

  const hasRequiredParams = (requestData) => {
    return (requestData.hasOwnProperty('ReceiverUserID')
            && requestData.hasOwnProperty('ReceiverUserFullName')
            && requestData.hasOwnProperty('SenderUserFullName')
            && requestData.hasOwnProperty('NumberOfTransferredCommovisCredits')
    );
  };

  if (!hasRequiredParams(requestData)) {
    return Responses._400({ message: 'Missing required parameters!' });
  }

  const numberOfTransferredCommovisCredits = requestData.NumberOfTransferredCommovisCredits;

  try {
    // get sender Internal Currency row
    let paramsSenderInternalCurrencyScan = {
      TableName: InternalCurrencyTableName,
      FilterExpression: `#OwnerID = :OwnerID and #TenantID = :TenantID`,
      ExpressionAttributeNames: {
        '#OwnerID': 'OwnerID',
        '#TenantID': 'TenantID',
      },
      ExpressionAttributeValues: {
        ':OwnerID': currentUserID,
        ':TenantID': tenantID,
      },
    };
    const responseSenderInternalCurrencyTableScan = await dynamoDB.scan(paramsSenderInternalCurrencyScan).promise();


    // get receiver Internal Currency row
    let paramsReceiverInternalCurrencyScan = {
      TableName: InternalCurrencyTableName,
      FilterExpression: `#OwnerID = :OwnerID and #TenantID = :TenantID`,
      ExpressionAttributeNames: {
        '#OwnerID': 'OwnerID',
        '#TenantID': 'TenantID',
      },
      ExpressionAttributeValues: {
        ':OwnerID': requestData.ReceiverUserID,
        ':TenantID': tenantID,
      },
    };
    const responseReceiverInternalCurrencyTableScan = await dynamoDB.scan(paramsReceiverInternalCurrencyScan).promise();

    if (responseSenderInternalCurrencyTableScan.hasOwnProperty('Count') && responseSenderInternalCurrencyTableScan.hasOwnProperty('Items')
        && responseReceiverInternalCurrencyTableScan.hasOwnProperty('Count') && responseReceiverInternalCurrencyTableScan.hasOwnProperty('Items')) {

      if (responseSenderInternalCurrencyTableScan.Count < 1 || responseReceiverInternalCurrencyTableScan.Count < 1) {
        return Responses._500({message: 'No entry entry found in the Internal Currency Table'});
      }

      if (responseSenderInternalCurrencyTableScan.Count === 1 && responseReceiverInternalCurrencyTableScan.Count === 1) {

        let senderCurrencyTableEntryID = responseSenderInternalCurrencyTableScan.Items[0].ID;
        let senderAvailableAmount = responseSenderInternalCurrencyTableScan.Items[0].Amount;

        let receiverCurrencyTableEntryID = responseReceiverInternalCurrencyTableScan.Items[0].ID;
        let receiverAvailableAmount = responseReceiverInternalCurrencyTableScan.Items[0].Amount;

        if ((senderAvailableAmount >= numberOfTransferredCommovisCredits) && numberOfTransferredCommovisCredits >= 1) {

          // subtract transferred amount from sender user
          let newSenderAmount = senderAvailableAmount - numberOfTransferredCommovisCredits;

          let paramsUpdateSenderInternalCurrencyEntry = {
            TableName: InternalCurrencyTableName,
            Key: {
              ID: senderCurrencyTableEntryID,
            },
            UpdateExpression: "SET #Amount = :Amount",
            ExpressionAttributeNames: {
              "#Amount": "Amount",
            },
            ExpressionAttributeValues: {
              ":Amount": newSenderAmount,
            },
            ReturnValues: "NONE",
          };

          await dynamoDB.update(paramsUpdateSenderInternalCurrencyEntry).promise();


          // add transferred amount to receiver user
          let newReceiverAmount = receiverAvailableAmount + numberOfTransferredCommovisCredits;

          let paramsUpdateReceiverInternalCurrencyEntry = {
            TableName: InternalCurrencyTableName,
            Key: {
              ID: receiverCurrencyTableEntryID,
            },
            UpdateExpression: "SET #Amount = :Amount",
            ExpressionAttributeNames: {
              "#Amount": "Amount",
            },
            ExpressionAttributeValues: {
              ":Amount": newReceiverAmount,
            },
            ReturnValues: "NONE",
          };

          await dynamoDB.update(paramsUpdateReceiverInternalCurrencyEntry).promise();

          // add transfer to Internal Currency Transfers Table

          let paramsAddTransfer = {
            ID: uuid.v4(),
            SenderUserID: currentUserID,
            SenderUserFullName: requestData.SenderUserFullName,
            SenderBalance: newSenderAmount,
            ReceiverUserID: requestData.ReceiverUserID,
            ReceiverUserFullName: requestData.ReceiverUserFullName,
            ReceiverBalance: newReceiverAmount,
            Amount: numberOfTransferredCommovisCredits,
            Date: new Date().toISOString(),
            TenantID: tenantID,
          };

          await Dynamo.write(
              paramsAddTransfer,
              InternalCurrencyTransfersTableName
          ).catch((error) => {
            return Responses._500({ message: error.message });
          });

          // send notification to receiver user
          let paramsAddNotification = {
            ID: uuid.v4(),
            UserID: requestData.ReceiverUserID,
            Message: `You got ${numberOfTransferredCommovisCredits} CC from ${requestData.SenderUserFullName}`,
            TenantID: tenantID,
          }

          await Dynamo.write(paramsAddNotification, UserNotificationsTableName).catch(error => {
            return Responses._500({ message: error.message });
          });

          return Responses._200({message: 'Transfer CCs done successfully'});

        }
        else {
          return Responses._500({message: 'Provided data for the transfer are not valid. Please add minimum 1 CC and a transfer amount within your available amount.'});
        }

      }

      if (responseSenderInternalCurrencyTableScan.Count > 1 || responseReceiverInternalCurrencyTableScan.Count > 1) {
        return Responses._500({message: 'More than 1 entry found in the Internal Currency Table'});
      }

    }
    else {
      return Responses._500({message: 'No Items found in Internal Currency Table'});
    }
  }
  catch (error) {
    return Responses._500({ message: error.message });
  }

}
const getUserInternalCurrencyTransfers = async (event) => {

  const authorizer_context = event.requestContext.authorizer.lambda;
  const tenantID = authorizer_context.tenant;
  const currentUserID = authorizer_context.username;

  try {

    let userInternalCurrencyTransfers = [];

    let paramsGetUserInternalCurrencyTransfers = {
      TableName: InternalCurrencyTransfersTableName,
      IndexName: 'TenantID-Date-Index',
      KeyConditionExpression: '#TenantID = :TenantID',
      FilterExpression: '#SenderUserID = :SenderUserID OR #ReceiverUserID = :ReceiverUserID',
      ExpressionAttributeNames: {
        '#TenantID': 'TenantID',
        '#SenderUserID': 'SenderUserID',
        '#ReceiverUserID': 'ReceiverUserID',
      },
      ExpressionAttributeValues: {
        ':TenantID': tenantID,
        ':SenderUserID': currentUserID,
        ':ReceiverUserID': currentUserID,
      },
    }

    let response = await dynamoDB.query(paramsGetUserInternalCurrencyTransfers).promise();

    response.Items.forEach((item) => {

      if (currentUserID === item.SenderUserID) {
        item.Amount = -item.Amount;
        item.TransactionType = 'OUTGOING_CUSTOMER_TRANSFER';
      }

      if (currentUserID === item.ReceiverUserID) {
        item.TransactionType = 'INCOME_CUSTOMER_TRANSFER';
      }

      userInternalCurrencyTransfers.push(item);

    });

    return Responses._200({
      userInternalCurrencyTransfers: userInternalCurrencyTransfers,
    });

  }
  catch (error) {
    return Responses._500({ message: error.message });
  }

}
// const getPaymentLink = async (event) => {

//   let requestData = JSON.parse(event.body);

//   const authorizer_context = event.requestContext.authorizer.lambda;
//   const tenantID = authorizer_context.tenant;
//   const currentUserID = authorizer_context.username;

//   const hasRequiredParams = (requestData) => {
//     return (requestData.hasOwnProperty('NumberOfCredits')
//         && requestData.hasOwnProperty('RedirectLinkSuccess')
//         && requestData.hasOwnProperty('RedirectLinkCancel')
//         && requestData.hasOwnProperty('TenantLink')
//         && requestData.NumberOfCredits !== 'number'
//     );
//   };

//   if (!hasRequiredParams(requestData)) {
//     return Responses._400({ message: 'Missing required parameters!' });
//   }

//   try {

//     const paramsQueryUserPreferencesTable = {
//       TableName: UserPreferencesTableName,
//       IndexName: "userPreferencesGSI",
//       KeyConditionExpression: "#UserID = :UserID",
//       ExpressionAttributeNames: {
//         "#UserID": "UserID",
//       },
//       ExpressionAttributeValues: {
//         ":UserID": currentUserID
//       },
//       ScanIndexForward: false,
//     };

//     const linkedUserPreferencesEntries = await dynamoDB
//         .query(paramsQueryUserPreferencesTable)
//         .promise();

//     if (linkedUserPreferencesEntries.Count < 0) {
//       return Responses._500({message: 'No user preferences found.'})
//     }

//     if (linkedUserPreferencesEntries.Count === 1) {

//       let userPreferencesRow = linkedUserPreferencesEntries.Items[0];

//       if (userPreferencesRow.hasOwnProperty('ExtraAttributes')) {
//         let userExtraAttributes = Dynamo.typeConvertorDynamoDBToJavascript(userPreferencesRow.ExtraAttributes);

//         // found billing country => success
//         if (userExtraAttributes.hasOwnProperty('Billing_Country')) {

//           let euroExchangeRate = null;
//           let numberOfCredits = requestData.NumberOfCredits;

//           const paramsGetTenant = {
//             TableName: TenantTableName,
//             KeyConditionExpression: "#id = :id",
//             ExpressionAttributeNames: {
//               '#id': 'id',
//             },
//             ExpressionAttributeValues: {
//               ":id": tenantID
//             },
//             ScanIndexForward: false,
//           };

//           const foundTenant = await dynamoDB.query(paramsGetTenant).promise();

//           if (foundTenant.Count === 0) {
//             return Responses._500({ message: 'No tenant found' });
//           }

//           if (foundTenant.Count === 1) {

//             let tenant = foundTenant.Items[0];

//             euroExchangeRate = tenant.euroExchangeRate;

//             let total = (euroExchangeRate * 100).toFixed(0);

//             if (userExtraAttributes.Billing_Country === 'Austria') {
//               const session = await stripe.checkout.sessions.create({
//                 payment_method_types: ['card'],
//                 line_items: [
//                   {
//                     price_data: {
//                       currency: 'eur',
//                       product_data: {
//                         name: `Commovis Credits / ${requestData.TenantLink}`,
//                       },
//                       unit_amount: total,
//                     },
//                     quantity: numberOfCredits,
//                     tax_rates: ['txr_1Py7gG2NDssX4TmfuNhS4w9c'], // Replace with your Austria tax rate ID
//                   },
//                 ],
//                 mode: 'payment',
//                 success_url: requestData.RedirectLinkSuccess,
//                 cancel_url: requestData.RedirectLinkCancel,
//                 metadata: {
//                   is_completed: 'false',  // Set is_completed to 'false' initially
//                 },
//               });

//               return Responses._200({
//                 URL: session.url,
//               });

//             }

//             else {
//               const session = await stripe.checkout.sessions.create({
//                 payment_method_types: ['card'],
//                 line_items: [
//                   {
//                     price_data: {
//                       currency: 'eur',
//                       product_data: {
//                         name: `Commovis Credits / ${requestData.TenantLink}`,
//                       },
//                       unit_amount: total,
//                     },
//                     quantity: numberOfCredits,
//                   },
//                 ],
//                 mode: 'payment',
//                 success_url: requestData.RedirectLinkSuccess,
//                 cancel_url: requestData.RedirectLinkCancel,
//                 metadata: {
//                   is_completed: 'false',  // Set is_completed to 'false' initially
//                 },
//               });

//               return Responses._200({
//                 URL: session.url,
//               });

//             }

//           }

//           if (foundTenant.Count > 1) {
//             return Responses._500({ message: 'More than 1 tenant found with ID' });
//           }

//         }
//         else {
//           return Responses._500({message: 'No billing country set.'});
//         }

//       }
//       else {
//         return Responses._500({message: 'No user preferences extra attributes found'});
//       }
//     }

//     if (linkedUserPreferencesEntries.Count > 1) {
//       return Responses._500({message: 'More than 1 user preferences found.'});
//     }

//   }

//   catch (error) {
//     return Responses._500({ message: error.message });
//   }

// }
// const onPaymentSuccess = async (event) => {

//   let requestData = JSON.parse(event.body);

//   const authorizer_context = event.requestContext.authorizer.lambda;
//   const tenantID = authorizer_context.tenant;
//   const currentUserID = authorizer_context.username;
//   const userPoolID = authorizer_context.poolID;
//   let currentUserObject = {
//     family_name: '',
//     given_name: '',
//     email: '',
//   };
//   const hasRequiredParams = (requestData) => {
//     return (requestData.hasOwnProperty('SessionID')
//         && requestData.hasOwnProperty('FromPage')
//         && requestData.hasOwnProperty('InvoiceItemsAmount')
//         && requestData.hasOwnProperty('InvoiceItemsCountry')
//         && requestData.hasOwnProperty('TenantLink')
//     );
//   };

//   if (!hasRequiredParams(requestData)) {
//     return Responses._400({ message: 'Missing required parameters!' });
//   }

//   try {

//     let invoiceItemsAmount = requestData.InvoiceItemsAmount;
//     let invoiceItemsCountry = requestData.InvoiceItemsCountry;

//     let customerId = null;

//     const session = await stripe.checkout.sessions.retrieve(requestData.SessionID);

//     // check needed if user has the success link with sessionID
//     if (session.metadata.is_completed === 'false') {

//       await stripe.checkout.sessions.update(requestData.SessionID, {
//         metadata: {
//           is_completed: 'true',  // Set is_completed to 'true'
//         },
//       });

//       if (session.payment_status === 'paid') { // payment successful

//         // get current user
//         let paramsAdminGetUser = {
//           UserPoolId: userPoolID,
//           Username: currentUserID,
//         };
//         const cognitoResponseAdminGetUser = await CognitoIdentityServiceProvider.adminGetUser(paramsAdminGetUser).promise();
//         let attributesToGet = ["family_name", "given_name", "email"];
//         // Create an object by reducing the values from the attributes array
//         currentUserObject = cognitoResponseAdminGetUser.UserAttributes.reduce((acc, item) => {
//           // Check if the "Name" is in the allowedNames array before adding to the object
//           if (attributesToGet.includes(item.Name)) {
//             acc[item.Name] = item.Value;
//           }
//           return acc;
//         }, {});


//         // get current user preferences extra attributes billing
//         const paramsQueryUserPreferencesTable = {
//           TableName: UserPreferencesTableName,
//           IndexName: "userPreferencesGSI",
//           KeyConditionExpression: "#UserID = :UserID",
//           ExpressionAttributeNames: {
//             "#UserID": "UserID",
//           },
//           ExpressionAttributeValues: {
//             ":UserID": currentUserID
//           },
//           ScanIndexForward: false,
//         };

//         const linkedUserPreferencesEntries = await dynamoDB
//             .query(paramsQueryUserPreferencesTable)
//             .promise();

//         if (linkedUserPreferencesEntries.Count < 0) {
//           return Responses._500({message: 'No user preferences found.'})
//         }

//         if (linkedUserPreferencesEntries.Count === 1) {

//           let userPreferencesRow = linkedUserPreferencesEntries.Items[0];

//           if (userPreferencesRow.hasOwnProperty('ExtraAttributes')) {
//             let userExtraAttributes = Dynamo.typeConvertorDynamoDBToJavascript(userPreferencesRow.ExtraAttributes);

//             // found billing country => success
//             if (userExtraAttributes.hasOwnProperty('Billing_Country')) {

//               const existingCustomers = await stripe.customers.search({
//                 query: 'email:\'' + currentUserObject.email + '\'',
//               });

//               // check customer
//               if (existingCustomers.data.length > 0) {
//                 // update customer
//                 customerId = existingCustomers.data[0].id;
//                 const customer = await stripe.customers.update(
//                     customerId,
//                     {
//                       address: {
//                         country: userExtraAttributes.Billing_Country,
//                         city: userExtraAttributes.hasOwnProperty('Billing_City') ? userExtraAttributes.Billing_City : '',
//                         line1: userExtraAttributes.hasOwnProperty('Billing_AddressLine1') ? userExtraAttributes.Billing_AddressLine1 : '',
//                         line2: userExtraAttributes.hasOwnProperty('Billing_AddressLine2') ? userExtraAttributes.Billing_AddressLine2 : '',
//                         postal_code: userExtraAttributes.hasOwnProperty('Billing_PostalCode') ? userExtraAttributes.Billing_PostalCode : '',
//                         state: userExtraAttributes.hasOwnProperty('Billing_Province') ? userExtraAttributes.Billing_Province : '',
//                       }
//                     }
//                 );
//               } else {
//                 // Step 1: Create the Stripe customer
//                 const customer = await stripe.customers.create({
//                   name: `${currentUserObject.family_name} ${currentUserObject.given_name}`,
//                   email: currentUserObject.email,
//                   address: {
//                     country: userExtraAttributes.Billing_Country,
//                     city: userExtraAttributes.hasOwnProperty('Billing_City') ? userExtraAttributes.Billing_City : '',
//                     line1: userExtraAttributes.hasOwnProperty('Billing_AddressLine1') ? userExtraAttributes.Billing_AddressLine1 : '',
//                     line2: userExtraAttributes.hasOwnProperty('Billing_AddressLine2') ? userExtraAttributes.Billing_AddressLine2 : '',
//                     postal_code: userExtraAttributes.hasOwnProperty('Billing_PostalCode') ? userExtraAttributes.Billing_PostalCode : '',
//                     state: userExtraAttributes.hasOwnProperty('Billing_Province') ? userExtraAttributes.Billing_Province : '',
//                   }
//                 });
//                 customerId = customer.id
//               }

//               // start invoice creation process
//               if (invoiceItemsCountry === 'Austria') {
//                 // Create the invoice item with tax rate, without metadata
//                 await stripe.invoiceItems.create({
//                   customer: customerId,
//                   amount: Number(invoiceItemsAmount),
//                   currency: 'eur',
//                   description: 'COMMOVIS Credits | ' + requestData.TenantLink,
//                   tax_rates: ['txr_1Py7gG2NDssX4TmfuNhS4w9c'], // Apply tax rate here
//                 });

//                 const invoice = await stripe.invoices.create({ //gets the invoice items created previously to the customer
//                   customer: customerId,
//                   currency: 'eur',
//                   collection_method: 'send_invoice',
//                   //days_until_due: 30,
//                   auto_advance: false,  // Auto-finalizes the invoice
//                 });

//                 await stripe.invoices.finalizeInvoice(invoice.id);

//                 await stripe.invoices.sendInvoice(invoice.id);

//               }
//               else {

//                 // Create the invoice item without tax rate, with metadata
//                 await stripe.invoiceItems.create({
//                   customer: customerId,
//                   amount: Number(invoiceItemsAmount),
//                   currency: 'eur',
//                   description: 'COMMOVIS Credits | ' + requestData.TenantLink,
//                 });

//                 // Create the invoice
//                 const invoice = await stripe.invoices.create({ //gets the invoice items created previously to the customer
//                   customer: customerId,
//                   currency: 'eur',
//                   collection_method: 'send_invoice',
//                   //days_until_due: 30,
//                   footer: 'Reverse Charge. The tax liability is transferred to the recipient.',
//                   auto_advance: false,  // Auto-finalizes the invoice
//                 });

//                 await stripe.invoices.finalizeInvoice(invoice.id);

//                 await stripe.invoices.sendInvoice(invoice.id);

//               }

//             }
//             else {
//               return Responses._500({message: 'No billing country set.'});
//             }

//           }
//           else {
//             return Responses._500({message: 'No user preferences extra attributes found'});
//           }
//         }

//         if (linkedUserPreferencesEntries.Count > 1) {
//           return Responses._500({message: 'More than 1 user preferences found.'});
//         }



//         // start the add CCs to the database process
//         const paramsGetTenant = {
//           TableName: TenantTableName,
//           KeyConditionExpression: "#id = :id",
//           ExpressionAttributeNames: {
//             '#id': 'id',
//           },
//           ExpressionAttributeValues: {
//             ":id": tenantID
//           },
//           ScanIndexForward: false,
//         };

//         const foundTenant = await dynamoDB.query(paramsGetTenant).promise();

//         if (foundTenant.Count === 0) {
//           return Responses._500({ message: 'No tenant found' });
//         }

//         if (foundTenant.Count === 1) {
//           let tenant = foundTenant.Items[0];
//           let euroExchangeRate = tenant.euroExchangeRate;

//           const ccAmountTotalEuro = session.amount_total / 100;
//           let amount_to_add = ccAmountTotalEuro / euroExchangeRate;

//           switch (requestData.FromPage) {

//             case 'Admin': {
//               // await updateAmount(tenantID, amount_to_add);

//               let paramsInternalCurrencyScan = {
//                 TableName: InternalCurrencyTableName,
//                 FilterExpression: `#OwnerID = :OwnerID and #TenantID = :TenantID`,
//                 ExpressionAttributeNames: {
//                   '#OwnerID': 'OwnerID',
//                   '#TenantID': 'TenantID',
//                 },
//                 ExpressionAttributeValues: {
//                   ':OwnerID': tenantID,
//                   ':TenantID': tenantID,
//                 },
//               }

//               const responseInternalCurrencyTableScan = await dynamoDB.scan(paramsInternalCurrencyScan).promise();

//               if (responseInternalCurrencyTableScan.hasOwnProperty('Count') && responseInternalCurrencyTableScan.hasOwnProperty('Items')) {

//                 if (responseInternalCurrencyTableScan.Count < 1) {
//                   return Responses._500({message: 'No entry found in the Internal Currency Table'});
//                 }

//                 if (responseInternalCurrencyTableScan.Count === 1) {

//                   let internalCurrencyTableRow = responseInternalCurrencyTableScan.Items[0];

//                   let updatedAmount = internalCurrencyTableRow.Amount + amount_to_add;

//                   let paramsUpdateInternalCurrencyTable = {
//                     TableName: InternalCurrencyTableName,
//                     Key: {
//                       ID: internalCurrencyTableRow.ID,
//                     },
//                     UpdateExpression: 'SET #Amount = :Amount',
//                     ExpressionAttributeNames: {
//                       '#Amount': 'Amount',
//                     },
//                     ExpressionAttributeValues: {
//                       ':Amount': updatedAmount,
//                     },
//                     ReturnValues: 'NONE',
//                   };

//                   await dynamoDB.update(paramsUpdateInternalCurrencyTable).promise();

//                 }

//                 if (responseInternalCurrencyTableScan.Count > 1) {
//                   return Responses._500({message: 'More than 1 entry found in the Internal Currency Table'});
//                 }
//               }
//               break;
//             }
//             case 'Account': {
//               // await updateAmount(currentUserID, amount_to_add);

//               let paramsInternalCurrencyScan = {
//                 TableName: InternalCurrencyTableName,
//                 FilterExpression: `#OwnerID = :OwnerID and #TenantID = :TenantID`,
//                 ExpressionAttributeNames: {
//                   '#OwnerID': 'OwnerID',
//                   '#TenantID': 'TenantID',
//                 },
//                 ExpressionAttributeValues: {
//                   ':OwnerID': currentUserID,
//                   ':TenantID': tenantID,
//                 },
//               }

//               const responseInternalCurrencyTableScan = await dynamoDB.scan(paramsInternalCurrencyScan).promise();

//               if (responseInternalCurrencyTableScan.hasOwnProperty('Count') && responseInternalCurrencyTableScan.hasOwnProperty('Items')) {

//                 if (responseInternalCurrencyTableScan.Count < 1) {
//                   return Responses._500({message: 'No entry found in the Internal Currency Table'});
//                 }

//                 if (responseInternalCurrencyTableScan.Count === 1) {

//                   let internalCurrencyTableRow = responseInternalCurrencyTableScan.Items[0];

//                   let updatedAmount = internalCurrencyTableRow.Amount + amount_to_add;

//                   let paramsUpdateInternalCurrencyTable = {
//                     TableName: InternalCurrencyTableName,
//                     Key: {
//                       ID: internalCurrencyTableRow.ID,
//                     },
//                     UpdateExpression: 'SET #Amount = :Amount',
//                     ExpressionAttributeNames: {
//                       '#Amount': 'Amount',
//                     },
//                     ExpressionAttributeValues: {
//                       ':Amount': updatedAmount,
//                     },
//                     ReturnValues: 'NONE',
//                   };

//                   await dynamoDB.update(paramsUpdateInternalCurrencyTable).promise();

//                 }

//                 if (responseInternalCurrencyTableScan.Count > 1) {
//                   return Responses._500({message: 'More than 1 entry found in the Internal Currency Table'});
//                 }
//               }
//               break;
//             }
//             default: {
//               return Responses._500({ message: 'Failed on where to add the amount' });
//             }
//           }

//           return Responses._200({
//             amount_to_add: amount_to_add,
//           })

//         }

//         if (foundTenant.Count > 1) {
//           return Responses._500({ message: 'More than 1 tenant found with ID' });
//         }

//       }

//     }

//     else {
//       return Responses._200({
//         redirect: true,
//       })
//     }

//   }

//   catch (error) {
//     return Responses._500({ message: error.message });
//   }

// }
const resendUsersTemporaryPassword = async (event) => {

  let requestData = JSON.parse(event.body);

  const authorizer_context = event.requestContext.authorizer.lambda;
  const userPoolID = authorizer_context.poolID;

  try {

    // reset temporary password to specific users
    if (requestData.hasOwnProperty('UsersEmails')) {

      for (const userEmail of requestData.UsersEmails) {
        const paramsCreateUser = {
          UserPoolId: userPoolID,
          Username: userEmail,
          MessageAction: 'RESEND'
        };
        await CognitoIdentityServiceProvider.adminCreateUser(paramsCreateUser).promise();
      }
    }
    // reset temporary password to all users that still need to change their temporary password
    else {

      // get all users that did not change their temporary password
      let users = [];
      let responseGetUsers;

      const paramsListUsers = {
        UserPoolId: userPoolID,
        Filter: 'cognito:user_status = "FORCE_CHANGE_PASSWORD"',
      };

      do {
        responseGetUsers = await cognitoidentityserviceproviderDirect.listUsers(paramsListUsers).promise();
        users = users.concat(responseGetUsers.Users);
        paramsListUsers.PaginationToken = responseGetUsers.PaginationToken;
      } while (responseGetUsers.PaginationToken);

      for (const user of users) {

        if (user.hasOwnProperty('Attributes')) {

          let foundAttribute = user.Attributes.find((userAttribute) => userAttribute.Name === 'email');

          if (foundAttribute !== undefined) {

            const paramsCreateUser = {
              UserPoolId: userPoolID,
              Username: foundAttribute.Value,
              MessageAction: 'RESEND'
            };

            await CognitoIdentityServiceProvider.adminCreateUser(paramsCreateUser).promise();

          }

        }

      }

    }

    return Responses._200({
      message: 'User temporary password successfully resent',
    });

  }
  catch (error) {
    return Responses._500({ message: error.message });
  }

}

// const customerManage = async (event) => {
//   console.log("Customer Manage: " + event);
//   const data = JSON.parse(event.body);
//   const authorizer_context = event.requestContext.authorizer.lambda;

//   const getTaxIdType = (countryCode) => {
//     const countryTaxIdMap = {
//       'AU': 'au_abn',
//       'BR': 'br_cnpj',
//       'GB': 'gb_vat',
//       'IN': 'in_gst',
//       'JP': 'jp_cn',
//       'KR': 'kr_brn',
//       'MX': 'mx_rfc',
//       'NO': 'no_vat',
//       'NZ': 'nz_gst',
//       'RU': 'ru_inn',
//       'SA': 'sa_vat',
//       'SG': 'sg_gst',
//       'TH': 'th_vat',
//       'TW': 'tw_vat',
//       'US': 'us_ein',
//       'ZA': 'za_vat',
//     };

//     // Default to EU VAT for European countries not explicitly listed
//     const euCountries = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'];

//     if (euCountries.includes(countryCode)) {
//       return 'eu_vat';
//     }

//     return countryTaxIdMap[countryCode] || 'eu_vat'; // Default to EU VAT if country not found
//   };


//   try {
//     const customerData = {
//       email: data.email,
//       name: data.companyName,
//       address: {
//         country: data.country,
//         city: data.city || '',
//         line1: data.address1 || '',
//         line2: data.address2 || '',
//         postal_code: data.postalCode || '',
//         state: data.province || '',
//       },
//       metadata: {
//         firstName: data.firstName || '',
//         lastName: data.lastName || '',
//         tenantId: authorizer_context.tenant,
//         cmvUserId: authorizer_context.username,
//       }
//     };

//     let customer;
//     if (data.customerId) {
//       // Update existing customer
//       customer = await stripe.customers.update(
//         data.customerId,
//         customerData
//       );
//       console.log(`Updated customer: ${customer.id}`);
//     } else {
//       // Create new customer
//       customer = await stripe.customers.create(customerData);
//       console.log(`Created new customer: ${customer.id}`);
//     }

//     // Handle tax ID separately
//     if (data.vatId) {
//       try {
//         // Try to create the tax ID
//         const taxIdType = getTaxIdType(data.country);
//         await stripe.customers.createTaxId(
//           customer.id,
//           {
//             type: taxIdType,
//             value: data.vatId,
//           }
//         );
//       } catch (taxIdError) {
//         // If the error is because the tax ID already exists, we'll ignore it
//         if (taxIdError.code !== 'tax_id_exists') {
//           // If it's any other error, we'll throw it
//           throw taxIdError;
//         }
//         // If the tax ID already exists, we'll just log it and continue
//         console.log(`Tax ID already exists for customer ${customer.id}. Skipping creation.`);
//       }
//     }

//     // Fetch the customer again to get the most up-to-date information, including tax IDs
//     const updatedCustomer = await stripe.customers.retrieve(customer.id, {
//       expand: ['tax_ids'],
//     });

//     return Responses._200({ customer: updatedCustomer });
//   } catch (error) {
//     console.error("Error in customerManage:", error);
//     return Responses._500({ message: error.message });
//   }
// };
const billingPortalManage = async (event) => {
  console.log("BillingPortal Manage: " + JSON.stringify(event));
  const data = JSON.parse(event.body);
  const authorizer_context = event.requestContext.authorizer.lambda;

  try {
    const customerData = {
      email: data.email,
      metadata: {
        tenantId: authorizer_context.tenant,
        cmvUserId: authorizer_context.username,
      }
    };

    let customer;
    let isNewCustomer = false;

    if (data.customerId) {
      // Update existing customer
      customer = await stripe.customers.update(data.customerId, customerData);
      console.log(`Updated customer: ${customer.id}`);
    } else {
      // Create new customer
      customer = await stripe.customers.create(customerData);
      console.log(`Created new customer: ${customer.id}`);
      isNewCustomer = true;
    }

    // Check for existing payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      type: 'card', // You can specify the type of payment method you're interested in
    });

    const hasPaymentMethod = paymentMethods.data.length > 0;
    console.log(`Customer has existing payment method: ${hasPaymentMethod}`);

    // If a new customer was created or customer ID changed, update the user preferences
    if (isNewCustomer || customer.id !== data.customerId) {
      await updateUserPreferences(authorizer_context.username, customer.id);
    }

    // Create Billing Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: data.returnUri,
    });

    return Responses._200({
      customer: customer,
      billingPortalUrl: session.url,
      hasPaymentMethod: hasPaymentMethod,
      customer_country: customer?.address?.country ?? null,
      customer_name: customer?.name ?? null
    });

  } catch (error) {
    console.error("Error in billingPortalManage:", error);
    return Responses._500({
      message: error.message,
      type: error.type,
      code: error.code
    });
  }
};


const invoiceCreate = async (event) => {
  console.log("Invoice Create: " + JSON.stringify(event));
  const data = JSON.parse(event.body);
  const authorizer_context = event.requestContext.authorizer.lambda;

  // Validate billing_type
  if (!['account', 'tenant'].includes(data.billing_type)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid billing_type. Must be 'account' or 'tenant'." })
    };
  }
  try {
    // Ensure the customer exists
    const customer = await stripe.customers.retrieve(data.customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Create a product
    const product = await stripe.products.create({
      name: data.productName,
      tax_code: data.taxCode || 'txcd_10000000', // Default to general services
    });

    // Create a price for the product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(data.price * 100), // Convert to cents
      currency: 'eur',
      tax_behavior: 'exclusive',
    });

    // Create the invoice
    const invoice = await stripe.invoices.create({
      customer: data.customerId,
      collection_method: 'send_invoice', // This allows for manual payment
      days_until_due: 7, // Adjust as needed
      auto_advance: false, // Keep as draft until we add line items
      metadata: {
        tenantId: authorizer_context.tenant,
        cmvUserId: authorizer_context.username,
        billing_type: data.billing_type,
      },
    });

    // Add invoice item
    await stripe.invoiceItems.create({
      customer: data.customerId,
      price: price.id,
      quantity: data.quantity,
      invoice: invoice.id,
    });

    // Enable automatic tax calculation
    await stripe.invoices.update(invoice.id, {
      automatic_tax: { enabled: true },
    });

    // Finalize the invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    // Attempt to pay the invoice if a default payment method exists
    let paidInvoice;
    try {
      paidInvoice = await stripe.invoices.pay(finalizedInvoice.id);
      console.log('Invoice paid automatically');
    } catch (payError) {
      console.log('Invoice not paid automatically:', payError.message);
      paidInvoice = finalizedInvoice;
    }

    // Create a Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: data.customerId,
      return_url: data.returnUrl,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        invoice: paidInvoice,
        invoiceUrl: paidInvoice.hosted_invoice_url,
        customerPortalUrl: session.url
      })
    };

  } catch (error) {
    console.error("Error in invoiceCreate:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message })
    };
  }
};


const paymentConfirmation = async (event) => {
  //console.log("Received Webhook from Stripe: " + JSON.stringify(event));
  console.log("Received Webhook from Stripe");
  console.log(event);
  //console.log('stripe_webhook', stripe_webhook);
  let stripeEvent;
  try {
    const signature = event.headers['stripe-signature'];
    //console.log('signature', signature);

    // Use rawBody if available, otherwise fall back to body
    const payload = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;

    stripeEvent = stripe.webhooks.constructEvent(
      payload,
      signature,
      stripe_webhook
    );

    console.log(`Webhook verified: ${stripeEvent.id}`);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Webhook signature verification failed.' })
    };
  }

  // Extract relevant data from the event
  const dataObject = stripeEvent.data.object;

  // Handle the event
  switch (stripeEvent.type) {
    case "invoice.paid":
      console.log("Invoice paid event received");
      console.log("Invoice ID:", dataObject.id);
      console.log("Customer ID:", dataObject.customer);
      console.log("Amount paid:", dataObject.amount_paid);
      console.log("Invoice status:", dataObject.status);
      console.log("Invoice Number:", dataObject.number);
      console.log(dataObject);
      const tenantId = dataObject.metadata.tenantId;
      const cmvUserId = dataObject.metadata.cmvUserId;
      const billing_type = dataObject.metadata.billing_type;
      const invoiceNumber = dataObject.number;
      // Safely access the quantity from the first line item
      let quantity = 0;
      if (
        dataObject.lines &&
        dataObject.lines.data &&
        dataObject.lines.data.length > 0 &&
        dataObject.lines.data[0].quantity
      ) {
        quantity = dataObject.lines.data[0].quantity;
      }

      console.log("TenantId:", tenantId);
      console.log("CmvUserId:", cmvUserId);
      console.log("BillingType:", billing_type);
      console.log("CreditQuantity:", quantity);


      try {

        // Update Internal Currency
      let params;
      if (billing_type === 'account') {
        params = {
          TableName: InternalCurrencyTableName,
          FilterExpression: '#ownerId = :ownerId AND #tenantId = :tenantId',
          ExpressionAttributeNames: {
            '#ownerId': 'OwnerID',
            '#tenantId': 'TenantID'
          },
          ExpressionAttributeValues: {
            ':ownerId': cmvUserId,
            ':tenantId': tenantId
          }
        };
      } else if (billing_type === 'tenant') {
        params = {
          TableName: InternalCurrencyTableName,
          FilterExpression: '#ownerId = :ownerId AND #tenantId = :tenantId',
          ExpressionAttributeNames: {
            '#ownerId': 'OwnerID',
            '#tenantId': 'TenantID'
          },
          ExpressionAttributeValues: {
            ':ownerId': tenantId,
            ':tenantId': tenantId
          }
        };
      }
      console.log('Scan params:', JSON.stringify(params, null, 2));
      const result = await dynamoDB.scan(params).promise();
      console.log('Scan result:', JSON.stringify(result, null, 2));


      if (result.Items.length === 0) {
        console.log('No existing internal currency entry found. Creating new entry.');
        const newEntry = {
          ID: AWS.util.uuid.v4(),
          Amount: quantity, // Stored as a number
          OwnerID: billing_type === 'account' ? cmvUserId : tenantId,
          TenantID: tenantId
        };
        console.log('New entry to be created:', JSON.stringify(newEntry, null, 2));

        await dynamoDB.put({
          TableName: InternalCurrencyTableName,
          Item: newEntry
        }).promise();
        console.log('New internal currency entry created:', newEntry);

        // Create a new ledger entry
        const ledgerEntry = {
          ID: AWS.util.uuid.v4(), // Generate a unique ID
          TenantID: tenantId,
          UserID: cmvUserId,
          Quantity: quantity.toString(), // DynamoDB prefers strings for numbers
          BillingType: billing_type,
          Date: new Date().toISOString(),
          TransactionType: "INCOME_PAYMENT_GATEWAY",
          Amount: dataObject.amount_paid / 100, // Convert cents to dollars
          Currency: dataObject.currency.toUpperCase(),
          InvoiceID: dataObject.id,
          InvoiceNumber: dataObject.number,
          UserBalance: quantity
        };
        await dynamoDB
            .put({
              TableName: LedgerEntryTableName,
              Item: ledgerEntry,
            })
            .promise();

      } else {
        const existingEntry = result.Items[0];
        console.log('Existing entry found:', JSON.stringify(existingEntry, null, 2));
        const newAmount = parseFloat(existingEntry.Amount) + quantity;
        const updateParams = {
          TableName: InternalCurrencyTableName,
          Key: {
            ID: existingEntry.ID  // Only using ID as the key
          },
          UpdateExpression: 'set #amount = :amount',
          ExpressionAttributeNames: {
            '#amount': 'Amount'
          },
          ExpressionAttributeValues: {
            ':amount': newAmount
          },
          ReturnValues: 'UPDATED_NEW'
        };
        console.log('Update params:', JSON.stringify(updateParams, null, 2));
        const updateResult = await dynamoDB.update(updateParams).promise();
        console.log('Internal currency entry updated. Result:', JSON.stringify(updateResult, null, 2));

        // Create a new ledger entry
        const ledgerEntry = {
          ID: AWS.util.uuid.v4(), // Generate a unique ID
          TenantID: tenantId,
          UserID: cmvUserId,
          Quantity: quantity.toString(), // DynamoDB prefers strings for numbers
          BillingType: billing_type,
          Date: new Date().toISOString(),
          TransactionType: "INCOME_PAYMENT_GATEWAY",
          Amount: dataObject.amount_paid / 100, // Convert cents to dollars
          Currency: dataObject.currency.toUpperCase(),
          InvoiceID: dataObject.id,
          InvoiceNumber: dataObject.number,
          UserBalance: newAmount
        };
        await dynamoDB
            .put({
              TableName: LedgerEntryTableName,
              Item: ledgerEntry,
            })
            .promise();

      }


      } catch (error) {
        console.error('Error processing payment confirmation:', error);
        console.error('Error stack:', error.stack);
        return {
          statusCode: 500,
          body: JSON.stringify({ message: 'Error processing payment confirmation.' })
        };
      }







      break;
    case "invoice.payment_failed":
      console.log("Invoice payment failed event received");
      console.log("Invoice ID:", dataObject.id);
      console.log("Customer ID:", dataObject.customer);
      console.log("Amount due:", dataObject.amount_due);
      console.log("Invoice status:", dataObject.status);
      console.log(dataObject);
      break;
    default:
      console.log(`Unhandled Stripe event type: ${stripeEvent.type}`);
      console.log(dataObject);
  }

  // Log the entire event for debugging purposes
  console.log('Full event payload:', JSON.stringify(stripeEvent, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true })
  };
};

const ledgerEntry = async (event) => {
  console.log("Credit Ledger Entry: " + JSON.stringify(event));

  try {
    const data = JSON.parse(event.body);
    const authorizer_context = event.requestContext.authorizer.lambda;
    const tenantId = authorizer_context.tenant;
    const userId = authorizer_context.username;
    const billing_type = data.billing_type;

    if (!['account', 'tenant'].includes(billing_type)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid billing_type. Must be 'account' or 'tenant'." })
      };
    }

    let params;
    if (billing_type === 'account') {
      params = {
        TableName: LedgerEntryTableName,
        IndexName: 'UserID-Date-Index',
        KeyConditionExpression: 'UserID = :userId',
        FilterExpression: 'TenantID = :tenantId AND BillingType = :billingType',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':tenantId': tenantId,
          ':billingType': 'account'
        },
        ScanIndexForward: false // This will sort in descending order (newest first)
      };
    } else if (billing_type === 'tenant') { // tenant
      params = {
        TableName: LedgerEntryTableName,
        IndexName: 'TenantID-Date-Index',
        KeyConditionExpression: 'TenantID = :tenantId',
        FilterExpression: 'BillingType = :billingType',
        ExpressionAttributeValues: {
          ':tenantId': tenantId,
          ':billingType': 'tenant'
        },
        ScanIndexForward: false // This will sort in descending order (newest first)
      };
    }

    console.log('Query params:', JSON.stringify(params, null, 2));

    const queryResults = [];
    let items;
    do {
      items = await dynamoDB.query(params).promise();
      queryResults.push(...items.Items);
      params.ExclusiveStartKey = items.LastEvaluatedKey;
    } while (items.LastEvaluatedKey);

    console.log('Query results:', JSON.stringify(queryResults, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify(queryResults)
    };

  } catch (error) {
    console.error('Error in ledgerEntry:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error processing ledger entry request.' })
    };
  }


};

const cmvMonthExport = async (event) => {
  try {
    // Security checks
    const authorizer_context = event.requestContext.authorizer.lambda;
    const userTenantID = authorizer_context.tenant;
    const userID = authorizer_context.username;

  
    
    // List of allowed user IDs
    const allowedUserIDs = [
      'eeb7b1a3-267d-4e6c-af57-27d6b0de93ee',
      '851a0a10-f0f8-43b4-a494-322f3d13a8d2',
      '4fc94f29-e582-4819-ac9d-542636ab8f88',
      '5bbb5314-3dbc-4986-98ad-c3fdb5bf310b'
    ];

    // Check if the user is in the allowed tenant
    if (cmvTenant !== userTenantID) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Access denied tenant' })
      };
    }

    // Check if the userID is one of the allowed user IDs
    if (!allowedUserIDs.includes(userID)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Access denied' })
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const targetMonth = body.month 
      ? moment(body.month, 'YYYY-MM')
      : moment().subtract(1, 'month').startOf('month');

    if (!targetMonth.isValid()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid month format. Please use YYYY-MM' })
      };
    }

    // Initialize Stripe client with the API key from environment
    //const stripeClient = Stripe(stripe_reportin_api);

    // Set up date range
    const startDate = targetMonth.clone().startOf('month');
    const endDate = targetMonth.clone().endOf('month');

    // Fetch transactions
    const transactions = await getTransactions(stripe, startDate, endDate);

    // Generate Excel workbook in memory
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Transactions', {
      pageSetup: {
        paperSize: 9, // A4 paper size
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.25,
          right: 0.25,
          top: 0.75,
          bottom: 0.75,
          header: 0.3,
          footer: 0.3
        }
      }
    });

    // Set print titles (repeat header row)
    worksheet.pageSetup.printTitlesRow = '1:1';

    // Helper function to format customer info
    function formatCustomerInfo(customer) {
      if (!customer) return 'No customer information';
      const parts = [];
      if (customer.name) parts.push(customer.name);
      if (customer.email) parts.push(customer.email);
      if (customer.id) parts.push(`ID: ${customer.id}`);
      return parts.join('\n');
    }

    // Helper function to format money
    function formatMoney(amount) {
      return amount ? Number((amount / 100).toFixed(2)) : null;
    }

    // Helper function to determine transaction status
    function getTransactionStatus(transaction) {
      // Guard clause for invalid transactions
      if (!transaction) return 'unknown';

      // For non-succeeded transactions, return their status
      if (transaction.status !== 'succeeded') {
        return transaction.status;
      }

      // For succeeded transactions, check refund status
      if (transaction.refunded) {
        return 'fully_refunded';
      }

      if (transaction.amount_refunded > 0) {
        return 'partially_refunded';
      }

      return 'succeeded';
    }


    // Set up columns with optimized widths for A4
    worksheet.columns = [
      { header: 'Date', key: 'datetime', width: 12 },
      { header: 'Customer Information', key: 'customer_info', width: 35 },
      { header: 'Invoice', key: 'invoice_info', width: 15 },
      { header: 'Description', key: 'description', width: 20 },
      { header: 'Amount', key: 'amount', width: 12, style: { numFmt: '#,##0.00' } },
      { header: 'Net', key: 'net', width: 12, style: { numFmt: '#,##0.00' } },
      { header: 'Fee', key: 'fee', width: 12, style: { numFmt: '#,##0.00' } },
      { header: 'Currency', key: 'currency', width: 8 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Refund Amount', key: 'refund_amount', width: 12, style: { numFmt: '#,##0.00' } },
      { header: 'Refund Info', key: 'refund_info', width: 20 }
    ];

    if (transactions.length === 0) {
      worksheet.addRow(['No transactions found for this period']);
    } else {
      // Style the header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

      // Add data rows
      transactions.forEach(transaction => {
        const balanceTransaction = transaction.balance_transaction;
        const status = getTransactionStatus(transaction);
        const refundDetails = transaction.refunds && transaction.refunds.length > 0 ? transaction.refunds[0] : null;

        // Format invoice information
        const invoiceInfo = transaction.invoice 
          ? `${transaction.invoice.number}\n${transaction.invoice.id}`
          : 'No invoice';

        // Format refund information
        const refundInfo = refundDetails
          ? `Date: ${moment.unix(refundDetails.created).format('YYYY-MM-DD')}\n${refundDetails.reason || 'No reason'}`
          : '';

        const row = worksheet.addRow({
          datetime: moment.unix(transaction.created).format('YYYY-MM-DD\nHH:mm:ss'),
          customer_info: formatCustomerInfo(transaction.customer),
          invoice_info: invoiceInfo,
          description: transaction.description || 'No description',
          amount: formatMoney(transaction.amount),
          net: formatMoney(balanceTransaction.net),
          fee: formatMoney(balanceTransaction.fee),
          currency: transaction.currency.toUpperCase(),
          status: status,
          refund_amount: refundDetails ? formatMoney(refundDetails.amount) : null,
          refund_info: refundInfo
        });

        // Set row styles
        row.alignment = { vertical: 'top', wrapText: true };

        // Color coding for different statuses
        const fillColor = {
          succeeded: 'FFE6FFE6',      // Light green
          partially_refunded: 'FFFFDD99', // Light orange
          fully_refunded: 'FFFF9999'     // Light red
        }[status];

        if (fillColor) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: fillColor }
          };
        }

        // Handle additional refunds as separate rows
        if (transaction.refunds && transaction.refunds.length > 1) {
          transaction.refunds.slice(1).forEach(refund => {
            const additionalRefundRow = worksheet.addRow({
              datetime: '↳ ' + moment.unix(refund.created).format('YYYY-MM-DD\nHH:mm:ss'),
              description: '↳ Additional refund',
              refund_amount: formatMoney(refund.amount),
              refund_info: `Date: ${moment.unix(refund.created).format('YYYY-MM-DD')}\n${refund.reason || 'No reason'}`
            });
            additionalRefundRow.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF2F2F2' }
            };
            additionalRefundRow.alignment = { vertical: 'top', wrapText: true };
          });
        }
      });

      // Add totals
      worksheet.addRow({}); // Empty row before totals
      const totalRow = worksheet.addRow({
        datetime: 'TOTALS',
        amount: { formula: `SUM(E2:E${worksheet.rowCount-1})` },
        net: { formula: `SUM(F2:F${worksheet.rowCount-1})` },
        fee: { formula: `SUM(G2:G${worksheet.rowCount-1})` },
        refund_amount: { formula: `SUM(J2:J${worksheet.rowCount-1})` }
      });
      totalRow.font = { bold: true };
      
      ['E', 'F', 'G', 'J'].forEach(col => {
        const cell = worksheet.getCell(`${col}${worksheet.rowCount}`);
        cell.numFmt = '#,##0.00';
      });

      // Add legend
      worksheet.addRow({}); // Empty row before legend
      worksheet.addRow(['Legend:']);
      ['Succeeded', 'Partially Refunded', 'Fully Refunded'].forEach(status => {
        const legendRow = worksheet.addRow([status]);
        legendRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: {
            'Succeeded': 'FFE6FFE6',
            'Partially Refunded': 'FFFFDD99',
            'Fully Refunded': 'FFFF9999'
          }[status] }
        };
      });

      // Set print area
      worksheet.pageSetup.printArea = `A1:K${worksheet.rowCount}`;

      // Add footer
      worksheet.headerFooter.oddFooter = '&C&P of &N';
    }

    // Write to buffer instead of file
    const buffer = await workbook.xlsx.writeBuffer();

    // Convert buffer to base64
    const base64 = buffer.toString('base64');

    // Return the Excel file as a base64-encoded string with appropriate headers
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="stripe_transactions_${targetMonth.format('YYYY-MM')}.xlsx"`,
        'Content-Transfer-Encoding': 'base64'
      },
      body: base64,
      isBase64Encoded: false
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error', error: error.message })
    };
  }
};

const cmvTenants = async (event) => {
  //const data = JSON.parse(event.body);
  const authorizer_context = event.requestContext.authorizer.lambda;
  const userTenantID = authorizer_context.tenant;
  const userID = authorizer_context.username;

  // List of allowed user IDs
  const allowedUserIDs = [
    'eeb7b1a3-267d-4e6c-af57-27d6b0de93ee',
    '851a0a10-f0f8-43b4-a494-322f3d13a8d2',
    '4fc94f29-e582-4819-ac9d-542636ab8f88',
    '5bbb5314-3dbc-4986-98ad-c3fdb5bf310b'
  ];


  // Check if the user is in the allowed tenant
  if(cmvTenant !== userTenantID){
    return Responses._403({ message: 'Access denied tenant' });
  }

    // Check if the userID is one of the allowed user IDs
    if (!allowedUserIDs.includes(userID)) {
      return Responses._403({ message: 'Access denied' });
    }

    // Fetch all tenants from the TenantTableName DynamoDB table
    const params = {
      TableName: TenantTableName,
    };
    try {
      const result = await dynamoDB.scan(params).promise();
      const tenants = result.Items;

    // Process each tenant to fetch user details from Cognito
    for (const tenant of tenants) {
      const userPoolId = tenant.details.Id; // Assuming userPoolId is a field in the tenant object

      // Fetch users from the Cognito user pool
      const users = await listUsersInUserPool(userPoolId);

      // Count users and users in different groups
      const userCount = users.length;
      const groupCounts = await countUsersInGroups(userPoolId, users);

      // Add user details and statistics to the tenant object
      tenant.users = users;
      tenant.userCount = userCount;
      tenant.groupCounts = groupCounts;
      console.log("start user details to extend user objects");
      // Fetch additional details for each user
      for (const user of users) {
        const userId = user.Username;

        // Fetch user preferences
        const paramsUserPreferences = {
          TableName: UserPreferencesTableName,
          IndexName: 'userPreferencesGSI',
          KeyConditionExpression: "#UserID = :UserID",
          ExpressionAttributeNames: {
            '#UserID': 'UserID',
          },
          ExpressionAttributeValues: {
            ":UserID": userId
          },
          ScanIndexForward: false,
        };
        console.log("paramsUserPreferences: " + JSON.stringify(paramsUserPreferences));
        const userPreferencesResult = await dynamoDB.query(paramsUserPreferences).promise();
        console.log("userPreferencesResult: " + JSON.stringify(userPreferencesResult));
        if (userPreferencesResult.Count === 1) {
          let row = userPreferencesResult.Items[0];

          if (row.hasOwnProperty('TreasureChestFilters')) {
            row.TreasureChestFilters = Dynamo.typeConvertorDynamoDBToJavascript(row.TreasureChestFilters);
          }
          if (row.hasOwnProperty('Tags')) {
            row.Tags = Dynamo.typeConvertorDynamoDBToJavascript(row.Tags);
          }
          if (row.hasOwnProperty('JourneysNotes')) {
            row.JourneysNotes = Dynamo.typeConvertorDynamoDBToJavascript(row.JourneysNotes);
          }
          if (row.hasOwnProperty('ExtraAttributes')) {
            row.ExtraAttributes = Dynamo.typeConvertorDynamoDBToJavascript(row.ExtraAttributes);
          }

          user.preferences = row;
        } else {
          console.log(`No user preferences found for UserID: ${userId} and TenantID: ${tenant.id}`);
        }

        // Fetch internal currency amount
        const paramsInternalCurrency = {
          TableName: InternalCurrencyTableName,
          IndexName: 'internalCurrencyGSI',
          KeyConditionExpression: 'OwnerID = :ownerId',
          FilterExpression: 'TenantID = :tenantId',
          ExpressionAttributeValues: {
            ':ownerId': userId,
            ':tenantId': tenant.id,
          },
        };
        console.log("paramsInternalCurrency: " + JSON.stringify(paramsInternalCurrency));
        const internalCurrencyResult = await dynamoDB.query(paramsInternalCurrency).promise();
        console.log("internalCurrencyResult: " + JSON.stringify(internalCurrencyResult));
        if (internalCurrencyResult.Items && internalCurrencyResult.Items.length > 0) {
          user.amount = internalCurrencyResult.Items[0].Amount;
        }
      }
    }

    // Return the full tenant objects with all details
    return Responses._200({ tenants });
    } catch (error) {
      console.error('Error fetching tenants:', error);
      return Responses._500({ message: error.message });
    }


};
/// end POST Methots

/// PUT Methots
const tenantUpdate = async (event, id) => {
  const authorizer_context = event.requestContext.authorizer.lambda;

  // console.log(authorizer_context.clientID);
  // console.log(authorizer_context.poolID);
  // console.log(authorizer_context.tenant);
  // console.log(authorizer_context.username);

  const timestamp = new Date().getTime();
  const data = JSON.parse(event.body);
  console.log("tenantUpdate Data: " + data);

  const validateinput = (fields) => {
    let check = true;
    // list of allowed field to update
    let allowedfields = [
      "title",
      "description",
      "primarycolor",
      "secondarycolor",
    ];
    Object.entries(fields).forEach(([key, item]) => {
      if (allowedfields.indexOf(key) == -1) {
        check = false;
      }
    });
    return check;
  };

  const validtenant = (tenant) => {
    let result = false;
    if (tenant === event.pathParameters.id) {
      result = true;
    }
    return result;
  };

  const generateUpdateQuery = (fields) => {
    let exp = {
      UpdateExpression: "set",
      ExpressionAttributeNames: {},
      ExpressionAttributeValues: {},
    };
    Object.entries(fields).forEach(([key, item]) => {
      exp.UpdateExpression += ` #${key} = :${key},`;
      exp.ExpressionAttributeNames[`#${key}`] = key;
      exp.ExpressionAttributeValues[`:${key}`] = item;
    });
    // add record id
    exp.ExpressionAttributeNames[`#id`] = "id";
    exp.ExpressionAttributeValues[`:id`] = event.pathParameters.id;

    exp.UpdateExpression = exp.UpdateExpression.slice(0, -1);
    return exp;
  };

  let isValid = validateinput(data);
  let isTenandValid = validtenant(authorizer_context.tenant);

  if (isValid && isTenandValid) {
    data.updatedAt = timestamp;
    let expression = generateUpdateQuery(data);

    let params = {
      TableName: process.env.DYNAMODB_TENANT_TABLE,
      Key: {
        id: event.pathParameters.id,
      },
      ConditionExpression: "#id = :id",
      ...expression,
    };

    // update the todo in the database
    dynamoDB.update(params, (error, result) => {
      // handle potential errors
      if (error) {
        console.error(error);
        const response = {
          statusCode: error.statusCode || 501,
          headers: { "Content-Type": "text/plain" },
          body: error.message, //"Couldn't update tenant record",
        };
        return response;
      }

      // get User Pool ID to update cognito email
      const g_params = {
        TableName: process.env.DYNAMODB_TENANT_TABLE,
        Key: {
          id: event.pathParameters.id,
        },
      };

      // fetch CID from Database
      dynamoDB.get(g_params, (error, result) => {
        // handle potential errors
        if (error) {
          console.error(error);
          const response = {
            statusCode: error.statusCode || 501,
            headers: { "Content-Type": "text/plain" },
            body: "Couldn't fetch the tenant item.",
          };
          return response;
        }

        //update cognito user pool "result.Item.details.Id"
        // var cup_params = {
        //   UserPoolId: result.Item.details.Id /* required */,
        // };

        let envDOMAIN = null;
        let findStage = process.env.DYNAMODB_TENANT_TABLE;
        let stage = null;
        if (findStage.includes("dev")) {
          envDOMAIN = ".dev.commovis.com";
          stage = "DEV";
        } else {
          envDOMAIN = ".commovis.com";
          stage = "PROD";
        }
        const fulldomain = "https://" + result.Item.tenantname + envDOMAIN;

        let invite_email = invite_content.replace(/###url###/g, fulldomain);
        let invite_email_p = invite_email.replace(
          /###primarycolor###/g,
          result.Item.primarycolor
        );
        let invite_email_s = invite_email_p.replace(
          /###secondarycolor###/g,
          result.Item.secondarycolor
        );
        let reset_email = reset_content.replace(/###url###/g, fulldomain);
        let reset_email_p = reset_email.replace(
          /###primarycolor###/g,
          result.Item.primarycolor
        );
        let reset_email_s = reset_email_p.replace(
          /###secondarycolor###/g,
          result.Item.secondarycolor
        );

        var ucup_params = {
          UserPoolId: result.Item.details.Id /* required */,
          AccountRecoverySetting: {
            RecoveryMechanisms: [
              {
                Name: "verified_email" /* required */,
                Priority: 1 /* required */,
              },
              /* more items */
            ],
          },
          DeviceConfiguration: {
            ChallengeRequiredOnNewDevice: false,
            DeviceOnlyRememberedOnUserPrompt: true,
          },
          AdminCreateUserConfig: {
            AllowAdminCreateUserOnly: true,
            InviteMessageTemplate: {
              EmailMessage: invite_email_s,
              EmailSubject: "You're invited! Welcome to HansenBeck LXP",
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
              TemporaryPasswordValidityDays: 7,
            },
          },
          UserPoolTags: {
            Stage: stage,
          },

          EmailVerificationMessage: reset_email_s,
          EmailVerificationSubject: "COMMOVIS: Verification code",
        };
        // cognitoidentityserviceproviderDirect.describeUserPool(
        //   cup_params,
        //   function (err, data) {
        //     if (err) console.log(err, err.stack);
        //     // an error occurred
        //     else {
        //       console.log(data); // successful response
        //     }
        //   }
        // );
        cognitoidentityserviceproviderDirect.updateUserPool(
          ucup_params,
          function (err, data) {
            if (err) console.log(err, err.stack);
            // an error occurred
            else console.log(data); // successful response
          }
        );
      });

      // create a response
      const response = {
        statusCode: 200,
        body: "OK", //JSON.stringify(result),
      };
      return response;
    });
  } else {
    // the imput is invalid.
    const response = {
      statusCode: 400,
      body: "Wrong input Value",
    };
    return response;
  }
};
const userUpdate = async (event, id) => {
  console.log("User Update: " + event);
  console.log("User ID: " + id);
  try {
    const authorizer_context = event.requestContext.authorizer.lambda;

    // console.log(authorizer_context.clientID);
    // console.log(authorizer_context.poolID);
    // console.log(authorizer_context.tenant);
    // console.log(authorizer_context.username);

    const data = JSON.parse(event.body);
    const validateinput = (fields) => {
      let check = true;
      // list of allowed field to update
      let allowedfields = [
        "given_name",
        "family_name",
        "private_email",
        "nickname",
        "gender",
        "phone_number",
        "address",
        "academic_degree",
        "job_title",
        "company",
        "position",
        "website",
        "bio",
        "social_linkedIn",
        "social_instagram",
        "social_facebook",
        "social_other",
        // "picture",
      ];
      Object.entries(fields).forEach(([key, item]) => {
        if (allowedfields.indexOf(key) == -1) {
          check = false;
        }
      });
      return check;
    };
    const validtenant = (userid) => {
      let result = false;
      if (userid === event.pathParameters.id) {
        result = true;
      }
      return result;
    };

    var params = {
      UserAttributes: [
        {
          Name: "given_name",
          Value: data.given_name,
        },
        {
          Name: "family_name",
          Value: data.family_name,
        },
        {
          Name: "custom:private_email",
          Value: data.private_email,
        },
        {
          Name: "nickname",
          Value: data.nickname,
        },
        {
          Name: "gender",
          Value: data.gender,
        },
        {
          Name: "phone_number",
          Value: data.phone_number,
        },
        {
          Name: "address",
          Value: data.address,
        },
        {
          Name: "custom:academic_degree",
          Value: data.academic_degree,
        },
        {
          Name: "custom:job_title",
          Value: data.job_title,
        },
        {
          Name: "custom:company",
          Value: data.company,
        },
        {
          Name: "custom:position",
          Value: data.position,
        },
        {
          Name: "website",
          Value: data.website,
        },
        {
          Name: "custom:bio",
          Value: data.bio,
        },
        {
          Name: "custom:social_linkedIn",
          Value: data.social_linkedIn,
        },
        {
          Name: "custom:social_instagram",
          Value: data.social_instagram,
        },
        {
          Name: "custom:social_facebook",
          Value: data.social_facebook,
        },
        {
          Name: "custom:social_other",
          Value: data.social_other,
        },
        // {
        //   Name: "picture",
        //   Value: data.picture,
        // },
      ],
      UserPoolId: authorizer_context.poolID,
      Username: authorizer_context.username,
    };

    let isValid = validateinput(data);
    let isUserValid = validtenant(authorizer_context.username);

    if (isValid && isUserValid) {

      await CognitoIdentityServiceProvider
        .adminUpdateUserAttributes(params)
        .promise();

      return Responses._200({
        message: 'User updated successfully'
      });

    } else {

      return Responses._400({
        message: 'Wrong input Value'
      });
    }
  } catch (error) {

    return Responses._500({
      message: error.message
    });
  }
};
const userPictureUpdate = async (event, id) => {
  console.log("User Picture Update: " + event);
  console.log("User ID: " + id);
  try {
    const authorizer_context = event.requestContext.authorizer.lambda;

    // console.log(authorizer_context.clientID);
    // console.log(authorizer_context.poolID);
    // console.log(authorizer_context.tenant);
    // console.log(authorizer_context.username);

    const data = JSON.parse(event.body);
    const validateinput = (fields) => {
      let check = true;
      // list of allowed field to update
      let allowedfields = ["picture"];
      Object.entries(fields).forEach(([key, item]) => {
        if (allowedfields.indexOf(key) == -1) {
          check = false;
        }
      });
      return check;
    };
    const validtenant = (userid) => {
      let result = false;
      if (userid === event.pathParameters.id) {
        result = true;
      }
      return result;
    };

    var params = {
      UserAttributes: [
        {
          Name: "picture",
          Value: data.picture,
        },
      ],
      UserPoolId: authorizer_context.poolID,
      Username: authorizer_context.username,
    };

    let isValid = validateinput(data);
    let isUserValid = validtenant(authorizer_context.username);

    if (isValid && isUserValid) {
      // no callback here
      const result = await cognitoidentityserviceproviderDirect
        .adminUpdateUserAttributes(params)
        .promise();
      //console.log("success", result);
      return {
        statusCode: 200,
        body: JSON.stringify({
          profilePicture: data.picture,
        }),
      };
    } else {
      return {
        statusCode: 400,
        body: "Wrong input Value",
      };
    }
  } catch (error) {
    //sconsole.error("error", error);
    return {
      statusCode: 417,
      body: JSON.stringify(error),
    };
  }
};
const userUpdateRoles = async (event, id) => {
  console.log("User Update Roles: " + event);
  console.log("User ID: " + id);
  let requestData = JSON.parse(event.body);

  const authorizer_context = event.requestContext.authorizer.lambda;
  requestData.UserPoolId = authorizer_context.poolID;

  const hasRequiredParams = (requestData) => {
    return requestData.hasOwnProperty("NewGroups");
  };

  if (!hasRequiredParams(requestData)) {
    return Responses._400({ message: "Missing required parameters!" });
  }

  const userSub = event.pathParameters.ID;
  const userPoolId = requestData.UserPoolId;
  const newGroups = requestData.NewGroups;

  try {
    const getUserParams = {
      UserPoolId: userPoolId,
      Username: userSub,
    };

    const userData =
      await CognitoIdentityServiceProvider.adminListGroupsForUser(
        getUserParams
      ).promise();
    const existingGroups = userData.Groups.map((group) => group.GroupName);

    // Calculate the groups to add and remove
    const groupsToAdd = newGroups.filter(
      (group) => !existingGroups.includes(group)
    );
    const groupsToRemove = existingGroups.filter(
      (group) => !newGroups.includes(group)
    );

    // Add user to new groups
    if (groupsToAdd.length > 0) {
      let updateGroupsParams = {
        UserPoolId: userPoolId,
        Username: userSub,
      };

      for (const group of groupsToAdd) {
        updateGroupsParams.GroupName = group;
        await CognitoIdentityServiceProvider.adminAddUserToGroup(
          updateGroupsParams
        ).promise();
      }
    }

    // Remove user from old groups
    if (groupsToRemove.length > 0) {
      const removeGroupsParams = {
        UserPoolId: userPoolId,
        Username: userSub,
      };

      for (const group of groupsToRemove) {
        removeGroupsParams.GroupName = group;
        await CognitoIdentityServiceProvider.adminRemoveUserFromGroup(
          removeGroupsParams
        ).promise();
      }
    }

    return Responses._200({ message: "User roles updated successfully" });
  } catch (error) {
    return Responses._500({ message: error.message });
  }
};

/// end PUT Methots

///DELETE Methots

const deleteTenant = async (event, id) => {
  const params = {
    TableName: process.env.DYNAMODB_TENANT_TABLE,
    Key: {
      id: id,
    },
  };

  // delete the todo from the database
  dynamoDB.delete(params, (error) => {
    // handle potential errors
    if (error) {
      console.error(error);
      const response = {
        statusCode: error.statusCode || 501,
        headers: { "Content-Type": "text/plain" },
        body: "Couldn't remove the tenant item.",
      };
      return response;
    }

    // create a response
    const response = {
      statusCode: 200,
      body: JSON.stringify({}),
    };
    return response;
  });
};
const deleteUserNotification = async (event, id) => {
  console.log('Delete User Notification: '+ event);
  console.log('User ID: '+ id);
  if (!event.pathParameters || !event.pathParameters.ID) {
    // failed without an ID
    return Responses._400({ message: 'Missing the ID from the path' });
}

try {

    const params = {
        TableName: UserNotificationsTableName,
        Key: {
            ID: event.pathParameters.ID,
        },
    };

    await dynamoDB.delete(params).promise();

    return Responses._200({message: 'User notification deleted successfully'});

} catch (error) {
    return Responses._500({ message: error.message });
}
}

/// end DELETE Methots

// Helper function to update user preferences. not available via an endpoint directly
const updateUserPreferences = async (userId, customerId) => {
  const queryParams = {
    TableName: UserPreferencesTableName,
    IndexName: "userPreferencesGSI",
    KeyConditionExpression: "UserID = :userId",
    ExpressionAttributeValues: {
      ":userId": userId
    }
  };

  try {
    const queryResult = await dynamoDB.query(queryParams).promise();
    if (queryResult.Items && queryResult.Items.length > 0) {
      const userPreference = queryResult.Items[0];
      let extraAttributes = userPreference.ExtraAttributes
        ? Dynamo.typeConvertorDynamoDBToJavascript(userPreference.ExtraAttributes)
        : {};

      extraAttributes.Billing_Stripe_CustomerID = customerId;

      const updateParams = {
        TableName: UserPreferencesTableName,
        Key: { ID: userPreference.ID },
        UpdateExpression: 'SET #ExtraAttributes = :ExtraAttributes',
        ExpressionAttributeNames: {
          '#ExtraAttributes': 'ExtraAttributes'
        },
        ExpressionAttributeValues: {
          ':ExtraAttributes': Dynamo.typeConvertorJavascriptToDynamoDB(extraAttributes)
        }
      };

      await dynamoDB.update(updateParams).promise();
      console.log(`Updated user preferences with Stripe customer ID: ${customerId}`);
    } else {
      console.log(`No user preference found for UserID: ${userId}`);
    }
  } catch (dynamoError) {
    console.error("Error updating DynamoDB user preferences:", dynamoError);
    throw dynamoError; // Re-throw the error to be caught in the main function
  }
};

// Helper function to list users in a Cognito user pool
const listUsersInUserPool = async (userPoolId) => {
  const params = {
    UserPoolId: userPoolId,
  };

  let users = [];
  let response;

  do {
    response = await cognitoidentityserviceproviderDirect.listUsers(params).promise();
    users = users.concat(response.Users);
    params.PaginationToken = response.PaginationToken;
  } while (response.PaginationToken);

  return users;
};

// Helper function to count users in different groups
const countUsersInGroups = async (userPoolId, users) => {
  const groupCounts = {};

  for (const user of users) {
    const params = {
      UserPoolId: userPoolId,
      Username: user.Username,
    };

    const response = await cognitoidentityserviceproviderDirect.adminListGroupsForUser(params).promise();
    for (const group of response.Groups) {
      if (!groupCounts[group.GroupName]) {
        groupCounts[group.GroupName] = 0;
      }
      groupCounts[group.GroupName]++;
    }
  }

  return groupCounts;
};

const listUsersInGroup = async (UserPoolId, GroupName) => {

  try {

    let paramsListUsersInGroup = {
      UserPoolId: UserPoolId,
      GroupName: GroupName,
    };

    let users = [];
    let response;

    do {
      response = await CognitoIdentityServiceProvider.listUsersInGroup(paramsListUsersInGroup).promise();
      users = users.concat(response.Users);
      paramsListUsersInGroup.NextToken = response.NextToken;
    } while (response.NextToken);

    return users;
  }
  catch (error) {
    throw new Error(error);
  }
}
// Helper functions for stripe reporting

const getRefundDetails = async (stripeClient, chargeId) => {
  try {
    const refunds = await stripeClient.refunds.list({
      charge: chargeId,
      expand: ['data.balance_transaction']
    });
    return refunds.data;
  } catch (error) {
    console.error(`Error fetching refunds for charge ${chargeId}:`, error.message);
    return [];
  }
}

const getTransactions = async (stripeClient, startDate, endDate) => {
  const transactions = [];
  let hasMore = true;
  let startingAfter = null;

  while (hasMore) {
    try {
      const charges = await stripeClient.charges.list({
        limit: 100,
        created: {
          gte: startDate.unix(),
          lt: endDate.unix()
        },
        ...(startingAfter ? { starting_after: startingAfter } : {}),
        expand: ['data.balance_transaction', 'data.invoice', 'data.customer']
      });

      if (charges.data.length === 0) {
        hasMore = false;
        continue;
      }

      // Fetch refund details for each charge
      for (const charge of charges.data) {
        charge.refunds = await getRefundDetails(stripeClient, charge.id);
      }

      transactions.push(...charges.data);
      hasMore = charges.has_more;
      startingAfter = charges.data[charges.data.length - 1].id;

    } catch (error) {
      console.error('Error fetching transactions:', error.message);
      hasMore = false;
    }
  }

  return transactions;
}