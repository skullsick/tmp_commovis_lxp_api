"use strict";
const AWS = require('aws-sdk');
const multipart = require("aws-lambda-multipart-parser");
const Responses = require("../common/API_Responses");
const Dynamo = require('../common/Dynamo');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const CognitoIdentityServiceProvider = require("../common/Cognito");
AWS.config.update({ region: process.env.AWS_REGION });
const s3 = new AWS.S3({ signatureVersion: "v4" });
const S3_BUCKET = process.env.stage + "-upload-assets";
const URL_EXPIRATION_SECONDS = 300;
const uuid = require("uuid");
const { translateJson } = require('../common/bedrock');

const JourneyTableName = process.env.DYNAMODB_JOURNEY_TABLE;
const JourneyParticipantRelationTableName = process.env.DYNAMODB_JOURNEY_PARTICIPANT_RELATION_TABLE;
const JourneyCategoryTableName = process.env.DYNAMODB_JOURNEY_CATEGORY_TABLE;
const JourneyReusableTemplatesTableName = process.env.DYNAMODB_JOURNEY_REUSABLE_TEMPLATES_TABLE;
const TreasureChestTableName = process.env.DYNAMODB_TREASURE_CHEST_TABLE;
const UserNotificationsTableName = process.env.DYNAMODB_USER_NOTIFICATIONS_TABLE;
const InternalCurrencyTableName = process.env.DYNAMODB_INTERNAL_CURRENCY_TABLE;
const UserPreferencesTableName = process.env.DYNAMODB_USER_PREFERENCES_TABLE;
const TenantTableName = process.env.DYNAMODB_TENANT_TABLE
const AssignmentTableName = process.env.DYNAMODB_ASSIGNMENT_TABLE;



const calculateJourneyCompletionPercentage = (participantProgress, journeyStructure) => {

    const unhiddenStructureItemsIDs = journeyStructure.filter((structureItem) => !structureItem.IsHidden).map((structureItem) => structureItem.ID);
    participantProgress = participantProgress.filter((progress) => unhiddenStructureItemsIDs.includes(progress.StructureItemID))

    // Filter objects with Completed set to true
    const completedStructureItems = participantProgress.filter((progress) =>  progress.Completed);

    // Calculate the percentage
    let percentage = 0;

    if (participantProgress.length > 0) {
        percentage = (completedStructureItems.length / participantProgress.length) * 100;
    }

    // Return the percentage
    return percentage;

};
const copyJourneyMainPicture = async function (sourceID, sourceFolder, destinationID, tenantID, sourceFileName) {

    let source_folder_name = `${sourceFolder}/${sourceID}`;
    let source_file_name = sourceFileName;

    let destination_folder_name = `journey/${destinationID}`;
    let destination_file_name = sourceFileName;

    const sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
    const destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;

    await s3.copyObject({
        Bucket: S3_BUCKET,
        CopySource: `${S3_BUCKET}/${sourceKey}`,
        Key: destinationKey
    }).promise();
}
const copyJourneyMainPictureTemplates = async function (sourceJourneyID, newPendingJourneyReusableTemplateID, tenantID, sourceFileName) {

    let source_folder_name = `journey/${sourceJourneyID}`;
    let source_file_name = sourceFileName;

    let destination_folder_name = `journey_reusable_templates/${newPendingJourneyReusableTemplateID}`;
    let destination_file_name = sourceFileName;

    const sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
    const destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;

    await s3.copyObject({
        Bucket: S3_BUCKET,
        CopySource: `${S3_BUCKET}/${sourceKey}`,
        Key: destinationKey
    }).promise();
}
const copyOverviewAssets = async function (sourceID, sourceFolder, destinationID, tenantID, Overview) {

    let source_folder_name = `${sourceFolder}/${sourceID}/assets`;

    let destination_folder_name = `journey/${destinationID}/assets`;

    for (const Element of Overview.Elements) {

        if (Element.type === 'image' || Element.type === 'reusableImage') {
            let source_file_name = Element.data.file.name;
            let destination_file_name = Element.data.file.name;

            let sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
            let destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;

            await s3.copyObject({
                Bucket: S3_BUCKET,
                CopySource: `${S3_BUCKET}/${sourceKey}`,
                Key: destinationKey
            }).promise();

        }

    }
}
const copyOverviewAssetsTemplates = async function (sourceJourneyID, newPendingJourneyReusableTemplateID, tenantID, Overview) {

    let source_folder_name = `journey/${sourceJourneyID}/assets`;

    let destination_folder_name = `journey_reusable_templates/${newPendingJourneyReusableTemplateID}/assets`;

    for (const Element of Overview.Elements) {

        if (Element.type === 'image' || Element.type === 'reusableImage') {
            let source_file_name = Element.data.file.name;
            let destination_file_name = Element.data.file.name;

            let sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
            let destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;

            await s3.copyObject({
                Bucket: S3_BUCKET,
                CopySource: `${S3_BUCKET}/${sourceKey}`,
                Key: destinationKey
            }).promise();

        }

    }
}
const copyStructureAssets = async function (sourceID, sourceFolder, destinationID, tenantID, Structure) {


    let source_folder_name = `${sourceFolder}/${sourceID}/assets`;

    let destination_folder_name = `journey/${destinationID}/assets`;

    for (const StructureItem of Structure) {

        if (StructureItem.Type === 'Chapter') {
            if (StructureItem.hasOwnProperty('Units')) {
                for (const Unit of StructureItem.Units) {

                    if (Unit.hasOwnProperty('LinkedAssets')) {
                        for (const LinkedAsset of Unit.LinkedAssets) {
                            if (LinkedAsset.Type === 'Attachment') {

                                let source_file_name = LinkedAsset.Name;
                                let destination_file_name = LinkedAsset.Name;

                                let sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
                                let destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;

                                await s3.copyObject({
                                    Bucket: S3_BUCKET,
                                    CopySource: `${S3_BUCKET}/${sourceKey}`,
                                    Key: destinationKey
                                }).promise();

                            }

                        }
                    }

                    if (Unit.hasOwnProperty('Blocks')) {
                        for (const Block of Unit.Blocks) {
                            if (Block.hasOwnProperty('Elements')) {
                                for (const Element of Block.Elements) {
                                    if (Element.type === 'image' || Element.type === 'reusableImage') {
                                        let source_file_name = Element.data.file.name;
                                        let destination_file_name = Element.data.file.name;

                                        let sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
                                        let destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;

                                        await s3.copyObject({
                                            Bucket: S3_BUCKET,
                                            CopySource: `${S3_BUCKET}/${sourceKey}`,
                                            Key: destinationKey
                                        }).promise();

                                    }
                                }
                            }
                        }
                    }

                }
            }
        }

        if (StructureItem.Type === 'Assignment') {

            if (StructureItem.hasOwnProperty('LinkedAssets')) {
                for (const LinkedAsset of StructureItem.LinkedAssets) {
                    if (LinkedAsset.Type === 'Attachment') {

                        let source_file_name = LinkedAsset.Name;
                        let destination_file_name = LinkedAsset.Name;

                        let sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
                        let destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;

                        await s3.copyObject({
                            Bucket: S3_BUCKET,
                            CopySource: `${S3_BUCKET}/${sourceKey}`,
                            Key: destinationKey
                        }).promise();

                    }

                }
            }

            if (StructureItem.hasOwnProperty('Tasks')) {
                for (const Task of StructureItem.Tasks) {
                    if (Task.hasOwnProperty('Content')) {
                        if (Task.Content.hasOwnProperty('Elements')) {
                            for (const Element of Task.Content.Elements) {
                                if (Element.type === 'image' || Element.type === 'reusableImage') {
                                    let source_file_name = Element.data.file.name;
                                    let destination_file_name = Element.data.file.name;

                                    let sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
                                    let destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;

                                    await s3.copyObject({
                                        Bucket: S3_BUCKET,
                                        CopySource: `${S3_BUCKET}/${sourceKey}`,
                                        Key: destinationKey
                                    }).promise();

                                }
                            }
                        }
                    }
                }
            }

        }

        if (StructureItem.Type === 'Event') {

            if (StructureItem.hasOwnProperty('LinkedAssets')) {
                for (const LinkedAsset of StructureItem.LinkedAssets) {
                    if (LinkedAsset.Type === 'Attachment') {

                        let source_file_name = LinkedAsset.Name;
                        let destination_file_name = LinkedAsset.Name;

                        let sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
                        let destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;

                        await s3.copyObject({
                            Bucket: S3_BUCKET,
                            CopySource: `${S3_BUCKET}/${sourceKey}`,
                            Key: destinationKey
                        }).promise();

                    }

                }
            }

            if (StructureItem.hasOwnProperty('Details')) {
                if (StructureItem.Details.hasOwnProperty('Elements')) {
                    for (const Element of StructureItem.Details.Elements) {
                        if (Element.type === 'image' || Element.type === 'reusableImage') {
                            let source_file_name = Element.data.file.name;
                            let destination_file_name = Element.data.file.name;

                            let sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
                            let destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;

                            await s3.copyObject({
                                Bucket: S3_BUCKET,
                                CopySource: `${S3_BUCKET}/${sourceKey}`,
                                Key: destinationKey
                            }).promise();

                        }
                    }
                }
            }

        }

    }
}
const copyStructureAssetsTemplates = async function (sourceJourneyID, newPendingJourneyReusableTemplateID, tenantID, Structure) {


    let source_folder_name = `journey/${sourceJourneyID}/assets`;

    let destination_folder_name = `journey_reusable_templates/${newPendingJourneyReusableTemplateID}/assets`;

    for (const StructureItem of Structure) {

        if (StructureItem.Type === 'Chapter') {
            if (StructureItem.hasOwnProperty('Units')) {
                for (const Unit of StructureItem.Units) {

                    if (Unit.hasOwnProperty('LinkedAssets')) {
                        for (const LinkedAsset of Unit.LinkedAssets) {
                            if (LinkedAsset.Type === 'Attachment') {

                                let source_file_name = LinkedAsset.Name;
                                let destination_file_name = LinkedAsset.Name;

                                let sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
                                let destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;

                                await s3.copyObject({
                                    Bucket: S3_BUCKET,
                                    CopySource: `${S3_BUCKET}/${sourceKey}`,
                                    Key: destinationKey
                                }).promise();

                            }

                        }
                    }

                    if (Unit.hasOwnProperty('Blocks')) {
                        for (const Block of Unit.Blocks) {
                            if (Block.hasOwnProperty('Elements')) {
                                for (const Element of Block.Elements) {
                                    if (Element.type === 'image' || Element.type === 'reusableImage') {
                                        let source_file_name = Element.data.file.name;
                                        let destination_file_name = Element.data.file.name;

                                        let sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
                                        let destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;

                                        await s3.copyObject({
                                            Bucket: S3_BUCKET,
                                            CopySource: `${S3_BUCKET}/${sourceKey}`,
                                            Key: destinationKey
                                        }).promise();

                                    }
                                }
                            }
                        }
                    }

                }
            }
        }

        // if (StructureItem.Type === 'Assignment') {
        //
        //     if (StructureItem.hasOwnProperty('LinkedAssets')) {
        //         for (const LinkedAsset of StructureItem.LinkedAssets) {
        //             if (LinkedAsset.Type === 'Attachment') {
        //
        //                 let source_file_name = LinkedAsset.Name;
        //                 let destination_file_name = LinkedAsset.Name;
        //
        //                 let sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
        //                 let destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;
        //
        //                 await s3.copyObject({
        //                     Bucket: S3_BUCKET,
        //                     CopySource: `${S3_BUCKET}/${sourceKey}`,
        //                     Key: destinationKey
        //                 }).promise();
        //
        //             }
        //
        //         }
        //     }
        //
        //     if (StructureItem.hasOwnProperty('Tasks')) {
        //         for (const Task of StructureItem.Tasks) {
        //             if (Task.hasOwnProperty('Content')) {
        //                 if (Task.Content.hasOwnProperty('Elements')) {
        //                     for (const Element of Task.Content.Elements) {
        //                         if (Element.type === 'image' || Element.type === 'reusableImage') {
        //                             let source_file_name = Element.data.file.name;
        //                             let destination_file_name = Element.data.file.name;
        //
        //                             let sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
        //                             let destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;
        //
        //                             await s3.copyObject({
        //                                 Bucket: S3_BUCKET,
        //                                 CopySource: `${S3_BUCKET}/${sourceKey}`,
        //                                 Key: destinationKey
        //                             }).promise();
        //
        //                         }
        //                     }
        //                 }
        //             }
        //         }
        //     }
        //
        // }

        if (StructureItem.Type === 'Event') {

            if (StructureItem.hasOwnProperty('LinkedAssets')) {
                for (const LinkedAsset of StructureItem.LinkedAssets) {
                    if (LinkedAsset.Type === 'Attachment') {

                        let source_file_name = LinkedAsset.Name;
                        let destination_file_name = LinkedAsset.Name;

                        let sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
                        let destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;

                        await s3.copyObject({
                            Bucket: S3_BUCKET,
                            CopySource: `${S3_BUCKET}/${sourceKey}`,
                            Key: destinationKey
                        }).promise();

                    }

                }
            }

            if (StructureItem.hasOwnProperty('Details')) {
                if (StructureItem.Details.hasOwnProperty('Elements')) {
                    for (const Element of StructureItem.Details.Elements) {
                        if (Element.type === 'image' || Element.type === 'reusableImage') {
                            let source_file_name = Element.data.file.name;
                            let destination_file_name = Element.data.file.name;

                            let sourceKey = `uploads/${tenantID}/${source_folder_name}/${source_file_name}`;
                            let destinationKey = `uploads/${tenantID}/${destination_folder_name}/${destination_file_name}`;

                            await s3.copyObject({
                                Bucket: S3_BUCKET,
                                CopySource: `${S3_BUCKET}/${sourceKey}`,
                                Key: destinationKey
                            }).promise();

                        }
                    }
                }
            }

        }

    }
}
function mergeArraysNoDuplicates(arr1, arr2) {

    const combinedArray = arr1.concat(arr2);

    const mergedArray = combinedArray.reduce((acc, obj) => {
        const isDuplicate = acc.some(item => {
            if (item.Type === obj.Type) {
                if (item.Type === 'ExpeditionLog'
                    && item.ExpeditionLogNumber === obj.ExpeditionLogNumber) {

                    return true;
                }
                if (item.Type === 'MemoryCard'
                    && item.BatchNumber === obj.BatchNumber
                    && item.MemoryCardNumber === obj.MemoryCardNumber) {

                    return true;
                }
                if (item.Type === 'Attachment'
                    && item.Name === obj.Name
                    && item.Label === obj.Label
                    && item.FolderName === obj.FolderName) {

                    return true;
                }

                return false;

            }
            else {
                return false;
            }
        });

        if (!isDuplicate) {
            acc.push(obj);
        }

        return acc;
    }, []);

    return mergedArray;

}

const fetchJourneyforTranslation = async (journeyId) => {
    const tableName = JourneyTableName;
    console.log(`Fetching Journey from DynamoDB: Table - ${tableName}, ID - ${journeyId}`);
    try {
        const params = {
            TableName: tableName,
            Key: {
                ID: journeyId
            }
        };

        const result = await dynamoDB.get(params).promise();
        
        if (!result.Item) {
            throw new Error('Journey not found');
        }

        return result.Item;
    } catch (error) {
        console.error('DynamoDB Fetch Error:', error);
        throw new Error(`Failed to fetch Journey: ${error.message}`);
    }
};
const updateJourneyforTranslation = async (journeyId, field, fieldValue) => {
    const tableName = JourneyTableName; 
    console.log(`Updating Journey in DynamoDB: Table - ${tableName}, ID - ${journeyId}, Field - ${field}`);
    try {
        const params = {
            TableName: tableName,
            Key: {
                ID: journeyId,
            },
            UpdateExpression: `SET #field = :value`, // Dynamically update only the selected field
            ExpressionAttributeNames: {
                '#field': field, // Use an alias for the field name to avoid reserved words
            },
            ExpressionAttributeValues: {
                ':value': fieldValue, // Set the new value for the field
            },
            ReturnValues: 'UPDATED_NEW', // Return the newly updated values
        };
        const result = await dynamoDB.update(params).promise();
        return result;
    } catch (error) {
        console.error('DynamoDB Update Error:', error.message);
        throw new Error(`Failed to update Journey: ${error.message}`);
    }
};

exports.handler = async (event) => {
    const path = event.requestContext.http.path;
    const method = event.requestContext.http.method;

    if (method === 'POST') {
        switch (path) {
            // TODO to be deleted
            case '/v2/journey/adapt-journey-temp':
                return adaptJourneyTemp(event);
            case '/v2/journey/list':
                return listJourneys(event);
            case '/v2/journey/list-user-journeys':
                return listUserJourneys(event);
            case '/v2/journey/list-all-journeys-names':
                return listAllJourneysNames(event);
            case '/v2/journey/create':
                return createJourney(event);
            case '/v2/journey/copy-journey':
                return copyJourney(event);
            // case '/v2/journey/check-journeys-chapters-unlock':
            //     return checkJourneysChaptersUnlock(event);
            case '/v2/journey/update-journey-user-consent':
                return updateJourneyUserConsent(event);
            case '/v2/journey/submit-assignment':
                return submitAssignment(event);
            case '/v2/journey/save-assignment-response':
                return saveAssignmentResponse(event);
            case '/v2/journey-reusable-templates/update-template-status':
                return updateTemplateStatus(event);
            case '/v2/journey-reusable-templates/add-to-pending':
                return addToPendingReusableTemplates(event);
            case '/v2/journey-category/list':
                return listJourneyCategories(event);
            case '/v2/journey-category/create':
                return createJourneyCategory(event);
            case '/v2/add-user-to-journey':
                return addUserToJourney(event);
            case '/v2/list-journeys-images':
                return listJourneysImages(event);
            case '/v2/journey-reusable-templates/list':
                return listJourneyTemplates(event);
            case '/v2/journey-reusable-templates/list-reusable-templates':
                return listJourneyReusableTemplates(event);
            case '/v2/get-journeys-linked-to-participant':
                return getJourneysLinkedToParticipant(event);
            case '/v2/get-participants-linked-to-author':
                return getParticipantsLinkedToAuthor(event);
            case '/v2/get-users-linked-to-journey':
                return getUsersLinkedToJourney(event);
            case '/v2/remove-participant-from-journey':
                return removeParticipantFromJourney(event);
            case '/v2/update-participant-by-author':
                return updateParticipantByAuthor(event);
            case '/v2/file/copy-file-to-S3-folder':
                return copyFileToS3Folder(event);
            case '/v2/file/get-download-signed-url':
                return await getDownloadSignedUrl(event);
            case '/v2/file/get-tenant-logo-signed-url':
                return await getTenantLogoSignedUrl(event);
            case '/v2/file/get-upload-signed-url':
                return await getUploadSignedUrl(event);
            case '/v2/upload/image/upload':
                return await uploadImage(event);
            case '/v2/reusable-assets/list-reusable-journeys-images':
                return await listReusableJourneysImages(event);
            case '/v2/treasure-chest/get-treasure-chest-for-user':
                return getTreasureChestForUser(event);
            case '/v2/reusable-assets/add-existing-image-to-reusable-journeys-images':
                return addExistingImageToReusableJourneysImages(event);
            case '/v2/journey/translate':
                return getJourneyTranslated(event);

            // Add other cases here
            default:
                return Responses._404({ message: 'Endpoint not found' });
        }
    } else if (method === 'PUT') {

        switch (path) {
            case '/v2/journey/set-participants-progress': {
                return setParticipantsProgress(event);
            }
            case '/v2/journey/update-participant-progress': {
                return updateParticipantProgress(event);
            }
            // Add other cases here
            default: {

            }
        }

        if (path.startsWith('/v2/journey/update-active-status')) {
            const id = path.split('/')[4];
            return updateActiveStatus(event, id);
        } else if (path.startsWith('/v2/journey/update-author')) {
            const id = path.split('/')[4];
            return updateAuthor(event, id);
        } else if (path.startsWith('/v2/journey-category/')) {
            const id = path.split('/')[3];
            return updateJourneyCategory(event, id);
        } else if (path.startsWith('/v2/journey/')) {
            const id = path.split('/')[3];
            return updateJourney(event, id);
        }
        return Responses._404({ message: 'Endpoint not found' });

    } else if (method === 'DELETE') {
        if (path.startsWith('/v2/journey-category/')) {
            const id = path.split('/')[3];
            return deleteJourneyCategory(event, id);
        }
        if (path.startsWith('/v2/journey-delete/')) {
            return deleteJourney(event);
        }
        switch(path){
            case '/v2/file/delete-file':
                return deleteFile(event);
            default:
                return Responses._404({ message: 'Endpoint not found' });
        }

    } else {
        return Responses._405({ message: 'Method not allowed, Path: ' + path + ' Method: ' + method });
    }
};

///POST Methots

// Define all the individual functions here
const listJourneys = async (event) => {
    const authorizer_context = event.requestContext.authorizer.lambda;
    const tenantID = authorizer_context.tenant;

    try {

        // Your DynamoDB table name
        //const tableName = process.env.DYNAMODB_JOURNEY_TABLE;

        let journeysList = await getTenantJourneys(tenantID);

        for (const journey of journeysList) {
            journey.Overview = Dynamo.typeConvertorDynamoDBToJavascript(journey.Overview);
            journey.Structure = Dynamo.typeConvertorDynamoDBToJavascript(journey.Structure);
        }

        return Responses._200({ journeysList });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const listUserJourneys = async (event) => {
    try {

        let requestData = JSON.parse(event.body);

        const authorizer_context = event.requestContext.authorizer.lambda;
        const tenantID = authorizer_context.tenant;
        requestData.UserID = authorizer_context.username;

        // get all tenant journeys
        let tenantJourneysList = await getTenantJourneys(tenantID);

        let journeysList = [];
        let journeysAuthorList = [];
        let journeysParticipantList = [];

        //get journeys which user is an author
        journeysAuthorList = tenantJourneysList.filter((tenantJourney) => tenantJourney.AuthorID === requestData.UserID);
        for (const journey of journeysAuthorList) {
            journey.Overview = Dynamo.typeConvertorDynamoDBToJavascript(journey.Overview);
            journey.Structure = Dynamo.typeConvertorDynamoDBToJavascript(journey.Structure);
            journey.IsCurrentUserAuthor = true;
            journey.IsCurrentUserCoAuthor = false;
            journey.IsCurrentUserManager = false;
            journey.IsCurrentUserAssistant = false;
            journey.IsCurrentUserParticipant= false;

            let journeyAssignments = await getJourneyAssignments(journey.ID);

            for (let assignment of journeyAssignments) {
                assignment.Unlock = await Dynamo.typeConvertorDynamoDBToJavascript(assignment.Unlock);
                assignment.Quizzes = await Dynamo.typeConvertorDynamoDBToJavascript(assignment.Quizzes);
            }

            for (let structureItem of journey.Structure) {

                if (structureItem.Type === 'Event' && structureItem.hasOwnProperty('Assignment') && structureItem.Assignment.hasOwnProperty('ID') && structureItem.Assignment.ID !== null) {

                    let foundAssignment = journeyAssignments.find((journeyAssignment) => journeyAssignment.ID === structureItem.Assignment.ID);

                    if (foundAssignment !== undefined) {
                        foundAssignment.isParticipantScorePopupDisplayed = false;
                        structureItem.Assignment = foundAssignment;
                    }
                }
                if (structureItem.Type === 'Event' && (!structureItem.hasOwnProperty('Assignment') || !structureItem.Assignment.hasOwnProperty('ID') || structureItem.Assignment.ID === null)) {
                    structureItem.Assignment = {
                        ID: null,
                        IsReady: false,
                        IsResettable: true,
                        Unlock: {
                            IsUnlock: false,
                            MinPercentage: 0,
                        },
                        Quizzes: [],
                    }
                }
            }

        }


        // get journeys for which user is linked to, but not author
        const ExpressionAttributeValues = "ID, Consent, JourneyID, JourneyRole, ParticipantProgress";
        let participantJourneyLinks = await getJourneyParticipantsLinks(event, tenantID, null, requestData.UserID, null, ExpressionAttributeValues);

        const paramsQueryTreasureChest = {
            TableName: TreasureChestTableName,
            IndexName: 'treasureChestGSI',
            KeyConditionExpression: "#UserID = :UserID",
            ExpressionAttributeNames: {
                '#UserID': 'UserID',
            },
            ExpressionAttributeValues: {
                ":UserID": requestData.UserID
            },
            ScanIndexForward: false,
        };

        const linkedTreasureChestEntries = await dynamoDB.query(paramsQueryTreasureChest).promise();

        // if links found, get the journey
        if (participantJourneyLinks.length > 0) {

            // let participantJourneyLinks = responseScanJourneyParticipantRelationTable.Items;

            for (let participantJourneyLink of participantJourneyLinks) {

                let journeyID = participantJourneyLink.JourneyID;

                let journey = tenantJourneysList.find((tenantJourney) => tenantJourney.ID === journeyID);

                if (journey !== undefined) {

                    journey.Overview = Dynamo.typeConvertorDynamoDBToJavascript(journey.Overview);
                    journey.Structure = Dynamo.typeConvertorDynamoDBToJavascript(journey.Structure);

                    journey.JourneyRole = participantJourneyLink.JourneyRole;
                    journey.Consent = participantJourneyLink.Consent;
                    journey.JourneyParticipantLinkID = participantJourneyLink.ID;
                    journey.IsCurrentUserAuthor = false;
                    journey.IsCurrentUserCoAuthor = (participantJourneyLink.JourneyRole === 'Co-Author');
                    journey.IsCurrentUserManager = (participantJourneyLink.JourneyRole === 'Manager');
                    journey.IsCurrentUserAssistant = (participantJourneyLink.JourneyRole === 'Assistant');
                    journey.IsCurrentUserParticipant = (participantJourneyLink.JourneyRole === 'Participant');

                    // get participant progress
                    let participantProgress = Dynamo.typeConvertorDynamoDBToJavascript(participantJourneyLink.ParticipantProgress);
                    if (participantProgress !== undefined && participantProgress !== null) {

                        journey.Structure = journey.Structure.filter((structureItem) => !structureItem.IsHidden);
                        journey.ParticipantProgress = participantProgress;

                        let participantAssignments = participantProgress.filter((progress) => progress.Type === 'Assignment');

                        let journeyAssignments = await getJourneyAssignments(journey.ID);

                        for (let assignment of journeyAssignments) {
                            assignment.Unlock = Dynamo.typeConvertorDynamoDBToJavascript(assignment.Unlock);
                            assignment.Quizzes = Dynamo.typeConvertorDynamoDBToJavascript(assignment.Quizzes);
                        }

                        let unreadyAssignmentStructureItemIDs = [];

                        for (let [indexStructureItem, structureItem] of journey.Structure.entries()) {

                            let progressItem = participantProgress.find((progress) => progress.StructureItemID === structureItem.ID);

                            if (progressItem !== undefined) {
                                structureItem.IsLocked = progressItem.IsLocked;
                            }

                            if (structureItem.Type === 'Event' && structureItem.hasOwnProperty('Assignment') && structureItem.Assignment.hasOwnProperty('ID') && structureItem.Assignment.ID !== null) {

                                let foundAssignment = journeyAssignments.find((journeyAssignment) => journeyAssignment.ID === structureItem.Assignment.ID);

                                if (foundAssignment !== undefined) {

                                    if (!journey.IsCurrentUserAuthor
                                        && participantAssignments !== undefined
                                        && participantAssignments !== null) {

                                        let foundParticipantAssignment = participantAssignments.find((participantAssignment) => participantAssignment.Assignment.ID === foundAssignment.ID);

                                        if (foundParticipantAssignment !== undefined) {
                                            foundAssignment.ParticipantScorePercentage = foundParticipantAssignment.Assignment.ParticipantScorePercentage;
                                            foundAssignment.IsSubmitted = foundParticipantAssignment.Assignment.hasOwnProperty('IsSubmitted') ? foundParticipantAssignment.Assignment.IsSubmitted : false;
                                        }

                                        foundAssignment.Quizzes.forEach((quiz) => {

                                            let foundParticipantQuiz;
                                            if (foundParticipantAssignment !== undefined) {
                                                foundParticipantQuiz = foundParticipantAssignment.Assignment.Quizzes.find((participantQuiz) => participantQuiz.ID === quiz.ID);
                                            }
                                            else {
                                                foundParticipantQuiz = undefined;
                                            }

                                            switch (quiz.Type) {

                                                case 'Checklist': {
                                                    quiz.Content.Tasks.forEach((item) => {
                                                        if (foundParticipantQuiz !== undefined) {
                                                            let fountParticipantItem = foundParticipantQuiz.Tasks.find((participantItem) => participantItem.ID === item.ID);

                                                            if (fountParticipantItem !== undefined) {
                                                                item.IsDone = fountParticipantItem.IsDone;
                                                            }
                                                        }
                                                    });
                                                    break;
                                                }

                                                case 'Multiple Choice': {
                                                    quiz.Content.Items.forEach((item) => {

                                                        let fountParticipantItem;

                                                        if (foundParticipantQuiz !== undefined) {
                                                            fountParticipantItem = foundParticipantQuiz.Items.find((participantItem) => participantItem.ID === item.ID);
                                                        }

                                                        item.Options.forEach((option) => {
                                                            if (journey.IsCurrentUserParticipant && !foundAssignment.IsSubmitted && option.hasOwnProperty('IsCorrect')) {
                                                                delete option.IsCorrect;
                                                            }

                                                            if (foundParticipantQuiz !== undefined && fountParticipantItem !== undefined) {
                                                                const participantOption = fountParticipantItem.Options.find((participantOption) => participantOption.ID === option.ID);

                                                                if (participantOption !== undefined) {
                                                                    option.ParticipantAnswer = participantOption.ParticipantAnswer;
                                                                }
                                                            }
                                                        })

                                                    });
                                                    break;
                                                }

                                                case 'True/False': {
                                                    quiz.Content.Items.forEach((item) => {
                                                        if (journey.IsCurrentUserParticipant && !foundAssignment.IsSubmitted && item.hasOwnProperty('CorrectAnswer')) {
                                                            delete item.CorrectAnswer;
                                                        }
                                                        if (foundParticipantQuiz !== undefined) {
                                                            let fountParticipantItem = foundParticipantQuiz.Items.find((participantItem) => participantItem.ID === item.ID);

                                                            if (fountParticipantItem !== undefined) {
                                                                item.ParticipantAnswer = fountParticipantItem.ParticipantAnswer;
                                                            }
                                                        }
                                                    });
                                                    break;
                                                }

                                                case 'Item Match': {
                                                    quiz.Content.LeftItems.forEach((item) => {
                                                        if (journey.IsCurrentUserParticipant && !foundAssignment.IsSubmitted && item.hasOwnProperty('MatchesIDs')) {
                                                            delete item.MatchesIDs;
                                                        }
                                                        if (foundParticipantQuiz !== undefined) {
                                                            let fountParticipantItem = foundParticipantQuiz.LeftItems.find((participantItem) => participantItem.ID === item.ID);

                                                            if (fountParticipantItem !== undefined) {
                                                                item.ParticipantMatchesIDs = fountParticipantItem.ParticipantMatchesIDs;
                                                            }
                                                        }
                                                    });
                                                    quiz.Content.RightItems.forEach((item) => {
                                                        if (journey.IsCurrentUserParticipant && !foundAssignment.IsSubmitted && item.hasOwnProperty('MatchesIDs')) {
                                                            delete item.MatchesIDs;
                                                        }
                                                        if (foundParticipantQuiz !== undefined) {
                                                            let fountParticipantItem = foundParticipantQuiz.RightItems.find((participantItem) => participantItem.ID === item.ID);

                                                            if (fountParticipantItem !== undefined) {
                                                                item.ParticipantMatchesIDs = fountParticipantItem.ParticipantMatchesIDs;
                                                            }
                                                        }
                                                    });
                                                    break;
                                                }

                                                case 'Questions With Written Answers': {
                                                    quiz.Content.Items.forEach((item) => {
                                                        if (foundParticipantQuiz !== undefined) {
                                                            let fountParticipantItem = foundParticipantQuiz.Items.find((participantItem) => participantItem.ID === item.ID);

                                                            if (fountParticipantItem !== undefined) {
                                                                item.ParticipantAnswer = fountParticipantItem.ParticipantAnswer;
                                                            }
                                                        }
                                                    });
                                                    break;
                                                }

                                                case 'Evaluation': {
                                                    quiz.Content.Items.forEach((item) => {
                                                        if (foundParticipantQuiz !== undefined) {
                                                            let fountParticipantItem = foundParticipantQuiz.Items.find((participantItem) => participantItem.ID === item.ID);

                                                            if (fountParticipantItem !== undefined) {
                                                                item.ParticipantRating = fountParticipantItem.ParticipantRating;
                                                            }
                                                        }
                                                    });
                                                    break;
                                                }

                                                default: {

                                                    break;
                                                }

                                            }

                                        });

                                    }

                                    // participants get only ready assignments
                                    if (foundAssignment.IsReady) {

                                        foundAssignment.isParticipantScorePopupDisplayed = false;
                                        structureItem.Assignment = foundAssignment;

                                        // if (structureItem.Assignment.Unlock.IsUnlock) {
                                        //     if (structureItem.Assignment.ParticipantScorePercentage < structureItem.Assignment.Unlock.MinPercentage) {
                                        //         lockRemainingStructureItems = true;
                                        //     }
                                        // }
                                    }
                                    else {
                                        // structureItem.Assignment.ID = null;
                                        // journey.Structure.splice(indexStructureItem, 1);
                                        unreadyAssignmentStructureItemIDs.push(structureItem.ID);
                                    }
                                }
                            }

                            if (structureItem.Type === 'Event' && (!structureItem.hasOwnProperty('Assignment') || !structureItem.Assignment.hasOwnProperty('ID') || structureItem.Assignment.ID === null)) {
                                structureItem.Assignment = {
                                    ID: null,
                                    IsReady: false,
                                    IsResettable: true,
                                    Unlock: {
                                        IsUnlock: false,
                                        MinPercentage: 0,
                                    },
                                    Quizzes: [],
                                }
                            }
                        }

                        journey.Structure = journey.Structure.filter((structureItem) => (!unreadyAssignmentStructureItemIDs.includes(structureItem.ID)));

                        journey = await checkParticipantJourneyContentUnlock(journey, journeyAssignments, linkedTreasureChestEntries, requestData.UserID, tenantID);
                        journey.ParticipantProgressPercentage = calculateJourneyCompletionPercentage(journey.ParticipantProgress, journey.Structure);

                        journeysParticipantList.push(journey);
                    }

                }

            }

        }

        journeysList = journeysAuthorList.concat(journeysParticipantList);

        return Responses._200({ journeysList });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const listAllJourneysNames = async (event) => {
    const authorizer_context = event.requestContext.authorizer.lambda;
    const tenantID = authorizer_context.tenant;

    try {

        // Your DynamoDB table name
        //const tableName = process.env.DYNAMODB_JOURNEY_TABLE;

        let journeysList = await getTenantJourneys(tenantID);

        let journeysNames = [];

        for (const journey of journeysList) {
            journeysNames.push({
                ID: journey.ID,
                Name: journey.Name,
            });
        }

        return Responses._200({ journeysNames });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const createJourney = async (event) => {

    const authorizer_context = event.requestContext.authorizer.lambda;
    const tenantID = authorizer_context.tenant;

    let requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('Name')
            && requestData.hasOwnProperty('Description')
            && requestData.hasOwnProperty('CategoryID')
            && requestData.hasOwnProperty('Picture')
            && requestData.hasOwnProperty('Overview')
            && requestData.hasOwnProperty('Structure')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    requestData.ID = uuid.v4();
    requestData.AuthorID = authorizer_context.username;
    requestData.Overview = Dynamo.typeConvertorJavascriptToDynamoDB(requestData.Overview);
    requestData.Structure = Dynamo.typeConvertorJavascriptToDynamoDB(requestData.Structure);
    requestData.Active = true;
    requestData.TenantID = tenantID;

    try {

        const newJourney = await Dynamo.write(requestData, JourneyTableName).catch(error => {
            return Responses._500({ message: error.message });
        });

        newJourney.Overview = Dynamo.typeConvertorDynamoDBToJavascript(newJourney.Overview);
        newJourney.Structure = Dynamo.typeConvertorDynamoDBToJavascript(newJourney.Structure);

        return Responses._200({ newJourney });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const copyJourney = async (event) => {
    const authorizer_context = event.requestContext.authorizer.lambda;
    const tenantID = authorizer_context.tenant;

    let requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('Name')
            && requestData.hasOwnProperty('Description')
            && requestData.hasOwnProperty('CategoryID')
            && requestData.hasOwnProperty('Picture')
            && requestData.hasOwnProperty('Overview')
            && requestData.hasOwnProperty('Structure')
            && (requestData.hasOwnProperty('TemplateID') || requestData.hasOwnProperty('JourneyID'))
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        let sourceID = null;
        let sourceFolder = null;

        // if request has TemplateID => create from template
        if (requestData.hasOwnProperty('TemplateID')) {
            sourceID = requestData.TemplateID;
            sourceFolder = 'journey_reusable_templates';
        }
        // if request has TemplateID => create directly from journey
        if (requestData.hasOwnProperty('JourneyID')) {
            sourceID = requestData.JourneyID;
            sourceFolder = 'journey';
        }

        let journeyOriginalAssignments = [];

        for (let structureItem of requestData.Structure) {

            if (structureItem.Type === 'Event'
                && structureItem.hasOwnProperty('Assignment')
                && structureItem.Assignment.hasOwnProperty('ID')
                && structureItem.Assignment.ID !== null) {

                let assignment = {
                    ID: structureItem.Assignment.ID,
                    NewID: uuid.v4(),
                };

                if (structureItem.Assignment.Quizzes.length > 0) {

                    journeyOriginalAssignments.push(assignment);

                    structureItem.Assignment = {
                        ID: assignment.NewID,
                    };
                } else {
                    structureItem.Assignment = {
                        ID: null,
                    };
                }

            }

        }

        let payloadCreateNewJourney = {
            "ID": uuid.v4(),
            "Name": requestData.Name + ' (Copy)',
            "Description": requestData.Description,
            "AuthorID": authorizer_context.username,
            "CategoryID": requestData.CategoryID,
            "Picture": requestData.Picture,
            "Overview": Dynamo.typeConvertorJavascriptToDynamoDB(requestData.Overview),
            "Structure": Dynamo.typeConvertorJavascriptToDynamoDB(requestData.Structure),
            "Active": true,
            "TenantID": tenantID,
        }

        const newJourney = await Dynamo.write(payloadCreateNewJourney, JourneyTableName).catch(error => {
            return Responses._500({ message: error.message });
        });

        if (requestData.Picture !== null && requestData.Picture !== undefined && requestData.Picture !== '') {
            await copyJourneyMainPicture(sourceID, sourceFolder, newJourney.ID, tenantID, requestData.Picture);
        }


        await copyOverviewAssets(sourceID, sourceFolder, newJourney.ID, tenantID, requestData.Overview);

        await copyStructureAssets(sourceID, sourceFolder, newJourney.ID, tenantID, requestData.Structure);

        newJourney.Overview = Dynamo.typeConvertorDynamoDBToJavascript(newJourney.Overview);
        newJourney.Structure = Dynamo.typeConvertorDynamoDBToJavascript(newJourney.Structure);

        const journeyExistingAssignments = await getJourneyAssignments(sourceID);

        for (let assignment of journeyExistingAssignments) {

            let foundOriginalAssignment = journeyOriginalAssignments.find((originalAssignment) => originalAssignment.ID === assignment.ID);

            if (foundOriginalAssignment !== undefined) {

                assignment.ID = foundOriginalAssignment.NewID;
                assignment.JourneyID = newJourney.ID;

                await Dynamo.write(assignment, AssignmentTableName).catch(error => {
                    return Responses._500({ message: error.message });
                });
            }

        }

        return Responses._200({ newJourney });

    } catch (error) {
        return Responses._500({ message: error.message });
    }

};
const checkParticipantJourneyContentUnlock = async (journey, journeyExistingAssignments, linkedTreasureChestEntries, userID, tenantID) => {
    try {

        const textUnlockChapter = 'New content is now available for you in the learning journey ';
        const textTreasureChestUpdate = ' Horray, you got a new item in your Treasure Chest!';

        let notificationMessageFinal = '';
        let isNewStructureItemUnlocked = false;
        let isTreasureChestUpdated = false;

        let newParticipantProgress = buildParticipantProgress(journey.Structure, journeyExistingAssignments, journey.ParticipantProgress);

        // check if any of the chapters needs to be unlocked
        let treasureChestAssetsToGive = [];

        journey.Structure.forEach((structureItem) => {

            let newProgress = newParticipantProgress.find((newProgress) => newProgress.StructureItemID === structureItem.ID);

            if (newProgress !== undefined) {

                if (structureItem.Type === 'Chapter') {

                    if (structureItem.IsLocked && !newProgress.IsLocked && !isNewStructureItemUnlocked) {
                        notificationMessageFinal += textUnlockChapter + journey.Name + '.';
                        isNewStructureItemUnlocked = true;
                    }

                    structureItem.IsLocked = newProgress.IsLocked;

                    if (structureItem.hasOwnProperty('Units')) {

                        structureItem.Units.forEach((unit, indexUnit) => {

                            // check for linked treasure chest assets that need to be assigned to participants
                            if (!structureItem.IsLocked && unit.LinkedAssets.length > 0) {

                                let assetsToGive = [];

                                unit.LinkedAssets.forEach((linkedAsset) => {

                                    let treasureChestAssetObject = null;

                                    if (linkedAsset.Type === 'ExpeditionLog') {
                                        treasureChestAssetObject = {
                                            Type: linkedAsset.Type,
                                            ExpeditionLogNumber: linkedAsset.ExpeditionLogNumber,
                                            Sources: {
                                                Journeys: [journey.ID]
                                            }
                                        }
                                    }

                                    if (linkedAsset.Type === 'MemoryCard') {
                                        treasureChestAssetObject = {
                                            Type: linkedAsset.Type,
                                            BatchNumber: linkedAsset.BatchNumber,
                                            MemoryCardNumber: linkedAsset.MemoryCardNumber,
                                            Sources: {
                                                Journeys: [journey.ID]
                                            }
                                        }
                                    }

                                    if (linkedAsset.Type === 'Attachment' && linkedAsset.IsTreasureChestAsset) {
                                        treasureChestAssetObject = {
                                            Type: linkedAsset.Type,
                                            Name: linkedAsset.Name,
                                            Label: linkedAsset.Label,
                                            FolderName: linkedAsset.FolderName,
                                            Sources: {
                                                Journeys: [journey.ID]
                                            }
                                        }
                                    }

                                    if (treasureChestAssetObject !== null) {
                                        assetsToGive.push(treasureChestAssetObject);
                                    }

                                });

                                if (assetsToGive.length > 0) {
                                    treasureChestAssetsToGive = mergeArraysNoDuplicates(treasureChestAssetsToGive, assetsToGive);
                                }

                            }

                        });
                    }
                }

                // convert periods to universal time
                // check events for modules with unlock time
                if (structureItem.Type === 'Event') {

                    if (structureItem.IsLocked && !newProgress.IsLocked && !isNewStructureItemUnlocked) {
                        notificationMessageFinal += textUnlockChapter + journey.Name + '.';
                        isNewStructureItemUnlocked = true;
                    }

                    structureItem.IsLocked = newProgress.IsLocked;

                    // event always gives assets that have an unlock event
                    if (!structureItem.IsLocked && structureItem.LinkedAssets.length > 0) {

                        let assetsToGive = [];

                        structureItem.LinkedAssets.forEach((linkedAsset) => {

                            let treasureChestAssetObject = null;

                            if (linkedAsset.Type === 'ExpeditionLog') {
                                treasureChestAssetObject = {
                                    Type: linkedAsset.Type,
                                    ExpeditionLogNumber: linkedAsset.ExpeditionLogNumber,
                                    Sources: {
                                        Journeys: [journey.ID]
                                    }
                                }
                            }

                            if (linkedAsset.Type === 'MemoryCard') {
                                treasureChestAssetObject = {
                                    Type: linkedAsset.Type,
                                    BatchNumber: linkedAsset.BatchNumber,
                                    MemoryCardNumber: linkedAsset.MemoryCardNumber,
                                    Tags: [],
                                    Sources: {
                                        Journeys: [journey.ID]
                                    }
                                }
                            }

                            if (linkedAsset.Type === 'Attachment' && linkedAsset.IsTreasureChestAsset) {
                                treasureChestAssetObject = {
                                    Type: linkedAsset.Type,
                                    Name: linkedAsset.Name,
                                    Label: linkedAsset.Label,
                                    FolderName: linkedAsset.FolderName,
                                    Tags: [],
                                    Sources: {
                                        Journeys: [journey.ID]
                                    }
                                }
                            }

                            if (treasureChestAssetObject !== null) {
                                assetsToGive.push(treasureChestAssetObject);
                            }

                        });

                        if (assetsToGive.length > 0) {
                            treasureChestAssetsToGive = mergeArraysNoDuplicates(treasureChestAssetsToGive, assetsToGive);
                        }

                    }

                    // if (structureItem.Options.IsUnlock && structureItem.Periods.Unlock !== null) {
                    //
                    //     let currentTime = new Date();
                    //
                    //     if (currentTime < new Date(structureItem.Periods.Unlock)) {
                    //         lockRemainingStructureItems = true;
                    //     }
                    //
                    //     structureItem.Periods.Unlock = new Date(structureItem.Periods.Unlock).toISOString();
                    //
                    // }
                    //
                    // if (structureItem.Options.IsMeeting && structureItem.Periods.From !== null) {
                    //     structureItem.Periods.From = new Date(structureItem.Periods.From).toISOString();
                    // }
                    //
                    // if (structureItem.Options.IsMeeting && structureItem.Periods.To !== null) {
                    //     structureItem.Periods.To = new Date(structureItem.Periods.To).toISOString();
                    // }

                }

            }

        });


        if (isNewStructureItemUnlocked) {
            let params = {
                TableName: JourneyParticipantRelationTableName,
                Key: {
                    ID: journey.JourneyParticipantLinkID,
                },
                UpdateExpression: 'SET #ParticipantProgress = :ParticipantProgress',
                ExpressionAttributeNames: {
                    '#ParticipantProgress': 'ParticipantProgress',
                },
                ExpressionAttributeValues: {
                    ':ParticipantProgress': Dynamo.typeConvertorJavascriptToDynamoDB(newParticipantProgress),
                },
                ReturnValues: 'NONE',
            };

            await dynamoDB.update(params).promise();
        }

        journey.ParticipantProgress = newParticipantProgress;

        let userUpdatedTreasureChestAssets = [];

        // const paramsQueryTreasureChest = {
        //     TableName: TreasureChestTableName,
        //     IndexName: 'treasureChestGSI',
        //     KeyConditionExpression: "#UserID = :UserID",
        //     ExpressionAttributeNames: {
        //         '#UserID': 'UserID',
        //     },
        //     ExpressionAttributeValues: {
        //         ":UserID": userID
        //     },
        //     ScanIndexForward: false,
        // };
        //
        // const linkedTreasureChestEntries = await dynamoDB.query(paramsQueryTreasureChest).promise();

        // user hasn't got an entry in the treasure chest table
        if (linkedTreasureChestEntries.Count === 0) {

            userUpdatedTreasureChestAssets = treasureChestAssetsToGive;

            // make an entry for the user in treasure chest table
            let paramsTreasureChest = {
                ID: uuid.v4(),
                UserID: userID,
                Assets: Dynamo.typeConvertorJavascriptToDynamoDB(userUpdatedTreasureChestAssets),
            }

            await Dynamo.write(paramsTreasureChest, TreasureChestTableName).catch(error => {
                return Responses._500({message: error.message});
            });
        }

        // user already has an entry in treasure chest table
        if (linkedTreasureChestEntries.Count === 1) {

            let treasureChestEntry = linkedTreasureChestEntries.Items[0];

            let userOldTreasureChestAssets = Dynamo.typeConvertorDynamoDBToJavascript(treasureChestEntry.Assets);

            // add to user treasure chest only assets that the users didn't have, to be removed
            // userUpdatedTreasureChestAssets = mergeArraysNoDuplicates(userOldTreasureChestAssets, treasureChestAssetsToGive);

            // if user already has the asset, only update the sources property, we need this to filter user treasure chest
            userUpdatedTreasureChestAssets = userOldTreasureChestAssets;

            for (let treasureChestAssetToGive of treasureChestAssetsToGive) {

                let isDuplicate = false;

                for (let userUpdatedTreasureChestAsset of userUpdatedTreasureChestAssets) {

                    if (treasureChestAssetToGive.Type === userUpdatedTreasureChestAsset.Type) {
                        if (treasureChestAssetToGive.Type === 'ExpeditionLog'
                            && treasureChestAssetToGive.ExpeditionLogNumber === userUpdatedTreasureChestAsset.ExpeditionLogNumber) {

                            let newTreasureChestAssetToGive = treasureChestAssetToGive.Sources.Journeys.filter(item => !userUpdatedTreasureChestAsset.Sources.Journeys.includes(item));
                            if (newTreasureChestAssetToGive.length > 0) {
                                userUpdatedTreasureChestAsset.Sources.Journeys = userUpdatedTreasureChestAsset.Sources.Journeys.concat(newTreasureChestAssetToGive);
                            }
                            isDuplicate = true;
                            break;
                        }
                        if (treasureChestAssetToGive.Type === 'MemoryCard'
                            && treasureChestAssetToGive.BatchNumber === userUpdatedTreasureChestAsset.BatchNumber
                            && treasureChestAssetToGive.MemoryCardNumber === userUpdatedTreasureChestAsset.MemoryCardNumber) {

                            let newTreasureChestAssetToGive = treasureChestAssetToGive.Sources.Journeys.filter(item => !userUpdatedTreasureChestAsset.Sources.Journeys.includes(item));
                            if (newTreasureChestAssetToGive.length > 0) {
                                userUpdatedTreasureChestAsset.Sources.Journeys = userUpdatedTreasureChestAsset.Sources.Journeys.concat(newTreasureChestAssetToGive);
                            }
                            isDuplicate = true;
                            break;
                        }
                        if (treasureChestAssetToGive.Type === 'Attachment'
                            && treasureChestAssetToGive.Name === userUpdatedTreasureChestAsset.Name
                            && treasureChestAssetToGive.Label === userUpdatedTreasureChestAsset.Label
                            && treasureChestAssetToGive.FolderName === userUpdatedTreasureChestAsset.FolderName) {

                            userUpdatedTreasureChestAsset.Sources.Journeys = userUpdatedTreasureChestAsset.Sources.Journeys.concat(treasureChestAssetToGive.Sources.Journeys);
                            isDuplicate = true;
                            break;
                        }

                    }

                }

                if (!isDuplicate) {
                    userUpdatedTreasureChestAssets.push(treasureChestAssetToGive);
                    if (!isTreasureChestUpdated) {
                        notificationMessageFinal += textTreasureChestUpdate;
                        isTreasureChestUpdated = true;
                    }
                }

            }

            if (isTreasureChestUpdated) {
                let paramsUpdateTreasureChestEntry = {
                    TableName: TreasureChestTableName,
                    Key: {
                        ID: treasureChestEntry.ID,
                    },
                    UpdateExpression: 'SET #Assets = :Assets',
                    ExpressionAttributeNames: {
                        '#Assets': 'Assets',
                    },
                    ExpressionAttributeValues: {
                        ':Assets': Dynamo.typeConvertorJavascriptToDynamoDB(userUpdatedTreasureChestAssets),
                    },
                    ReturnValues: 'NONE',
                };

                await dynamoDB.update(paramsUpdateTreasureChestEntry).promise();
            }

        }

        // add notification message for user and set the isChange flag to true
        if (notificationMessageFinal !== '') {

            let paramsAddNotification = {
                ID: uuid.v4(),
                UserID: userID,
                Message: notificationMessageFinal,
                TenantID: tenantID,
            }

            await Dynamo.write(paramsAddNotification, UserNotificationsTableName).catch(error => {
                return Responses._500({message: error.message});
            });
        }

        return journey;

    }
    catch (error) {
        throw new Error(error);
    }
}
const updateJourneyUserConsent = async (event) => {
    let requestData = JSON.parse(event.body);
    //
    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('JourneyParticipantLinkID'));
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        let params = {
            TableName: JourneyParticipantRelationTableName,
            Key: {
                ID: requestData.JourneyParticipantLinkID,
            },
            UpdateExpression: 'SET #consent = :consent',
            ExpressionAttributeNames: {
                '#consent': 'Consent',
            },
            ExpressionAttributeValues: {
                ':consent': true,
            },
            ReturnValues: 'NONE',
        };

        await dynamoDB.update(params).promise();

        return Responses._200({ message: 'Consent updated successfully' });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const updateTemplateStatus = async (event) => {
    // const authorizer_context = event.requestContext.authorizer.lambda;
    // const tenantID = authorizer_context.tenant;

    let requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return ( requestData.hasOwnProperty('ID')
            && requestData.hasOwnProperty('Reusable')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        let paramsUpdateTemplateStatus = {
            TableName: JourneyReusableTemplatesTableName,
            Key: {
                ID: requestData.ID,
            },
            UpdateExpression: 'SET #Reusable = :Reusable',
            ExpressionAttributeNames: {
                '#Reusable': 'Reusable',
            },
            ExpressionAttributeValues: {
                ':Reusable': requestData.Reusable,
            },
            ReturnValues: 'NONE',
        };

        await dynamoDB.update(paramsUpdateTemplateStatus).promise();

        return Responses._200({ message: 'Journey reusable template status updates successfully' });

    } catch (error) {
        return Responses._500({ message: error.message });
    }

};
const addToPendingReusableTemplates = async (event) => {
    const authorizer_context = event.requestContext.authorizer.lambda;
    const tenantID = authorizer_context.tenant;

    let requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return ( requestData.hasOwnProperty('JourneyID')
            && requestData.hasOwnProperty('Name')
            && requestData.hasOwnProperty('Description')
            && requestData.hasOwnProperty('AuthorID')
            && requestData.hasOwnProperty('CategoryID')
            && requestData.hasOwnProperty('Picture')
            && requestData.hasOwnProperty('Overview')
            && requestData.hasOwnProperty('Structure')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        let journeyOriginalAssignments = [];

        for (let structureItem of requestData.Structure) {

            if (structureItem.Type === 'Event'
                && structureItem.hasOwnProperty('Assignment')
                && structureItem.Assignment.hasOwnProperty('ID')
                && structureItem.Assignment.ID !== null) {

                let assignment = {
                    ID: structureItem.Assignment.ID,
                    NewID: uuid.v4(),
                };

                if (structureItem.Assignment.Quizzes.length > 0) {

                    journeyOriginalAssignments.push(assignment);

                    structureItem.Assignment = {
                        ID: assignment.NewID,
                    };
                } else {
                    structureItem.Assignment = {
                        ID: null,
                    };
                }

            }

        }


        let paramsNewPendingJourneyReusableTemplate = {
            ID: uuid.v4(),
            JourneyID: requestData.JourneyID,
            Name: requestData.Name,
            Description: requestData.Description,
            AuthorID: requestData.AuthorID,
            CategoryID: requestData.CategoryID,
            Picture: requestData.Picture,
            Overview: Dynamo.typeConvertorJavascriptToDynamoDB(requestData.Overview),
            Structure: Dynamo.typeConvertorJavascriptToDynamoDB(requestData.Structure),
            Reusable: false,
            TenantID: tenantID,
        }
        const newPendingJourneyReusableTemplate = await Dynamo.write(paramsNewPendingJourneyReusableTemplate, JourneyReusableTemplatesTableName).catch(error => {
            return Responses._500({ message: error.message });
        });


        if (requestData.Picture !== null && requestData.Picture !== undefined && requestData.Picture !== '') {
            await copyJourneyMainPictureTemplates(requestData.JourneyID, newPendingJourneyReusableTemplate.ID, tenantID, requestData.Picture);
        }

        await copyOverviewAssetsTemplates(requestData.JourneyID, newPendingJourneyReusableTemplate.ID, tenantID, requestData.Overview);

        await copyStructureAssetsTemplates(requestData.JourneyID, newPendingJourneyReusableTemplate.ID, tenantID, requestData.Structure);


        newPendingJourneyReusableTemplate.Overview = Dynamo.typeConvertorDynamoDBToJavascript(newPendingJourneyReusableTemplate.Overview);
        newPendingJourneyReusableTemplate.Structure = Dynamo.typeConvertorDynamoDBToJavascript(newPendingJourneyReusableTemplate.Structure);

        const journeyExistingAssignments = await getJourneyAssignments(requestData.JourneyID);

        for (let assignment of journeyExistingAssignments) {

            let foundOriginalAssignment = journeyOriginalAssignments.find((originalAssignment) => originalAssignment.ID === assignment.ID);

            if (foundOriginalAssignment !== undefined) {

                assignment.ID = foundOriginalAssignment.NewID;
                assignment.JourneyID = newPendingJourneyReusableTemplate.ID;

                await Dynamo.write(assignment, AssignmentTableName).catch(error => {
                    return Responses._500({ message: error.message });
                });
            }

        }

        return Responses._200({ newPendingJourneyReusableTemplate });


        // let paramsNewPendingJourneyReusableTemplate = {
        //     ID: uuid.v4(),
        //     JourneyID: requestData.JourneyID,
        //     Name: requestData.Name,
        //     Description: requestData.Description,
        //     AuthorID: requestData.AuthorID,
        //     CategoryID: requestData.CategoryID,
        //     Picture: requestData.Picture,
        //     Overview: Dynamo.typeConvertorJavascriptToDynamoDB(requestData.Overview),
        //     Structure: Dynamo.typeConvertorJavascriptToDynamoDB(requestData.Structure),
        //     Reusable: false,
        //     TenantID: tenantID,
        // }
        // const newPendingJourneyReusableTemplate = await Dynamo.write(paramsNewPendingJourneyReusableTemplate, JourneyReusableTemplatesTableName).catch(error => {
        //     return Responses._500({ message: error.message });
        // });
        //
        // const sourceFolder = `uploads/${tenantID}/journey/${requestData.JourneyID}`;
        // const destinationFolder = `uploads/${tenantID}/journey_reusable_templates/${newPendingJourneyReusableTemplate.ID}`;
        //
        // // List all objects in the source folder
        // const listParams = {
        //     Bucket: S3_BUCKET,
        //     Prefix: sourceFolder
        // };
        //
        // const listedObjects = await s3.listObjectsV2(listParams).promise();
        //
        // // Copy each object to the destination folder
        // for (const object of listedObjects.Contents) {
        //     const copySource = `${S3_BUCKET}/${object.Key}`;
        //     const destinationKey = object.Key.replace(sourceFolder, destinationFolder);
        //
        //     const copyParams = {
        //         Bucket: S3_BUCKET,
        //         CopySource: copySource,
        //         Key: destinationKey
        //     };
        //
        //     await s3.copyObject(copyParams).promise();
        // }
        //
        // return Responses._200({ message: 'Journey added to pending reusable templates' });


    } catch (error) {
        return Responses._500({ message: error.message });
    }

};
const listJourneyCategories = async (event) => {
    try {

        const authorizer_context = event.requestContext.authorizer.lambda;
        const tenantID = authorizer_context.tenant;

        let journeyCategoriesList = await getJourneysCategories(event, tenantID);

        return Responses._200({ journeyCategoriesList });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const createJourneyCategory = async (event) => {
    let requestData = JSON.parse(event.body);

    const authorizer_context = event.requestContext.authorizer.lambda;
    requestData.TenantID = authorizer_context.tenant;

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('Name'));
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        requestData.ID = uuid.v4();

        const newJourneyCategory = await Dynamo.write(requestData, JourneyCategoryTableName).catch(error => {
            return Responses._500({ message: error.message });
        });

        return Responses._200({ newJourneyCategory });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const addUserToJourney = async (event) => {
    let addedUsersInJourney = [];

    // Cognito generates a temporary password if not specified in params
    let requestData = JSON.parse(event.body);

    const authorizer_context = event.requestContext.authorizer.lambda;
    const tenantID = authorizer_context.tenant;
    const currentUserID = authorizer_context.username;
    const userPoolID = authorizer_context.poolID;
    let paymentOption = null;
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
                currencyTableEntryID = responseInternalCurrencyTableScan.Items[0].ID;
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
    }

    const calculateDaysBetween = (date1, date2) => {
        // Normalize the dates to ignore the time part
        const start = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
        const end = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());

        // Calculate the difference in time
        const differenceInTime = end - start; // difference in milliseconds

        // Convert the difference from milliseconds to days
        const differenceInDays = differenceInTime / (1000 * 60 * 60 * 24);

        return Math.round(differenceInDays);
    }

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('NewUsers')
            && requestData.NewUsers.length > 0
            && requestData.hasOwnProperty('JourneyID'));
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({message: 'Missing required parameters!'});
    }

    let appRoleToAdd = requestData.NewUsers[0].JourneyRole;

    switch (requestData.NewUsers[0].JourneyRole) {

        case 'Co-Author': {
            appRoleToAdd = 'Facilitator';
            break
        }
        case 'CoAuthor': {
            appRoleToAdd = 'Facilitator';
            break;
        }
        case 'Coauthor': {
            appRoleToAdd = 'Facilitator';
            break;
        }
        case 'coauthor': {
            appRoleToAdd = 'Facilitator';
            break;
        }
        case 'Manager': {
            appRoleToAdd = 'Facilitator';
            break;
        }
        case 'manager': {
            appRoleToAdd = 'Facilitator';
            break;
        }
        case 'Assistant': {
            appRoleToAdd = 'Facilitator';
            break;
        }
        case 'assistant': {
            appRoleToAdd = 'Facilitator';
            break;
        }
        default: {
            appRoleToAdd = 'Participant';
            break;
        }

    }

    if (appRoleToAdd === 'Participant') {

        let formattedUsers = [];

        try {
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
                        priceToPay = 0;
                        break;
                    }
                    // tenant pays for everything
                    case 'T': {
                        availableAmount = await getAmountForTenant();
                        break;
                    }
                    case 'TF': {
                        availableAmount = await getAmountForUser();
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
        }
        catch (err) {

        }

        for (const newUser of requestData.NewUsers) {

            let userExists = false;
            let formattedUser = {
                exists: false,
                sub: '',
                given_name: '',
                family_name: '',
                email: '',
                address: '',
                'custom:position': '',
                'custom:expiration_date': '',
                JourneyRole: '',
                AppRole: '',
                Note: ''
            };

            let userAppRole = null;
            let userJourneyRole = null;


            if (newUser.hasOwnProperty('JourneyRole')) {

                switch (newUser.JourneyRole) {

                    case 'Co-Author': {
                        userJourneyRole = 'Co-Author';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    case 'CoAuthor': {
                        userJourneyRole = 'Co-Author';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    case 'Coauthor': {
                        userJourneyRole = 'Co-Author';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    case 'coauthor': {
                        userJourneyRole = 'Co-Author';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    case 'Manager': {
                        userJourneyRole = 'Manager';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    case 'manager': {
                        userJourneyRole = 'Manager';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    case 'Assistant': {
                        userJourneyRole = 'Assistant';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    case 'assistant': {
                        userJourneyRole = 'Assistant';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    default: {
                        userJourneyRole = 'Participant';
                        userAppRole = 'Participant';
                        break;
                    }

                }
            }
            else {
                userJourneyRole = 'Participant';
                userAppRole = 'Participant';
            }

            // check if user email already exists
            try {

                let user = await CognitoIdentityServiceProvider.adminGetUser({
                    UserPoolId: userPoolID,
                    Username: newUser.CognitoAttributes.email
                }).promise();

                // user already exists
                userExists = true;
                formattedUser.exists = true;
                user.UserAttributes.forEach((attribute) => {
                    if (attribute.Name === 'sub') {
                        formattedUser.sub = attribute.Value;
                    }
                    if (attribute.Name === 'given_name') {
                        formattedUser.given_name = attribute.Value;
                    }
                    if (attribute.Name === 'family_name') {
                        formattedUser.family_name = attribute.Value;
                    }
                    if (attribute.Name === 'email') {
                        formattedUser.email = attribute.Value;
                    }
                    if (attribute.Name === 'address') {
                        formattedUser.address = attribute.Value;
                    }
                    if (attribute.Name === 'custom:position') {
                        formattedUser['custom:position'] = attribute.Value;
                    }
                    if (attribute.Name === 'custom:expiration_date') {
                        formattedUser['custom:expiration_date'] = attribute.Value;
                    }
                    formattedUser.JourneyRole = userJourneyRole;
                    formattedUser.AppRole = userAppRole;
                    formattedUser.Note = newUser.Note;
                });
                formattedUsers.push(formattedUser);

                if (requestData.IsAlignExpirationDateToYearLongActive) {
                    if (formattedUser['custom:expiration_date'] !== '') {
                        // calculate price for participants
                        const monthlyPrice = userRoleCost.Participant ;
                        const currentDate = new Date();
                        const startDate = new Date(formattedUser['custom:expiration_date']);
                        const endDate = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate());
                        const dailyPrice = calculateDailyPrice(monthlyPrice);
                        const daysBetween = calculateDaysBetween(startDate, endDate);
                        let totalPrice = dailyPrice * daysBetween;
                        totalPrice = totalPrice.toFixed(2)
                        priceToPay += parseFloat(totalPrice);
                    }
                }


            } catch (err) {

                // user does not already exist
                if (err.code === 'UserNotFoundException') {
                    userExists = false;
                    formattedUser = {
                        exists: false,
                        sub: null,
                        given_name: newUser.CognitoAttributes.given_name,
                        family_name: newUser.CognitoAttributes.family_name,
                        email: newUser.CognitoAttributes.email,
                        address: newUser.CognitoAttributes.address,
                        'custom:position': newUser.CognitoAttributes['custom:position'],
                        'custom:expiration_date': null,
                        JourneyRole: userJourneyRole,
                        AppRole: userAppRole,
                        Note: newUser.Note
                    };
                    formattedUsers.push(formattedUser);

                    // calculate price for participants
                    const monthlyPrice = userRoleCost.Participant ;
                    const startDate = new Date();
                    const endDate = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
                    const dailyPrice = calculateDailyPrice(monthlyPrice);
                    const daysBetween = calculateDaysBetween(startDate, endDate);
                    let totalPrice = dailyPrice * daysBetween;
                    totalPrice = totalPrice.toFixed(2)
                    priceToPay += parseFloat(totalPrice);
                }

                else {
                    return Responses._500({message: err.message});
                }
            }

        }

        if (paymentOption !== 'FR') {
            let difference = availableAmount - priceToPay;
            difference = difference.toFixed(2);
            remainingAmount = parseFloat(difference);
        }

        if (remainingAmount < 0) {
            return Responses._500({message: 'Insufficient Commovis Credits!'});
        }
        else {

            try {

                // update CC amount
                let paramsUpdateInternalCurrencyEntry = {
                    TableName: InternalCurrencyTableName,
                    Key: {
                        ID: currencyTableEntryID,
                    },
                    UpdateExpression: 'SET #Amount = :Amount',
                    ExpressionAttributeNames: {
                        '#Amount': 'Amount',
                    },
                    ExpressionAttributeValues: {
                        ':Amount': remainingAmount,
                    },
                    ReturnValues: 'NONE',
                };

                if (paymentOption !== 'FR') {
                    await dynamoDB.update(paramsUpdateInternalCurrencyEntry).promise();
                }

                // get all tenant journeys
                let tenantJourneysList = await getTenantJourneys(tenantID);

                // start the add process

                // link the user with the journey
                let participantProgress = [];

                let responseGetJourney = tenantJourneysList.find((tenantJourney) => tenantJourney.ID === requestData.JourneyID);

                if (responseGetJourney !== undefined) {

                    const journeyExistingAssignments = await getJourneyAssignments(requestData.JourneyID);

                    for (let assignment of journeyExistingAssignments) {
                        assignment.Unlock = Dynamo.typeConvertorDynamoDBToJavascript(assignment.Unlock);
                        assignment.Quizzes = Dynamo.typeConvertorDynamoDBToJavascript(assignment.Quizzes);
                    }

                    let journeyStructure = responseGetJourney.Structure;

                    journeyStructure = Dynamo.typeConvertorDynamoDBToJavascript(journeyStructure);

                    // set journey progress for participant
                    participantProgress = buildParticipantProgress(journeyStructure, journeyExistingAssignments);

                }

                for (const newUser of formattedUsers) {

                    try {

                        if (!newUser.exists && newUser.AppRole !== 'Participant') {
                            return Responses._500({message: 'Failed because you tried to create an account for a user that is not a participant'});
                        }

                        // user does not already exist
                        if (!newUser.exists) {

                            const currentDate = new Date();
                            const endDate = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate());
                            newUser['custom:expiration_date'] = endDate.toDateString();

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
                                        Value: newUser.address,
                                    },
                                    {
                                        Name: "custom:position",
                                        Value: newUser['custom:position'],
                                    },
                                    {
                                        Name: "custom:expiration_date",
                                        Value: newUser['custom:expiration_date'],
                                    },
                                ],
                            };

                            // create user
                            const cognitoResponseAdminCreateUser = await CognitoIdentityServiceProvider.adminCreateUser(paramsNewUser).promise();
                            if (cognitoResponseAdminCreateUser.hasOwnProperty('User')) {

                                cognitoResponseAdminCreateUser.User.Attributes.forEach((attribute) => {
                                    if (attribute.Name === 'sub') {
                                        newUser.sub = attribute.Value;
                                    }
                                    if (attribute.Name === 'given_name') {
                                        newUser.given_name = attribute.Value;
                                    }
                                    if (attribute.Name === 'family_name') {
                                        newUser.family_name = attribute.Value;
                                    }
                                    if (attribute.Name === 'email') {
                                        newUser.email = attribute.Value;
                                    }
                                    if (attribute.Name === 'address') {
                                        newUser.address = attribute.Value;
                                    }
                                    if (attribute.Name === 'custom:position') {
                                        newUser['custom:position'] = attribute.Value;
                                    }
                                    if (attribute.Name === 'custom:expiration_date') {
                                        newUser['custom:expiration_date'] = attribute.Value;
                                    }
                                });

                            }


                            // add user to Participant Group
                            let paramsAddUserToGroup = {
                                GroupName: newUser.AppRole /* required */,
                                UserPoolId: userPoolID /* required */,
                                Username: cognitoResponseAdminCreateUser.User.Username /* required */,
                            }
                            await CognitoIdentityServiceProvider.adminAddUserToGroup(paramsAddUserToGroup).promise();


                            // make an entry for the new user in treasure chest table
                            let paramsTreasureChest = {
                                ID: uuid.v4(),
                                UserID: newUser.sub,
                                Assets: Dynamo.typeConvertorJavascriptToDynamoDB([]),
                                TenantID: tenantID,
                            }

                            await Dynamo.write(paramsTreasureChest, TreasureChestTableName).catch(error => {
                                return Responses._500({ message: error.message });
                            });

                            // make an entry for the new user in user preferences table
                            let paramsUserPreferences = {
                                ID: uuid.v4(),
                                UserID: newUser.sub,
                                Language: 'en',
                                TreasureChestFilters: {
                                    Types: [],
                                    Sources: [],
                                    Tags: []
                                },
                                Tags: [],
                                JourneysNotes: [],
                                TenantID: tenantID,
                                LastJourneyID: '',
                                ExtraAttributes: {}
                            }

                            paramsUserPreferences.TreasureChestFilters = Dynamo.typeConvertorJavascriptToDynamoDB(paramsUserPreferences.TreasureChestFilters);
                            paramsUserPreferences.Tags = Dynamo.typeConvertorJavascriptToDynamoDB(paramsUserPreferences.Tags);
                            paramsUserPreferences.JourneysNotes = Dynamo.typeConvertorJavascriptToDynamoDB(paramsUserPreferences.JourneysNotes);
                            paramsUserPreferences.ExtraAttributes = Dynamo.typeConvertorJavascriptToDynamoDB(paramsUserPreferences.ExtraAttributes);

                            await Dynamo.write(paramsUserPreferences, UserPreferencesTableName).catch(error => {
                                return Responses._500({ message: error.message });
                            });

                        }
                        // update expiration date for existing participant
                        else {
                            if (requestData.IsAlignExpirationDateToYearLongActive) {
                                if (newUser['custom:expiration_date'] !== '') {
                                    const currentDate = new Date();
                                    const endDate = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate());
                                    newUser['custom:expiration_date'] = endDate.toDateString();
                                    let paramsUpdateUser = {
                                        UserAttributes: [
                                            {
                                                Name: "custom:expiration_date",
                                                Value: newUser['custom:expiration_date'],
                                            },
                                        ],
                                        UserPoolId: userPoolID,
                                        Username: newUser.sub,
                                    };
                                    await CognitoIdentityServiceProvider.adminUpdateUserAttributes(paramsUpdateUser).promise();
                                }
                            }
                        }

                        let paramsJourneyParticipantRelation = {
                            ID: uuid.v4(),
                            JourneyID: requestData.JourneyID,
                            AuthorID: currentUserID,
                            ParticipantID: newUser.sub,
                            JourneyRole: newUser.JourneyRole,
                            Note: newUser.Note,
                            Consent: false,
                            ParticipantProgress: Dynamo.typeConvertorJavascriptToDynamoDB([]),
                            TenantID: tenantID,
                        }

                        // if (newUser.JourneyRole === 'Participant') {
                            paramsJourneyParticipantRelation.ParticipantProgress = Dynamo.typeConvertorJavascriptToDynamoDB(participantProgress);
                        // }


                        let newLinkEntry = await Dynamo.write(paramsJourneyParticipantRelation, JourneyParticipantRelationTableName).catch(error => {
                            return Responses._500({message: error.message});
                        });

                        let linkedUserToJourneyObject = {
                            sub: newUser.sub,
                            given_name: newUser.given_name,
                            family_name: newUser.family_name,
                            email: newUser.email,
                            address: newUser.address,
                            'custom:position': newUser['custom:position'],
                            JourneyParticipantLinkID: newLinkEntry.ID,
                            Note: newLinkEntry.Note,
                            JourneyRole: newLinkEntry.JourneyRole,
                        }
                        addedUsersInJourney.push(linkedUserToJourneyObject);


                    } catch (error) {
                        return Responses._500({message: error.message});
                    }

                }

                return Responses._200(addedUsersInJourney);

            }
            catch (err) {
                return Responses._500({err: err});
            }

        }

    }

    if (appRoleToAdd === 'Facilitator') {

        let formattedUsers = [];

        for (const newUser of requestData.NewUsers) {

            let userExists = false;
            let formattedUser = {
                exists: false,
                sub: '',
                given_name: '',
                family_name: '',
                email: '',
                address: '',
                'custom:position': '',
                'custom:expiration_date': '',
                JourneyRole: '',
                AppRole: '',
                Note: ''
            };

            let userAppRole = null;
            let userJourneyRole = null;


            if (newUser.hasOwnProperty('JourneyRole')) {

                switch (newUser.JourneyRole) {

                    case 'Co-Author': {
                        userJourneyRole = 'Co-Author';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    case 'CoAuthor': {
                        userJourneyRole = 'Co-Author';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    case 'Coauthor': {
                        userJourneyRole = 'Co-Author';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    case 'coauthor': {
                        userJourneyRole = 'Co-Author';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    case 'Manager': {
                        userJourneyRole = 'Manager';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    case 'manager': {
                        userJourneyRole = 'Manager';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    case 'Assistant': {
                        userJourneyRole = 'Assistant';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    case 'assistant': {
                        userJourneyRole = 'Assistant';
                        userAppRole = 'Facilitator';
                        break;
                    }
                    default: {
                        break;
                    }

                }
            }

            // check if user email already exists
            try {

                let user = await CognitoIdentityServiceProvider.adminGetUser({
                    UserPoolId: userPoolID,
                    Username: newUser.CognitoAttributes.email
                }).promise();

                // user already exists
                userExists = true;
                formattedUser.exists = true;
                user.UserAttributes.forEach((attribute) => {
                    if (attribute.Name === 'sub') {
                        formattedUser.sub = attribute.Value;
                    }
                    if (attribute.Name === 'given_name') {
                        formattedUser.given_name = attribute.Value;
                    }
                    if (attribute.Name === 'family_name') {
                        formattedUser.family_name = attribute.Value;
                    }
                    if (attribute.Name === 'email') {
                        formattedUser.email = attribute.Value;
                    }
                    if (attribute.Name === 'address') {
                        formattedUser.address = attribute.Value;
                    }
                    if (attribute.Name === 'custom:position') {
                        formattedUser['custom:position'] = attribute.Value;
                    }
                    if (attribute.Name === 'custom:expiration_date') {
                        formattedUser['custom:expiration_date'] = attribute.Value;
                    }
                    formattedUser.JourneyRole = userJourneyRole;
                    formattedUser.AppRole = userAppRole;
                    formattedUser.Note = newUser.Note;
                });
                formattedUsers.push(formattedUser);

            } catch (err) {

                // user does not already exist
                if (err.code === 'UserNotFoundException') {
                    userExists = false;
                    formattedUser = {
                        exists: false,
                        sub: null,
                        given_name: newUser.CognitoAttributes.given_name,
                        family_name: newUser.CognitoAttributes.family_name,
                        email: newUser.CognitoAttributes.email,
                        address: newUser.CognitoAttributes.address,
                        'custom:position': newUser.CognitoAttributes['custom:position'],
                        'custom:expiration_date': null,
                        JourneyRole: userJourneyRole,
                        AppRole: userAppRole,
                        Note: newUser.Note
                    };
                    formattedUsers.push(formattedUser);

                    // // calculate price for participants
                    // const monthlyPrice = userRoleCost.Participant ;
                    // const startDate = new Date();
                    // const endDate = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
                    // const dailyPrice = calculateDailyPrice(monthlyPrice);
                    // const daysBetween = calculateDaysBetween(startDate, endDate);
                    // let totalPrice = dailyPrice * daysBetween;
                    // totalPrice = totalPrice.toFixed(2)
                    // priceToPay += parseFloat(totalPrice);
                }

                else {
                    return Responses._500({message: err.message});
                }
            }

        }

        try {

            // start the add process
            for (const newUser of formattedUsers) {

                try {

                    let paramsJourneyParticipantRelation = {
                        ID: uuid.v4(),
                        JourneyID: requestData.JourneyID,
                        AuthorID: currentUserID,
                        ParticipantID: newUser.sub,
                        JourneyRole: newUser.JourneyRole,
                        Note: newUser.Note,
                        Consent: false,
                        ParticipantProgress: Dynamo.typeConvertorJavascriptToDynamoDB([]),
                        TenantID: tenantID,
                    }

                    let newLinkEntry = await Dynamo.write(paramsJourneyParticipantRelation, JourneyParticipantRelationTableName).catch(error => {
                        return Responses._500({message: error.message});
                    });

                    let linkedUserToJourneyObject = {
                        sub: newUser.sub,
                        given_name: newUser.given_name,
                        family_name: newUser.family_name,
                        email: newUser.email,
                        address: newUser.address,
                        'custom:position': newUser['custom:position'],
                        JourneyParticipantLinkID: newLinkEntry.ID,
                        Note: newLinkEntry.Note,
                        JourneyRole: newLinkEntry.JourneyRole,
                    }
                    addedUsersInJourney.push(linkedUserToJourneyObject);


                } catch (error) {
                    return Responses._500({message: error.message});
                }

            }

            return Responses._200(addedUsersInJourney);

        }
        catch (err) {
            return Responses._500({message: 'Commovis Credits amount could not be updated'});
        }

    }
};
const listJourneysImages = async (event) => {

    const authorizer_context = event.requestContext.authorizer.lambda;

    const tenantID = authorizer_context.tenant;

    const prefix = `uploads/${tenantID}/journey/`;

    try {

        const data = await s3.listObjectsV2({ Bucket: S3_BUCKET, Prefix: prefix }).promise();

        const assetsKeys = data.Contents.filter(item => {
            const key = item.Key.toLowerCase();
            return key.endsWith('.jpg') || key.endsWith('.jpeg') || key.endsWith('.png');
        }).map((item) => {
            return {
                Key: item.Key
            }
        });

        return Responses._200({assetsKeys: assetsKeys});

    } catch (error) {
        return Responses._500({message: error.message});
    }
};
const listJourneyTemplates = async (event) => {
    const authorizer_context = event.requestContext.authorizer.lambda;
    const tenantID = authorizer_context.tenant;

    try {

        let journeyTemplates = await getJourneyReusableTemplates(event, tenantID, null, null);

        for (let journeyTemplate of journeyTemplates) {
            journeyTemplate.Overview = Dynamo.typeConvertorDynamoDBToJavascript(journeyTemplate.Overview);
            journeyTemplate.Structure = Dynamo.typeConvertorDynamoDBToJavascript(journeyTemplate.Structure);

            let journeyAssignments = await getJourneyAssignments(journeyTemplate.ID);

            for (let assignment of journeyAssignments) {
                assignment.Unlock = await Dynamo.typeConvertorDynamoDBToJavascript(assignment.Unlock);
                assignment.Quizzes = await Dynamo.typeConvertorDynamoDBToJavascript(assignment.Quizzes);
            }

            for (let structureItem of journeyTemplate.Structure) {

                if (structureItem.Type === 'Event' && structureItem.hasOwnProperty('Assignment') && structureItem.Assignment.hasOwnProperty('ID') && structureItem.Assignment.ID !== null) {

                    let foundAssignment = journeyAssignments.find((journeyAssignment) => journeyAssignment.ID === structureItem.Assignment.ID);

                    if (foundAssignment !== undefined) {
                        foundAssignment.isParticipantScorePopupDisplayed = false;
                        structureItem.Assignment = foundAssignment;
                    }
                }
            }

        }

        return Responses._200({ journeyTemplates });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const listJourneyReusableTemplates = async (event) => {
    const authorizer_context = event.requestContext.authorizer.lambda;
    const tenantID = authorizer_context.tenant;

    try {

        let journeyReusableTemplates = await getJourneyReusableTemplates(event, tenantID, null, true);

        for (let journeyReusableTemplate of journeyReusableTemplates) {
            journeyReusableTemplate.Overview = Dynamo.typeConvertorDynamoDBToJavascript(journeyReusableTemplate.Overview);
            journeyReusableTemplate.Structure = Dynamo.typeConvertorDynamoDBToJavascript(journeyReusableTemplate.Structure);

            let journeyAssignments = await getJourneyAssignments(journeyReusableTemplate.ID);

            for (let assignment of journeyAssignments) {
                assignment.Unlock = await Dynamo.typeConvertorDynamoDBToJavascript(assignment.Unlock);
                assignment.Quizzes = await Dynamo.typeConvertorDynamoDBToJavascript(assignment.Quizzes);
            }

            for (let structureItem of journeyReusableTemplate.Structure) {

                if (structureItem.Type === 'Event' && structureItem.hasOwnProperty('Assignment') && structureItem.Assignment.hasOwnProperty('ID') && structureItem.Assignment.ID !== null) {

                    let foundAssignment = journeyAssignments.find((journeyAssignment) => journeyAssignment.ID === structureItem.Assignment.ID);

                    if (foundAssignment !== undefined) {
                        foundAssignment.isParticipantScorePopupDisplayed = false;
                        structureItem.Assignment = foundAssignment;
                    }
                }
            }

        }

        return Responses._200({ journeyReusableTemplates });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const getJourneysLinkedToParticipant = async (event) => {
    const authorizer_context = event.requestContext.authorizer.lambda;
    const tenantID = authorizer_context.tenant;

    let requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('ParticipantID'));
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        // get all tenant journeys
        let tenantJourneysList = await getTenantJourneys(tenantID);

        let foundLinks = await getJourneyParticipantsLinks(event, tenantID, null, requestData.ParticipantID, null, null);

        let linkedJourneys = [];

        for (const linkRow of foundLinks) {

            // using the found JourneyID, get the name from Journey table
            let linkedJourneyID = linkRow.JourneyID;

            // let journey = await Dynamo.get(linkedJourneyID, JourneyTableName).catch(error => {
            //     return Responses._500({ message: error.message });
            // });

            let journey = tenantJourneysList.find((tenantJourney) => tenantJourney.ID === linkedJourneyID);

            if (journey !== undefined) {
                journey.JourneyParticipantLinkID = linkRow.ID;
                journey.Structure = Dynamo.typeConvertorDynamoDBToJavascript(journey.Structure);
                journey.ParticipantProgress = Dynamo.typeConvertorDynamoDBToJavascript(linkRow.ParticipantProgress);
                journey.Consent = linkRow.Consent;
                linkedJourneys.push(journey);
            }

        }

        return Responses._200({ linkedJourneys });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const getParticipantsLinkedToAuthor = async (event) => {
    let requestData = JSON.parse(event.body);

    // const hasRequiredParams = (requestData) => {
    //     return (requestData.hasOwnProperty('UserPoolId')
    //         && requestData.hasOwnProperty('AuthorID'));
    // };

    // if (!hasRequiredParams(requestData)) {
    //     return Responses._400({ message: 'Missing required parameters!' });
    // }

    const authorizer_context = event.requestContext.authorizer.lambda;
    const tenantID = authorizer_context.tenant;

    requestData.UserPoolId = authorizer_context.poolID;
    requestData.AuthorID = authorizer_context.username;

    console.log("getParticipantsLinkedToAuthor, requestData", requestData );

    try {

        // get all tenant journeys
        let tenantJourneysList = await getTenantJourneys(tenantID);

        // Get all entries in JourneyParticipantRelationTable where AuthorID matches
        const foundLinks = await getJourneyParticipantsLinks(event, tenantID, null, null, requestData.AuthorID, null);

        let linkedUsers = [];

        // Extract all ParticipantIDs
        const participantIDs = foundLinks.map(link => link.ParticipantID);

        // Prepare an array of functions to fetch user data
        const userFetchPromises = participantIDs.map(async (participantID) => {
            try {
                const paramsAdminGetUser = {
                    UserPoolId: requestData.UserPoolId,
                    Username: participantID,
                };

                // Fetch user details from Cognito
                const cognitoResponseAdminGetUser = await CognitoIdentityServiceProvider.adminGetUser(paramsAdminGetUser).promise();

                // Specify an array of allowed "Name" values for Attributes
                const attributesToGet = ["sub", "given_name", "family_name", "email", "custom:company", "custom:position", "phone_number"];

                // Create an object by reducing the values from the attributes array
                let userObject = cognitoResponseAdminGetUser.UserAttributes.reduce((acc, item) => {
                    if (attributesToGet.includes(item.Name)) {
                        acc[item.Name] = item.Value;
                    }
                    return acc;
                }, {});

                // Get linked journeys for the user
                const userLinks = foundLinks.filter(link => link.ParticipantID === participantID);

                userObject.Journeys = [];

                // Fetch journey details
                for (const link of userLinks) {
                    const linkedJourneyID = link.JourneyID;
                    // const journey = await Dynamo.get(linkedJourneyID, JourneyTableName).catch(error => {
                    //     console.log('500', error.message);
                    //     return null;
                    // });

                    const journey = tenantJourneysList.find((tenantJourney) => tenantJourney.ID === linkedJourneyID);

                    if (journey !== undefined) {
                        userObject.Journeys.push({
                            ID: journey.ID,
                            Name: journey.Name,
                        });
                    }
                }

                return userObject;

            } catch (err) {
                console.error(`Error fetching user ${participantID}:`, err);
                // Handle specific errors if needed
                return null;
            }
        });

        // Fetch all users in parallel
        linkedUsers = await Promise.all(userFetchPromises);

        // Remove any null entries (in case of errors)
        linkedUsers = linkedUsers.filter(user => user !== null);

        // Remove duplicates
        linkedUsers = linkedUsers.reduce((acc, current) => {
            if (!acc.some(user => user.sub === current.sub)) {
                acc.push(current);
            }
            return acc;
        }, []);

        console.log("linked User 200 answer", linkedUsers);
        return Responses._200({ linkedUsers });

    } catch (error) {
        console.log("error ", error.message);
        console.log("error details", error);
        return Responses._500({ message: error.message });
    }

};
const getUsersLinkedToJourney = async (event) => {

    let requestData = JSON.parse(event.body);

    const authorizer_context = event.requestContext.authorizer.lambda;

    const tenantID = authorizer_context.tenant;

    requestData.UserPoolId = authorizer_context.poolID;

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('JourneyID')
            && requestData.hasOwnProperty('IsFacilitatorView')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        let responseGetJourney = await Dynamo.get(requestData.JourneyID, JourneyTableName).catch(error => {
            return Responses._500({message: error.message});
        });
        let journeyStructure = responseGetJourney.Structure;
        journeyStructure = Dynamo.typeConvertorDynamoDBToJavascript(journeyStructure);

        let foundLinks = await getJourneyParticipantsLinks(event, tenantID, requestData.JourneyID, null, null, null);

        let linkedUsers = [];

        // get the emails of found linked participants from Cognito
        for (const foundLink of foundLinks) {

            let participantID = foundLink.ParticipantID;

            let paramsAdminGetUser = {
                UserPoolId: requestData.UserPoolId,
                Username: participantID,
            };

            const cognitoResponseAdminGetUser = await CognitoIdentityServiceProvider.adminGetUser(paramsAdminGetUser).promise();

            let attributesToGet = requestData.IsFacilitatorView ? ["sub", "given_name", "family_name", "email", "address", "custom:position", "picture", "custom:expiration_date"] : ["given_name", "family_name", "picture"];

            // Create an object by reducing the values from the attributes array
            let userObject = cognitoResponseAdminGetUser.UserAttributes.reduce((acc, item) => {
                // Check if the "Name" is in the allowedNames array before adding to the object
                if (attributesToGet.includes(item.Name)) {
                    acc[item.Name] = item.Value;
                }
                return acc;
            }, {});

            if (requestData.IsFacilitatorView) {
                userObject.JourneyParticipantLinkID = foundLink.ID;
                userObject.Note = foundLink.Note;
                userObject.JourneyRole = foundLink.JourneyRole;
                userObject.UserStatus = cognitoResponseAdminGetUser.UserStatus;
            }
            else {
                userObject.JourneyRole = foundLink.JourneyRole;
                let participantProgress = Dynamo.typeConvertorDynamoDBToJavascript(foundLink.ParticipantProgress);
                if (participantProgress !== undefined && participantProgress !== null) {
                    userObject.JourneyCompletionPercentage = calculateJourneyCompletionPercentage(participantProgress, journeyStructure);
                }
            }

            linkedUsers.push(userObject);

        }

        return Responses._200({ linkedUsers });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const removeParticipantFromJourney = async (event) => {
    let requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('JourneyParticipantLinkID'));
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        const deleteParams = {
            TableName: JourneyParticipantRelationTableName,
            Key: {
                ID: requestData.JourneyParticipantLinkID,
            },
        };

        await dynamoDB.delete(deleteParams).promise();

        return Responses._200({message: 'User successfully removed from journey'});

        // // remove all the links with this user from other participants
        // let paramsScanJourneyParticipantRelation = {
        //     TableName: JourneyParticipantRelationTableName,
        //     FilterExpression: `#JourneyID = :JourneyID and #ParticipantID = :ParticipantID`,
        //     ExpressionAttributeNames: {
        //         '#JourneyID': 'JourneyID', // The column name to filter by
        //         '#ParticipantID': 'ParticipantID', // The column name to filter by
        //     },
        //     ExpressionAttributeValues: {
        //         ':JourneyID': requestData.JourneyID, // The value to filter for
        //         ':ParticipantID': requestData.DeletedUserID, // The value to filter for
        //     },
        //     ProjectionExpression:
        //         "ID",
        // }
        //
        // const scanJourneyParticipantRelationResult = await dynamoDB.scan(paramsScanJourneyParticipantRelation).promise();
        //
        // // normally should always be only one entry, but delete all found links
        // if (scanJourneyParticipantRelationResult.hasOwnProperty('Count') && scanJourneyParticipantRelationResult.hasOwnProperty('Items') && scanJourneyParticipantRelationResult.Count > 0) {
        //
        //     // the links found for this deleted user id in journey
        //     const foundItems = scanJourneyParticipantRelationResult.Items;
        //
        //     const deleteAllLinks = foundItems.map(item => {
        //         const deleteParams = {
        //             TableName: JourneyParticipantRelationTableName,
        //             Key: {
        //                 ID: item.ID,
        //             },
        //         };
        //
        //         return dynamoDB.delete(deleteParams).promise();
        //     });
        //
        //     // Wait for all delete operations to complete
        //     await Promise.all(deleteAllLinks);
        //
        //     return Responses._200({message: 'User successfully removed from journey'});
        //
        // }
        // else {
        //     return Responses._200({message: 'No links found between user and journey'});
        // }


    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const updateParticipantByAuthor = async (event) => {
    let requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('JourneyParticipantLinkID')
            && requestData.hasOwnProperty('JourneyID')
            && requestData.hasOwnProperty('JourneyRole')
            && requestData.hasOwnProperty('Note')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        let params = {
            TableName: JourneyParticipantRelationTableName,
            Key: {
                ID: requestData.JourneyParticipantLinkID,
            },
            UpdateExpression: 'SET #JourneyRole = :JourneyRole, #Note = :Note',
            ExpressionAttributeNames: {
                '#JourneyRole': 'JourneyRole',
                '#Note': 'Note',
            },
            ExpressionAttributeValues: {
                ':JourneyRole': requestData.JourneyRole,
                ':Note': requestData.Note,
            },
            ReturnValues: 'NONE',
        };

        await dynamoDB.update(params).promise();

        return Responses._200({message: 'User successfully updated'});

    } catch (error) {
        return Responses._500({ message: error.message });
    }

};
const copyFileToS3Folder = async (event) => {
    const authorizer_context = event.requestContext.authorizer.lambda;

    const tenantID = `${authorizer_context.tenant}`;

    const requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('source_key')
            && requestData.hasOwnProperty('folder_name')
            && requestData.hasOwnProperty('file_name')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({message: 'Missing required parameters!'});
    }

    const destinationKey = `uploads/${tenantID}/${requestData.folder_name}/${requestData.file_name}`;

    try {
        // Copy object from source folder to destination folder
        await s3.copyObject({
            Bucket: S3_BUCKET,
            CopySource: `${S3_BUCKET}/${requestData.source_key}`,
            Key: destinationKey
        }).promise();

        return Responses._200({message: "Asset copied successfully."});

    } catch (error) {
        return Responses._500({message: error.message});
    }
}
const getDownloadSignedUrl = async (event) => {
    const authorizer_context = event.requestContext.authorizer.lambda;

    const requestData = JSON.parse(event.body);

    // console.log(authorizer_context.clientID);
    // console.log(authorizer_context.poolID);
    // console.log(authorizer_context.tenant);
    // console.log(authorizer_context.username);
    // const data = JSON.parse(event.body);
    // if (data.hasOwnProperty('image_name')
    //     && data.hasOwnProperty('folder_name')
    //     && typeof data.image_name !== "string") {
    //     console.error("Validation Failed");
    //     callback(null, {
    //         statusCode: 400,
    //         headers: { "Content-Type": "text/plain" },
    //         body: "Couldn't request a URL",
    //     });
    //     return;
    // }

    const hasRequiredParams = (requestData) => {
        return (
            (requestData.hasOwnProperty('file_name') && requestData.hasOwnProperty('folder_name')) || (requestData.hasOwnProperty('full_key'))
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({message: 'Missing required parameters!'});
    }

    const tenant_id = `${authorizer_context.tenant}`;
    let key = '';

    if (!requestData.hasOwnProperty('full_key')) {
        key = `uploads/${tenant_id}/${requestData.folder_name}/${requestData.file_name}`;
    }
    else {
        key = `${requestData.full_key}`;
    }

    // Get signed URL from S3
    const s3Params = {
        Bucket: S3_BUCKET,
        Key: key,
        Expires: URL_EXPIRATION_SECONDS

        // This ACL makes the uploaded object publicly readable. You must also uncomment
        // the extra permission for the Lambda function in the SAM template.

        // ACL: 'public-read'
    };

    if (requestData.hasOwnProperty('file_label')) {
        s3Params.ResponseContentDisposition = `attachment; filename=${requestData.file_label}`;
    }

    try {
        const downloadURL = await s3.getSignedUrlPromise("getObject", s3Params);
        return Responses._200({downloadURL});
    }
    catch (err) {
        return Responses._500({message: err});
    }
}
const getTenantLogoSignedUrl = async (event) => {
    // const authorizer_context = event.requestContext.authorizer.lambda;
    const requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return requestData.hasOwnProperty('tenant_id') && requestData.hasOwnProperty('file_name');
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({message: 'Missing required parameters!'});
    }

    // const tenant_id = `${authorizer_context.tenant}`;

    let key = '';

    key = `uploads/${requestData.tenant_id}/tenant_assets/${requestData.file_name}`;

    // const tenant_id = `${authorizer_context.tenant}`;
    // const key = `logos/${tenant_id}/${requestData.logo_key}`;

    // Check cache
    // if (cache.has(key)) {
    //     return Responses._200({downloadURL: cache.get(key)});
    // }

    // Get signed URL from S3
    const s3Params = {
        Bucket: S3_BUCKET,
        Key: key,
        Expires: URL_EXPIRATION_SECONDS
    };

    try {
        const downloadURL = await s3.getSignedUrlPromise("getObject", s3Params);
        // Store in cache
        // cache.set(key, downloadURL);
        return Responses._200({downloadURL});
    } catch (err) {
        return Responses._500({message: err});
    }
}
const getUploadSignedUrl = async (event) => {
    const authorizer_context = event.requestContext.authorizer.lambda;

  // console.log(authorizer_context.clientID);
  // console.log(authorizer_context.poolID);
  // console.log(authorizer_context.tenant);
  // console.log(authorizer_context.username);

  const data = JSON.parse(event.body);

  if (
      data.hasOwnProperty('name') &&
      data.hasOwnProperty('type') &&
      data.hasOwnProperty('ext') &&
      data.hasOwnProperty('folder_name') &&
      typeof data.name !== "string" &&
      typeof data.type !== "string" &&
      typeof data.ext !== "string" &&
      typeof  data.folder_name !== "string"
  ) {
    console.error("Validation Failed");
    callback(null, {
      statusCode: 400,
      headers: { "Content-Type": "text/plain" },
      body: "Couldn't request a URL",
    });
    return;
  }

  const tenantID = `${authorizer_context.tenant}`;
  const imageName = `${data.name}.${data.ext}`;
  const folderName = `${data.folder_name}`;
  const key = `uploads/${tenantID}/${folderName}/${imageName}`;

  // Get signed URL from S3
  const s3Params = {
    Bucket: S3_BUCKET,
    Key: key,
    Expires: URL_EXPIRATION_SECONDS,
    ContentType: data.type,

    // This ACL makes the uploaded object publicly readable. You must also uncomment
    // the extra permission for the Lambda function in the SAM template.

    // ACL: 'public-read'
  };

  const uploadURL = await s3.getSignedUrlPromise("putObject", s3Params);

  return JSON.stringify({
    uploadURL: uploadURL
  });
}
const uploadImage = async (event) => {
    try {
        const authorizer_context = event.requestContext.authorizer.lambda;

        // console.log(authorizer_context.clientID);
        // console.log(authorizer_context.poolID);
        // console.log(authorizer_context.tenant);
        // console.log(authorizer_context.username);
        console.log("event.requestContext");
        console.log(event.requestContext);
        console.log("event");
        console.log(event);
        console.log("event.body");
        console.log(event.body);
        let spotText = false;
        const result = multipart.parse(event, spotText);
        console.log("result");
        console.log(result);
        console.log("result end");
        // const data = JSON.parse(event.body);
        // const validateinput = (fields) => {
        //   let check = true;
        //   // list of allowed field to update
        //   let allowedfields = ["name", "ext"];

        //   Object.entries(fields).forEach(([key, item]) => {
        //     if (allowedfields.indexOf(key) == -1) {
        //       check = false;
        //     }
        //   });
        //   return check;
        // };
        // console.log("DATA: ", data);
        // let isValid = validateinput(data);
        let data = { name: "test", ext: "png" };
        const Key = `assets/${authorizer_context.tenant}/training/${data.name}.${data.ext}`;
        let isValid = true;
        if (isValid) {
          // generate signedURL to check file
          // Get signed URL from S3
          const s3Params = {
            Bucket: S3_BUCKET,
            Key: Key,
            Body: "",
            // Expires: URL_EXPIRATION_SECONDS,

            // This ACL makes the uploaded object publicly readable. You must also uncomment
            // the extra permission for the Lambda function in the SAM template.

            // ACL: 'public-read'
          };

          console.log("Params: ", s3Params);

          const response = await new Promise((resolve, reject) => {
            s3.upload(s3Params, function (err, data) {
              console.log("inside getObject");
              if (err) {
                console.log("upload error");
                console.log(err, err.stack);
                reject({
                  statusCode: 401,
                  headers: {
                    "Access-Control-Allow-Origin": "*",
                  },
                  body: "Error in HTTP call with details",
                });
                // file does not exist, do something
              } else {
                console.log("upload successful");
                console.log(data);
                let returnbody = {
                  success: 1,
                  file: {
                    url: "https://www.tesla.com/tesla_theme/assets/img/_vehicle_redesign/roadster_and_semi/roadster/hero.jpg",
                  },
                };
                resolve({
                  headers: {
                    "Access-Control-Allow-Origin": "*",
                  },
                  statusCode: 200,
                  body: returnbody,
                });
                //file exist, do something
              }
            });
            console.log("insige prommis");
          });

          return response;
          console.log("after getObject");
        } else {
          return {
            statusCode: 400,
            body: "Wrong input Value",
          };
        }
      } catch (error) {
        console.error("error", error);
        return {
          statusCode: 417,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify(error),
        };
      }
}
const listReusableJourneysImages = async (event) => {
    const authorizer_context = event.requestContext.authorizer.lambda;

    const tenant_id = authorizer_context.tenant;

    const prefix = `uploads/${tenant_id}/reusable_assets/journeys_images`;

    try {

        const data = await s3.listObjectsV2({ Bucket: S3_BUCKET, Prefix: prefix }).promise();

        const assetsKeys = data.Contents.filter(item => {
            const key = item.Key.toLowerCase();
            return key.endsWith('.jpg') || key.endsWith('.jpeg') || key.endsWith('.png');
        }).map((item) => {
            return {
                Key: item.Key
            }
        });

        return Responses._200({assetsKeys: assetsKeys});

    } catch (error) {
        return Responses._500({message: error.message});
    }
}
const getTreasureChestForUser = async (event) => {
    try {

        const authorizer_context = event.requestContext.authorizer.lambda;

        const userID = authorizer_context.username;

        let treasureChestAssets = [];

        const paramsQueryTreasureChest = {
            TableName: TreasureChestTableName,
            IndexName: 'treasureChestGSI',
            KeyConditionExpression: "#UserID = :UserID",
            ExpressionAttributeNames: {
                '#UserID': 'UserID',
            },
            ExpressionAttributeValues: {
                ":UserID": userID
            },
            ScanIndexForward: false,
        };

        const linkedTreasureChestEntries = await dynamoDB.query(paramsQueryTreasureChest).promise();

        if (linkedTreasureChestEntries.Count === 0) {
            return Responses._200({ treasureChestAssets: treasureChestAssets });
        }

        if (linkedTreasureChestEntries.Count === 1) {

            let treasureChestEntry = linkedTreasureChestEntries.Items[0];

            treasureChestAssets = Dynamo.typeConvertorDynamoDBToJavascript(treasureChestEntry.Assets);

            return Responses._200({ treasureChestAssets: treasureChestAssets });

        }

        if (linkedTreasureChestEntries.Count > 1) {
            return Responses._500({ message: 'Found more that 1 entries in treasure chest table' });
        }


    } catch (error) {
        return Responses._500({ message: error.message });
    }

}
const addExistingImageToReusableJourneysImages = async (event) => {
    const authorizer_context = event.requestContext.authorizer.lambda;

    const tenant_id = `${authorizer_context.tenant}`;

    const folder_name = 'reusable_assets/journeys_images';

    const requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('source_key')
            && requestData.hasOwnProperty('file_name')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({message: 'Missing required parameters!'});
    }

    const destinationKey = `uploads/${tenant_id}/${folder_name}/${requestData.file_name}`;

    try {
        // Copy object from source folder to destination folder
        await s3.copyObject({
            Bucket: S3_BUCKET,
            CopySource: `${S3_BUCKET}/${requestData.source_key}`,
            Key: destinationKey
        }).promise();

        return Responses._200({message: "Image successfully added to reusable assets."});

    } catch (error) {
        return Responses._500({message: error.message});
    }
}
const submitAssignment = async (event) => {

    let requestData = JSON.parse(event.body);
    //
    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('SubmittedStructureItemID')
        && requestData.hasOwnProperty('Journey')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    const authorizer_context = event.requestContext.authorizer.lambda;
    const tenantID = authorizer_context.tenant;
    const currentUserID = authorizer_context.username;
    let journey = requestData.Journey;
    const indexStructureItem = journey.Structure.findIndex((structureItem) => structureItem.ID === requestData.SubmittedStructureItemID);

    if (indexStructureItem !== -1
    && journey.Structure[indexStructureItem].hasOwnProperty('Assignment')
    && journey.Structure[indexStructureItem].Assignment.hasOwnProperty('ID')
    && journey.Structure[indexStructureItem].Assignment.ID !== null) {

        let participantAssignment = {
            ID: journey.Structure[indexStructureItem].Assignment.ID,
            ParticipantScorePercentage: 0,
            Quizzes: [],
        };


        let numberOfAssignmentScoreElements = 0;
        let numberOfDoneAssignmentScoreElements = 0;

        try {

            let assignment = await Dynamo.get(journey.Structure[indexStructureItem].Assignment.ID, AssignmentTableName).catch(error => {
                return Responses._500({message: error.message});
            });

            assignment.Quizzes = Dynamo.typeConvertorDynamoDBToJavascript(assignment.Quizzes);
            assignment.Unlock = Dynamo.typeConvertorDynamoDBToJavascript(assignment.Unlock);

            assignment.Quizzes.forEach((quiz) => {

                let participantQuizObject = {
                    ID: quiz.ID,
                    Type: quiz.Type,
                };

                let foundParticipantQuizIndex = journey.Structure[indexStructureItem].Assignment.Quizzes.findIndex((participantQuiz) => participantQuiz.ID === quiz.ID);
                let foundParticipantQuiz = journey.Structure[indexStructureItem].Assignment.Quizzes.find((participantQuiz) => participantQuiz.ID === quiz.ID);

                switch (quiz.Type) {

                    case 'Checklist': {

                        participantQuizObject.Tasks = [];

                        quiz.Content.Tasks.forEach((item) => {

                            numberOfAssignmentScoreElements++;

                            if (foundParticipantQuiz !== undefined) {
                                let fountParticipantItem = foundParticipantQuiz.Content.Tasks.find((participantItem) => participantItem.ID === item.ID);

                                if (fountParticipantItem !== undefined) {

                                    participantQuizObject.Tasks.push({
                                        ID: fountParticipantItem.ID,
                                        IsDone: fountParticipantItem.IsDone,
                                    });

                                    if (fountParticipantItem.IsDone) {
                                        numberOfDoneAssignmentScoreElements++;
                                    }
                                }
                            }
                        });
                        break;
                    }

                    case 'Multiple Choice': {

                        participantQuizObject.Items = [];

                        quiz.Content.Items.forEach((item) => {

                            numberOfAssignmentScoreElements++;

                            let fountParticipantItem = null;
                            let fountParticipantItemIndex = null;

                            if (foundParticipantQuiz !== undefined) {

                                fountParticipantItemIndex = foundParticipantQuiz.Content.Items.findIndex((participantItem) => participantItem.ID === item.ID);
                                fountParticipantItem = foundParticipantQuiz.Content.Items.find((participantItem) => participantItem.ID === item.ID);

                                participantQuizObject.Items.push({
                                    ID: fountParticipantItem.ID,
                                    Options: [],
                                });
                            }

                            let isAnswerCorrect = true;

                            item.Options.forEach((option) => {

                                if (fountParticipantItem !== undefined) {

                                    let participantOptionIndex = fountParticipantItem.Options.findIndex((participantOption) => participantOption.ID === option.ID);
                                    let participantOption = fountParticipantItem.Options.find((participantOption) => participantOption.ID === option.ID);

                                    if (participantOption !== undefined) {

                                        journey.Structure[indexStructureItem].Assignment.Quizzes[foundParticipantQuizIndex].Content.Items[fountParticipantItemIndex].Options[participantOptionIndex].IsCorrect = option.IsCorrect;

                                        participantQuizObject.Items[participantQuizObject.Items.length - 1].Options.push({
                                            ID: participantOption.ID,
                                            ParticipantAnswer: participantOption.ParticipantAnswer,
                                        })

                                        if (option.IsCorrect !== participantOption.ParticipantAnswer) {
                                            isAnswerCorrect = false;
                                        }

                                    }
                                    else {
                                        isAnswerCorrect = false;
                                    }
                                }
                                else {
                                    isAnswerCorrect = false;
                                }
                            });

                            if (isAnswerCorrect) {
                                numberOfDoneAssignmentScoreElements++;
                            }

                        });
                        break;
                    }

                    case 'True/False': {

                        participantQuizObject.Items = [];

                        quiz.Content.Items.forEach((item) => {

                            numberOfAssignmentScoreElements++;

                            if (foundParticipantQuiz !== undefined) {

                                let fountParticipantItemIndex = foundParticipantQuiz.Content.Items.findIndex((participantItem) => participantItem.ID === item.ID);
                                let fountParticipantItem = foundParticipantQuiz.Content.Items.find((participantItem) => participantItem.ID === item.ID);

                                if (fountParticipantItem !== undefined) {

                                    journey.Structure[indexStructureItem].Assignment.Quizzes[foundParticipantQuizIndex].Content.Items[fountParticipantItemIndex].CorrectAnswer = item.CorrectAnswer;

                                    participantQuizObject.Items.push({
                                        ID: fountParticipantItem.ID,
                                        ParticipantAnswer: fountParticipantItem.ParticipantAnswer,
                                    })
                                    if (item.CorrectAnswer === fountParticipantItem.ParticipantAnswer) {
                                        numberOfDoneAssignmentScoreElements++;
                                    }
                                }

                            }
                        });
                        break;
                    }

                    case 'Item Match': {

                        participantQuizObject.LeftItems = [];

                        quiz.Content.LeftItems.forEach((item) => {

                            numberOfAssignmentScoreElements++;

                            if (foundParticipantQuiz !== undefined) {

                                let fountParticipantItemIndex = foundParticipantQuiz.Content.LeftItems.findIndex((participantItem) => participantItem.ID === item.ID);
                                let fountParticipantItem = foundParticipantQuiz.Content.LeftItems.find((participantItem) => participantItem.ID === item.ID);

                                if (fountParticipantItem !== undefined) {

                                    journey.Structure[indexStructureItem].Assignment.Quizzes[foundParticipantQuizIndex].Content.LeftItems[fountParticipantItemIndex].MatchesIDs = item.MatchesIDs;

                                    participantQuizObject.LeftItems.push({
                                        ID: fountParticipantItem.ID,
                                        ParticipantMatchesIDs: fountParticipantItem.ParticipantMatchesIDs,
                                    });

                                    const areArraysEqual = item.MatchesIDs.length === fountParticipantItem.ParticipantMatchesIDs.length &&
                                        item.MatchesIDs.slice().sort().every((value, index) => value === fountParticipantItem.ParticipantMatchesIDs.slice().sort()[index]);
                                    if (areArraysEqual) {
                                        numberOfDoneAssignmentScoreElements++;
                                    }
                                }
                            }
                        });


                        participantQuizObject.RightItems = [];

                        quiz.Content.RightItems.forEach((item) => {

                            numberOfAssignmentScoreElements++;

                            if (foundParticipantQuiz !== undefined) {

                                let fountParticipantItemIndex = foundParticipantQuiz.Content.RightItems.findIndex((participantItem) => participantItem.ID === item.ID);
                                let fountParticipantItem = foundParticipantQuiz.Content.RightItems.find((participantItem) => participantItem.ID === item.ID);

                                if (fountParticipantItem !== undefined) {

                                    journey.Structure[indexStructureItem].Assignment.Quizzes[foundParticipantQuizIndex].Content.RightItems[fountParticipantItemIndex].MatchesIDs = item.MatchesIDs;

                                    participantQuizObject.RightItems.push({
                                        ID: fountParticipantItem.ID,
                                        ParticipantMatchesIDs: fountParticipantItem.ParticipantMatchesIDs,
                                    });

                                    const areArraysEqual = item.MatchesIDs.length === fountParticipantItem.ParticipantMatchesIDs.length &&
                                        item.MatchesIDs.slice().sort().every((value, index) => value === fountParticipantItem.ParticipantMatchesIDs.slice().sort()[index]);
                                    if (areArraysEqual) {
                                        numberOfDoneAssignmentScoreElements++;
                                    }
                                }
                            }
                        });
                        break;
                    }

                    case 'Questions With Written Answers': {

                        participantQuizObject.Items = [];

                        quiz.Content.Items.forEach((item) => {

                            numberOfAssignmentScoreElements++;

                            if (foundParticipantQuiz !== undefined) {
                                let fountParticipantItem = foundParticipantQuiz.Content.Items.find((participantItem) => participantItem.ID === item.ID);

                                if (fountParticipantItem !== undefined) {

                                    participantQuizObject.Items.push({
                                        ID: fountParticipantItem.ID,
                                        ParticipantAnswer: fountParticipantItem.ParticipantAnswer,
                                    })

                                    if (fountParticipantItem.ParticipantAnswer !== null) {
                                        numberOfDoneAssignmentScoreElements++;
                                    }
                                }
                            }
                        });
                        break;
                    }

                    case 'Evaluation': {

                        participantQuizObject.Items = [];

                        quiz.Content.Items.forEach((item) => {

                            numberOfAssignmentScoreElements++;

                            if (foundParticipantQuiz !== undefined) {
                                let fountParticipantItem = foundParticipantQuiz.Content.Items.find((participantItem) => participantItem.ID === item.ID);

                                if (fountParticipantItem !== undefined) {

                                    participantQuizObject.Items.push({
                                        ID: fountParticipantItem.ID,
                                        ParticipantRating: fountParticipantItem.ParticipantRating,
                                    })

                                    if (fountParticipantItem.ParticipantRating !== null) {
                                        numberOfDoneAssignmentScoreElements++;
                                    }
                                }
                            }
                        });
                        break;
                    }

                    default: {

                        break;
                    }

                }

                participantAssignment.Quizzes.push(participantQuizObject)

            });

            if (numberOfAssignmentScoreElements !== 0) {
                participantAssignment.ParticipantScorePercentage = (numberOfDoneAssignmentScoreElements / numberOfAssignmentScoreElements ) * 100;
                journey.Structure[indexStructureItem].Assignment.ParticipantScorePercentage = (numberOfDoneAssignmentScoreElements / numberOfAssignmentScoreElements ) * 100;
            }

            // this indicates that assignment was submitted and now users should see the correct answers
            journey.Structure[indexStructureItem].Assignment.IsSubmitted = true;
            participantAssignment.IsSubmitted = true;

            if (journey.hasOwnProperty('IsCurrentUserAuthor') && !journey.IsCurrentUserAuthor) {

                let participantProgress = journey.ParticipantProgress;

                let indexParticipantAssignment = participantProgress.findIndex((progress) => (progress.hasOwnProperty('Assignment') && progress.Assignment.ID === journey.Structure[indexStructureItem].Assignment.ID));

                if (indexParticipantAssignment !== -1) {
                    participantProgress[indexParticipantAssignment].Assignment = participantAssignment;
                }

                let params = {
                    TableName: JourneyParticipantRelationTableName,
                    Key: {
                        ID: journey.JourneyParticipantLinkID,
                    },
                    UpdateExpression: 'SET #ParticipantProgress = :ParticipantProgress',
                    ExpressionAttributeNames: {
                        '#ParticipantProgress': 'ParticipantProgress',
                    },
                    ExpressionAttributeValues: {
                        ':ParticipantProgress': Dynamo.typeConvertorJavascriptToDynamoDB(participantProgress),
                    },
                    ReturnValues: 'NONE',
                };

                await dynamoDB.update(params).promise();

                let journeyExistingAssignments = await getJourneyAssignments(journey.ID);

                for (let assignment of journeyExistingAssignments) {
                    assignment.Unlock = Dynamo.typeConvertorDynamoDBToJavascript(assignment.Unlock);
                    assignment.Quizzes = Dynamo.typeConvertorDynamoDBToJavascript(assignment.Quizzes);
                }

                const paramsQueryTreasureChest = {
                    TableName: TreasureChestTableName,
                    IndexName: 'treasureChestGSI',
                    KeyConditionExpression: "#UserID = :UserID",
                    ExpressionAttributeNames: {
                        '#UserID': 'UserID',
                    },
                    ExpressionAttributeValues: {
                        ":UserID": currentUserID
                    },
                    ScanIndexForward: false,
                };

                const linkedTreasureChestEntries = await dynamoDB.query(paramsQueryTreasureChest).promise();

                journey = await checkParticipantJourneyContentUnlock(journey, journeyExistingAssignments, linkedTreasureChestEntries, currentUserID, tenantID);

            }

            return Responses._200({
                journey: journey,
            });

        }
        catch (error) {
            return Responses._500({message: error.message})
        }

    }

    else {
        return Responses._500({
            message: 'Assignment not found.'
        })
    }

};
const saveAssignmentResponse = async (event) => {

    let requestData = JSON.parse(event.body);
    //
    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('SubmittedStructureItemID')
        && requestData.hasOwnProperty('Journey')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    let journey = requestData.Journey;
    const indexStructureItem = journey.Structure.findIndex((structureItem) => structureItem.ID === requestData.SubmittedStructureItemID);

    if (indexStructureItem !== -1
    && journey.Structure[indexStructureItem].hasOwnProperty('Assignment')
    && journey.Structure[indexStructureItem].Assignment.hasOwnProperty('ID')
    && journey.Structure[indexStructureItem].Assignment.ID !== null) {

        let participantAssignment = {
            ID: journey.Structure[indexStructureItem].Assignment.ID,
            ParticipantScorePercentage: journey.Structure[indexStructureItem].Assignment.ParticipantScorePercentage,
            Quizzes: [],
        };

        try {

            let assignment = await Dynamo.get(journey.Structure[indexStructureItem].Assignment.ID, AssignmentTableName).catch(error => {
                return Responses._500({message: error.message});
            });

            assignment.Quizzes = Dynamo.typeConvertorDynamoDBToJavascript(assignment.Quizzes);
            assignment.Unlock = Dynamo.typeConvertorDynamoDBToJavascript(assignment.Unlock);

            assignment.Quizzes.forEach((quiz) => {

                let participantQuizObject = {
                    ID: quiz.ID,
                    Type: quiz.Type,
                };

                let foundParticipantQuiz = journey.Structure[indexStructureItem].Assignment.Quizzes.find((participantQuiz) => participantQuiz.ID === quiz.ID);

                switch (quiz.Type) {

                    case 'Checklist': {

                        participantQuizObject.Tasks = [];

                        quiz.Content.Tasks.forEach((item) => {

                            if (foundParticipantQuiz !== undefined) {
                                let fountParticipantItem = foundParticipantQuiz.Content.Tasks.find((participantItem) => participantItem.ID === item.ID);

                                if (fountParticipantItem !== undefined) {

                                    participantQuizObject.Tasks.push({
                                        ID: fountParticipantItem.ID,
                                        IsDone: fountParticipantItem.IsDone,
                                    });

                                }
                            }
                        });
                        break;
                    }

                    case 'Multiple Choice': {

                        participantQuizObject.Items = [];

                        quiz.Content.Items.forEach((item) => {

                            let fountParticipantItem = null;

                            if (foundParticipantQuiz !== undefined) {
                                fountParticipantItem = foundParticipantQuiz.Content.Items.find((participantItem) => participantItem.ID === item.ID);
                                participantQuizObject.Items.push({
                                    ID: fountParticipantItem.ID,
                                    Options: [],
                                });
                            }

                            item.Options.forEach((option) => {

                                if (fountParticipantItem !== undefined) {
                                    const participantOption = fountParticipantItem.Options.find((participantOption) => participantOption.ID === option.ID);

                                    if (participantOption !== undefined) {

                                        participantQuizObject.Items[participantQuizObject.Items.length - 1].Options.push({
                                            ID: participantOption.ID,
                                            ParticipantAnswer: participantOption.ParticipantAnswer,
                                        })

                                    }
                                }
                            });

                        });
                        break;
                    }

                    case 'True/False': {

                        participantQuizObject.Items = [];

                        quiz.Content.Items.forEach((item) => {

                            if (foundParticipantQuiz !== undefined) {

                                let fountParticipantItem = foundParticipantQuiz.Content.Items.find((participantItem) => participantItem.ID === item.ID);

                                if (fountParticipantItem !== undefined) {
                                    participantQuizObject.Items.push({
                                        ID: fountParticipantItem.ID,
                                        ParticipantAnswer: fountParticipantItem.ParticipantAnswer,
                                    })
                                }

                            }
                        });
                        break;
                    }

                    case 'Item Match': {

                        participantQuizObject.LeftItems = [];

                        quiz.Content.LeftItems.forEach((item) => {

                            if (foundParticipantQuiz !== undefined) {
                                let fountParticipantItem = foundParticipantQuiz.Content.LeftItems.find((participantItem) => participantItem.ID === item.ID);

                                if (fountParticipantItem !== undefined) {

                                    participantQuizObject.LeftItems.push({
                                        ID: fountParticipantItem.ID,
                                        ParticipantMatchesIDs: fountParticipantItem.ParticipantMatchesIDs,
                                    });

                                }
                            }
                        });


                        participantQuizObject.RightItems = [];

                        quiz.Content.RightItems.forEach((item) => {

                            if (foundParticipantQuiz !== undefined) {
                                let fountParticipantItem = foundParticipantQuiz.Content.RightItems.find((participantItem) => participantItem.ID === item.ID);

                                if (fountParticipantItem !== undefined) {

                                    participantQuizObject.RightItems.push({
                                        ID: fountParticipantItem.ID,
                                        ParticipantMatchesIDs: fountParticipantItem.ParticipantMatchesIDs,
                                    });

                                }
                            }
                        });
                        break;
                    }

                    case 'Questions With Written Answers': {

                        participantQuizObject.Items = [];

                        quiz.Content.Items.forEach((item) => {

                            if (foundParticipantQuiz !== undefined) {
                                let fountParticipantItem = foundParticipantQuiz.Content.Items.find((participantItem) => participantItem.ID === item.ID);

                                if (fountParticipantItem !== undefined) {

                                    participantQuizObject.Items.push({
                                        ID: fountParticipantItem.ID,
                                        ParticipantAnswer: fountParticipantItem.ParticipantAnswer,
                                    })

                                }
                            }
                        });
                        break;
                    }

                    case 'Evaluation': {

                        participantQuizObject.Items = [];

                        quiz.Content.Items.forEach((item) => {

                            if (foundParticipantQuiz !== undefined) {
                                let fountParticipantItem = foundParticipantQuiz.Content.Items.find((participantItem) => participantItem.ID === item.ID);

                                if (fountParticipantItem !== undefined) {

                                    participantQuizObject.Items.push({
                                        ID: fountParticipantItem.ID,
                                        ParticipantRating: fountParticipantItem.ParticipantRating,
                                    })

                                }
                            }
                        });
                        break;
                    }

                    default: {

                        break;
                    }

                }

                participantAssignment.Quizzes.push(participantQuizObject)

            });

            if (!journey.IsCurrentUserAuthor) {

                let participantProgress = journey.ParticipantProgress;

                let indexParticipantAssignment = participantProgress.findIndex((progress) => (progress.hasOwnProperty('Assignment') && progress.Assignment.ID === journey.Structure[indexStructureItem].Assignment.ID));

                if (indexParticipantAssignment !== -1) {
                    participantProgress[indexParticipantAssignment].Assignment = participantAssignment;
                }

                let params = {
                    TableName: JourneyParticipantRelationTableName,
                    Key: {
                        ID: journey.JourneyParticipantLinkID,
                    },
                    UpdateExpression: 'SET #ParticipantProgress = :ParticipantProgress',
                    ExpressionAttributeNames: {
                        '#ParticipantProgress': 'ParticipantProgress',
                    },
                    ExpressionAttributeValues: {
                        ':ParticipantProgress': Dynamo.typeConvertorJavascriptToDynamoDB(participantProgress),
                    },
                    ReturnValues: 'NONE',
                };

                await dynamoDB.update(params).promise();

            }

            return Responses._200({
                journey: journey,
            });

        }
        catch (error) {
            return Responses._500({message: error.message})
        }

    }

    else {
        return Responses._500({
            message: 'Assignment not found.'
        })
    }

};


// TODO to be deleted
const adaptJourneyTemp = async (event) => {

    try {

        // let requestData = JSON.parse(event.body);
        //
        // const authorizer_context = event.requestContext.authorizer.lambda;
        // const tenantID = authorizer_context.tenant;
        //
        // const hasRequiredParams = (requestData) => {
        //     return (requestData.hasOwnProperty('JourneyID'));
        // };
        //
        // if (!hasRequiredParams(requestData)) {
        //     return Responses._400({ message: 'Missing required parameters!' });
        // }
        //
        // let tenantJourneys = await getTenantJourneys(tenantID);
        // tenantJourneys = tenantJourneys.filter((journey) => journey.ID === requestData.JourneyID);
        //
        // for (let journey of tenantJourneys) {
        //
        //     journey.Overview = Dynamo.typeConvertorDynamoDBToJavascript(journey.Overview);
        //     journey.Structure = Dynamo.typeConvertorDynamoDBToJavascript(journey.Structure);
        //
        //
        //
        //     // add IsFacilitatorNote to journey structure item
        //     journey.Structure.forEach((structureItem) => {
        //         if (!structureItem.hasOwnProperty('IsFacilitatorNote')) {
        //             structureItem.IsFacilitatorNote = false;
        //         }
        //     });
        //
        //     let paramsUpdateJourneyStructure = {
        //         TableName: JourneyTableName,
        //         Key: {
        //             ID: journey.ID,
        //         },
        //         UpdateExpression: 'SET #Structure = :Structure',
        //         ExpressionAttributeNames: {
        //             '#Structure': 'Structure',
        //         },
        //         ExpressionAttributeValues: {
        //             ':Structure': Dynamo.typeConvertorJavascriptToDynamoDB(journey.Structure),
        //         },
        //         ReturnValues: 'NONE',
        //     };
        //     await dynamoDB.update(paramsUpdateJourneyStructure).promise();
        //
        //
        //
        //     // rebuild journey structure
        //     // journey.Structure = journey.Structure.filter((structureItem) => structureItem.Type !== 'Assignment');
        //     // journey.Structure.forEach((structureItem) => {
        //     //
        //     //     if (structureItem.Type === 'Event') {
        //     //         if (!structureItem.hasOwnProperty('Assignment')) {
        //     //             structureItem.Assignment = {
        //     //                 ID: null,
        //     //             }
        //     //         }
        //     //         if (!structureItem.hasOwnProperty('IsLocked')) {
        //     //             structureItem.IsLocked = false;
        //     //         }
        //     //         if (!structureItem.hasOwnProperty('IsHidden')) {
        //     //             structureItem.IsHidden = false;
        //     //         }
        //     //     }
        //     //
        //     // });
        //     // let paramsUpdateJourneyStructure = {
        //     //     TableName: JourneyTableName,
        //     //     Key: {
        //     //         ID: journey.ID,
        //     //     },
        //     //     UpdateExpression: 'SET #Structure = :Structure',
        //     //     ExpressionAttributeNames: {
        //     //         '#Structure': 'Structure',
        //     //     },
        //     //     ExpressionAttributeValues: {
        //     //         ':Structure': Dynamo.typeConvertorJavascriptToDynamoDB(journey.Structure),
        //     //     },
        //     //     ReturnValues: 'NONE',
        //     // };
        //     // await dynamoDB.update(paramsUpdateJourneyStructure).promise();
        //     //
        //     //
        //     // // rebuild participant progress and remove participant assignments column
        //     // let foundLinks = await getJourneyParticipantsLinks(event, tenantID, journey.ID, null, null, null);
        //     // let journeyExistingAssignments = await getJourneyAssignments(journey.ID);
        //     //
        //     // for (let assignment of journeyExistingAssignments) {
        //     //     assignment.Unlock = Dynamo.typeConvertorDynamoDBToJavascript(assignment.Unlock);
        //     //     assignment.Quizzes = Dynamo.typeConvertorDynamoDBToJavascript(assignment.Quizzes);
        //     // }
        //     //
        //     // for (let foundLink of foundLinks) {
        //     //
        //     //     let participantProgress = [];
        //     //
        //     //     // if (foundLink.JourneyRole === 'Participant') {
        //     //         participantProgress = buildParticipantProgress(journey.Structure, journeyExistingAssignments);
        //     //     // }
        //     //
        //     //     let paramsUpdateParticipantProgress = {
        //     //         TableName: JourneyParticipantRelationTableName,
        //     //         Key: {
        //     //             ID: foundLink.ID,
        //     //         },
        //     //         UpdateExpression: 'SET #ParticipantProgress = :ParticipantProgress',
        //     //         ExpressionAttributeNames: {
        //     //             '#ParticipantProgress': 'ParticipantProgress',
        //     //         },
        //     //         ExpressionAttributeValues: {
        //     //             ':ParticipantProgress': Dynamo.typeConvertorJavascriptToDynamoDB(participantProgress),
        //     //         },
        //     //         ReturnValues: 'NONE',
        //     //     };
        //     //     await dynamoDB.update(paramsUpdateParticipantProgress).promise();
        //     //
        //     //
        //     //     const columnToDelete = 'ParticipantAssignments';
        //     //     let paramsRemoveParticipantAssignmentsColumn = {
        //     //         TableName: JourneyParticipantRelationTableName,
        //     //         Key: {
        //     //             ID: foundLink.ID,
        //     //         },
        //     //         UpdateExpression: `REMOVE ${columnToDelete}`,
        //     //     };
        //     //     await dynamoDB.update(paramsRemoveParticipantAssignmentsColumn).promise();
        //     //
        //     // }
        //
        // }
        //
        // return Responses._200({
        //     message: 'Journey adapted successfully',
        // });

    }
    catch (error) {
        return Responses._500({message: error.message});
    }
}

const getJourneyTranslated = async (event) => {
    let requestData = JSON.parse(event.body);
    // Updated validation to only require essential fields
    const hasRequiredParams = (requestData) => {
        return requestData.hasOwnProperty('journeyId') && 
               requestData.hasOwnProperty('targetLang');
    };
    
    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    const authorizer_context = event.requestContext.authorizer.lambda;
    const tenantID = authorizer_context.tenant;
    const currentUserID = authorizer_context.username;
    let journeyId = requestData.journeyId;
    let targetLang = requestData.targetLang;
    try {

        //fetch journey content
        const journey = await fetchJourneyforTranslation(journeyId);
        if (!journey) {
            return Responses._500({ message: 'Journey not found.' });
        }
        

        // Translate Overview
        console.log('Starting Overview translation');
        const overviewData = journey['Overview'];
        if (!overviewData) {
            return Responses._500({ message: 'Overview field not found in journey.' });
        }
        const translatedOverview = await translateJson(overviewData, targetLang);
        await updateJourneyforTranslation(journeyId, 'Overview', translatedOverview);

        // Translate Structure
        console.log('Starting Structure translation');
        const structureData = journey['Structure'];
        if (!structureData) {
            return Responses._500({ message: 'Structure field not found in journey.' });
        }
        const translatedStructure = await translateJson(structureData, targetLang);
        await updateJourneyforTranslation(journeyId, 'Structure', translatedStructure);

        // Return success with translated data
        return Responses._200({ 
            message: 'Journey translation completed successfully',
            data: {
                journeyId,
                translatedFields: ['Overview', 'Structure']
            }
        });

    } catch (error) {
        console.log('Error: ', error.message);
        return Responses._500({ message: error.message });
    }
}

/// end POST Methods


///PUT Methots (for Updates)

const updateJourney = async (event, id) => {

    const authorizer_context = event.requestContext.authorizer.lambda;
    const tenantID = authorizer_context.tenant;

    console.log("check for id handover");
    console.log("id:", id);
    console.log("event.pathParameters.ID:", event.pathParameters.ID);
    console.log("event:", event);


    if (!id) {
        // failed without an ID
        return Responses._400({ message: 'Missing the ID from the path' });
    }

    let requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('Name')
            && requestData.hasOwnProperty('Description')
            && requestData.hasOwnProperty('CategoryID')
            && requestData.hasOwnProperty('Picture')
            && requestData.hasOwnProperty('Overview')
            && requestData.hasOwnProperty('Structure'));
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        let journeyAssignments = [];
        let journeyReadyAssignments = [];

        for (let structureItem of requestData.Structure) {

            if (structureItem.Type === 'Event'
                && structureItem.hasOwnProperty('Assignment')
                && structureItem.Assignment.hasOwnProperty('ID')
            ) {

                if (structureItem.Assignment.ID !== null) {

                    let assignment = {
                        ID: structureItem.Assignment.ID,
                        IsReady: structureItem.Assignment.IsReady,
                        IsResettable: structureItem.Assignment.IsResettable,
                        Unlock: structureItem.Assignment.Unlock,
                        Quizzes: structureItem.Assignment.Quizzes,
                        JourneyID: id,
                        StructureItemID: structureItem.ID,
                        TenantID: tenantID,
                    };

                    if (structureItem.Assignment.Quizzes.length > 0) {

                        journeyAssignments.push(assignment);

                        if (structureItem.Assignment.IsReady) {
                            let journeyReadyAssignment = JSON.parse(JSON.stringify(assignment));
                            if (structureItem.Assignment.hasOwnProperty('IsChanged') && structureItem.Assignment.IsChanged) {
                                journeyReadyAssignment.IsChanged = structureItem.Assignment.IsChanged;
                            }
                            journeyReadyAssignments.push(journeyReadyAssignment);
                        }

                        structureItem.Assignment = {
                            ID: assignment.ID,
                        };
                    } else {
                        structureItem.Assignment = {
                            ID: null,
                        };
                    }
                }
                else {
                    structureItem.Assignment = {
                        ID: null,
                    };
                }

            }

        }

        requestData.Overview = Dynamo.typeConvertorJavascriptToDynamoDB(requestData.Overview);
        requestData.Structure = Dynamo.typeConvertorJavascriptToDynamoDB(requestData.Structure);

        let params = {
            TableName: JourneyTableName,
            Key: {
                ID: id,
            },
            UpdateExpression: 'SET #name = :name, #description = :description, #categoryID = :categoryID, #picture = :picture, #overview = :overview, #structure = :structure',
            ExpressionAttributeNames: {
                '#name': 'Name',
                '#description': 'Description',
                '#categoryID': 'CategoryID',
                '#picture': 'Picture',
                '#overview': 'Overview',
                '#structure': 'Structure',
            },
            ExpressionAttributeValues: {
                ':name': requestData.Name,
                ':description': requestData.Description,
                ':categoryID': requestData.CategoryID,
                ':picture': requestData.Picture,
                ':overview': requestData.Overview,
                ':structure': requestData.Structure,
            },
            ReturnValues: 'ALL_NEW',
        };

        const response = await dynamoDB.update(params).promise();

        let updatedJourney = response.Attributes;

        updatedJourney.Overview = Dynamo.typeConvertorDynamoDBToJavascript(updatedJourney.Overview);
        updatedJourney.Structure = Dynamo.typeConvertorDynamoDBToJavascript(updatedJourney.Structure);

        updatedJourney.Structure.forEach((structureItem) => {
            if (structureItem.Type === 'Event' && (!structureItem.hasOwnProperty('Assignment') || !structureItem.Assignment.hasOwnProperty('ID') || structureItem.Assignment.ID === null)) {
                structureItem.Assignment = {
                    ID: null,
                    IsReady: false,
                    IsResettable: true,
                    Unlock: {
                        IsUnlock: false,
                        MinPercentage: 0,
                    },
                    Quizzes: [],
                }
            }
        });

        let journeyExistingAssignments = await getJourneyAssignments(id);

        // delete assignments from assignment table
        const assignmentIds = new Set(journeyAssignments.map(item => item.ID));
        // filter journeyExistingAssignments to find IDs not in journeyAssignments
        const deletedAssignmentsIDs = journeyExistingAssignments
            .filter(item => !assignmentIds.has(item.ID))
            .map(item => item.ID);

        for (let assignmentID of deletedAssignmentsIDs) {
            const params = {
                TableName: AssignmentTableName,
                Key: {
                    ID: assignmentID,
                },
            };
            await dynamoDB.delete(params).promise();

        }

        journeyExistingAssignments = journeyExistingAssignments.filter((journeyExistingAssignment) => !deletedAssignmentsIDs.includes(journeyExistingAssignment.ID));

        // add assignments to Assignment Table
        for (const journeyAssignment of journeyAssignments) {

            let foundAssignment = journeyExistingAssignments.find((journeyExistingAssignment) => (journeyExistingAssignment.ID === journeyAssignment.ID && journeyExistingAssignment.TenantID === tenantID));
            const indexStructureItem = updatedJourney.Structure.findIndex((StructureItem) => StructureItem.ID === journeyAssignment.StructureItemID);

            // add assignment
            if (foundAssignment === undefined) {

                let paramsNewAssignment = JSON.parse(JSON.stringify(journeyAssignment));

                paramsNewAssignment.Unlock = Dynamo.typeConvertorJavascriptToDynamoDB(paramsNewAssignment.Unlock);
                paramsNewAssignment.Quizzes = Dynamo.typeConvertorJavascriptToDynamoDB(paramsNewAssignment.Quizzes);

                const newAssignment = await Dynamo.write(paramsNewAssignment, AssignmentTableName).catch(error => {
                    return Responses._500({ message: error.message });
                });

                updatedJourney.Structure[indexStructureItem].Assignment = {
                    ID: newAssignment.ID,
                    IsReady: newAssignment.IsReady,
                    IsResettable: newAssignment.IsResettable,
                    Unlock: Dynamo.typeConvertorDynamoDBToJavascript(newAssignment.Unlock),
                    Quizzes: Dynamo.typeConvertorDynamoDBToJavascript(newAssignment.Quizzes),
                }

            }
            // update existing assignment
            else {

                const paramsUpdateAssignment = {
                    TableName: AssignmentTableName,
                    Key: {
                        ID: foundAssignment.ID,
                    },
                    UpdateExpression: 'SET #IsReady = :IsReady, #IsResettable = :IsResettable, #Unlock = :Unlock, #Quizzes = :Quizzes, #JourneyID = :JourneyID, #StructureItemID = :StructureItemID',
                    ExpressionAttributeNames: {
                        '#IsResettable': 'IsResettable',
                        '#IsReady': 'IsReady',
                        '#Unlock': 'Unlock',
                        '#Quizzes': 'Quizzes',
                        '#JourneyID': 'JourneyID',
                        '#StructureItemID': 'StructureItemID',
                    },
                    ExpressionAttributeValues: {
                        ':IsReady': journeyAssignment.IsReady,
                        ':IsResettable': journeyAssignment.IsResettable,
                        ':Unlock': Dynamo.typeConvertorJavascriptToDynamoDB(journeyAssignment.Unlock),
                        ':Quizzes': Dynamo.typeConvertorJavascriptToDynamoDB(journeyAssignment.Quizzes),
                        ':JourneyID': journeyAssignment.JourneyID,
                        ':StructureItemID': journeyAssignment.StructureItemID,
                    },
                    ReturnValues: 'ALL_NEW',
                };

                const responseUpdateAssignment = await dynamoDB.update(paramsUpdateAssignment).promise();

                const updatedAssignment = responseUpdateAssignment.Attributes;

                updatedJourney.Structure[indexStructureItem].Assignment = {
                    ID: updatedAssignment.ID,
                    IsReady: updatedAssignment.IsReady,
                    IsResettable: updatedAssignment.IsResettable,
                    Unlock: Dynamo.typeConvertorDynamoDBToJavascript(updatedAssignment.Unlock),
                    Quizzes: Dynamo.typeConvertorDynamoDBToJavascript(updatedAssignment.Quizzes),
                }

                let indexJourneyExistingAssignment = journeyExistingAssignments.findIndex((assignment) => assignment.ID === updatedAssignment.ID);

                if (indexJourneyExistingAssignment !== -1) {
                    journeyExistingAssignments[indexJourneyExistingAssignment] = updatedAssignment;
                }

            }

        }

        const ExpressionAttributeValues = "ID, JourneyRole, ParticipantProgress";
        let foundLinks = await getJourneyParticipantsLinks(event, tenantID, id, null, null, ExpressionAttributeValues);
        let isConvertedToJavascript = false;

        const updatePromisesFromJourneyParticipantRelationTable = foundLinks.map(item => {

            // if (item.JourneyRole === 'Participant') {

                let oldParticipantProgress = Dynamo.typeConvertorDynamoDBToJavascript(item.ParticipantProgress);

                // reset user assignment if it was changed
                journeyReadyAssignments.forEach((journeyAssignment) => {

                    let indexParticipantAssignment = oldParticipantProgress.findIndex((participantProgress) => (participantProgress.hasOwnProperty('Assignment') && participantProgress.Assignment.ID === journeyAssignment.ID));

                    if (indexParticipantAssignment !== -1) {
                        if (journeyAssignment.hasOwnProperty('IsChanged') && journeyAssignment.IsChanged) {
                            oldParticipantProgress[indexParticipantAssignment].Assignment = buildParticipantAssignment(journeyAssignment);
                        }
                    }
                });

                if (!isConvertedToJavascript) {
                    for (let assignment of journeyExistingAssignments) {
                        assignment.Unlock = Dynamo.typeConvertorDynamoDBToJavascript(assignment.Unlock);
                        assignment.Quizzes = Dynamo.typeConvertorDynamoDBToJavascript(assignment.Quizzes);
                    }
                    isConvertedToJavascript = true;
                }


                let newParticipantProgress = buildParticipantProgress(updatedJourney.Structure, journeyExistingAssignments, oldParticipantProgress);

                const updateParams = {
                    TableName: JourneyParticipantRelationTableName,
                    Key: {
                        ID: item.ID,
                    },
                    UpdateExpression: 'SET #ParticipantProgress = :ParticipantProgress',
                    ExpressionAttributeNames: {
                        '#ParticipantProgress': 'ParticipantProgress',
                    },
                    ExpressionAttributeValues: {
                        ':ParticipantProgress': Dynamo.typeConvertorJavascriptToDynamoDB(newParticipantProgress),
                    },
                    ReturnValues: 'NONE',
                };

                return dynamoDB.update(updateParams).promise();
            // }

        });

        await Promise.all(updatePromisesFromJourneyParticipantRelationTable);

        // if linked asset is deleted, delete it from all treasure chests
        let treasureChestRows = await getTreasureChests(event, tenantID);

        if (requestData.hasOwnProperty('ExistingAssetsToDelete') && requestData.ExistingAssetsToDelete.length > 0) {

            for (let indexRow= 0; indexRow < treasureChestRows.length; indexRow++) {

                if (treasureChestRows[indexRow].hasOwnProperty('Assets')) {
                    treasureChestRows[indexRow].Assets = Dynamo.typeConvertorDynamoDBToJavascript(treasureChestRows[indexRow].Assets);

                    for (let indexAsset = 0; indexAsset < treasureChestRows[indexRow].Assets.length; indexAsset++) {

                        if (requestData.ExistingAssetsToDelete.includes(treasureChestRows[indexRow].Assets[indexAsset].Name)) {
                            treasureChestRows[indexRow].Assets.splice(indexAsset, 1);
                        }
                    }

                    let paramsUpdateTreasureChestEntry = {
                        TableName: TreasureChestTableName,
                        Key: {
                            ID: treasureChestRows[indexRow].ID,
                        },
                        UpdateExpression: 'SET #Assets = :Assets',
                        ExpressionAttributeNames: {
                            '#Assets': 'Assets',
                        },
                        ExpressionAttributeValues: {
                            ':Assets': Dynamo.typeConvertorJavascriptToDynamoDB(treasureChestRows[indexRow].Assets),
                        },
                        ReturnValues: 'NONE',
                    };

                    await dynamoDB.update(paramsUpdateTreasureChestEntry).promise();

                }
            }
        }

        return Responses._200({ updatedJourney });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const updateActiveStatus = async (event, id) => {
    if (!event.pathParameters || !event.pathParameters.ID) {
        // failed without an ID
        return Responses._400({ message: 'Missing the ID from the path' });
    }
    console.log("check for id handover");
    console.log("id:", id);
    console.log("event.pathParameters.ID:", event.pathParameters.ID);
    console.log("event:", event);


    let requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('Active'));
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        const journeyID = event.pathParameters.ID;

        // update Journey active status
        let paramsUpdateJourney = {
            TableName: JourneyTableName,
            Key: {
                ID: journeyID,
            },
            UpdateExpression: 'SET #active = :active',
            ExpressionAttributeNames: {
                '#active': 'Active',
            },
            ExpressionAttributeValues: {
                ':active': requestData.Active,
            },
            ReturnValues: 'UPDATED_NEW',
        };

        const responseUpdateJourney = await dynamoDB.update(paramsUpdateJourney).promise();

        let updatedJourney = responseUpdateJourney.Attributes;
        updatedJourney.ID = journeyID;

        return Responses._200({ updatedJourney });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const updateAuthor = async (event, id) => {
    if (!event.pathParameters || !event.pathParameters.ID) {
        // failed without an ID
        return Responses._400({ message: 'Missing the ID from the path' });
    }
    console.log("check for id handover");
    console.log("id:", id);
    console.log("event.pathParameters.ID:", event.pathParameters.ID);
    console.log("event:", event);



    let requestData = JSON.parse(event.body);
    //
    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('AuthorID'));
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {
        const authorizer_context = event.requestContext.authorizer.lambda;
        const journeyID = event.pathParameters.ID;
        const tenantID = authorizer_context.tenant;

        let paramsUpdateJourneyTable = {
            TableName: JourneyTableName,
            Key: {
                ID: journeyID,
            },
            UpdateExpression: 'SET #AuthorID = :AuthorID',
            ExpressionAttributeNames: {
                '#AuthorID': 'AuthorID',
            },
            ExpressionAttributeValues: {
                ':AuthorID': requestData.AuthorID,
            },
            ReturnValues: 'UPDATED_NEW',
        };

        const responseUpdateJourney = await dynamoDB.update(paramsUpdateJourneyTable).promise();

        let updatedJourney = responseUpdateJourney.Attributes;
        updatedJourney.ID = journeyID;

        // let paramsQueryJourneyParticipantRelationTable = {
        //     TableName: JourneyParticipantRelationTableName,
        //     IndexName: "journeyParticipantRelationGSI",
        //     KeyConditionExpression: "#JourneyID = :JourneyID",
        //     ExpressionAttributeNames: {
        //         '#JourneyID': 'JourneyID',
        //     },
        //     ExpressionAttributeValues: {
        //         ':JourneyID': journeyID,
        //     },
        //     ProjectionExpression:
        //         "ID",
        //     ScanIndexForward: false,
        // };
        //
        // const responseQueryJourneyParticipantRelationTable = await dynamoDB.query(paramsQueryJourneyParticipantRelationTable).promise();
        //
        // if (responseQueryJourneyParticipantRelationTable.hasOwnProperty('Count') && responseQueryJourneyParticipantRelationTable.hasOwnProperty('Items') && responseQueryJourneyParticipantRelationTable.Count > 0) {
        //
        //     const foundLinks = responseQueryJourneyParticipantRelationTable.Items;
        //
        //     const updatePromisesFromJourneyParticipantRelationTable = foundLinks.map(item => {
        //         const updateParams = {
        //             TableName: JourneyParticipantRelationTableName,
        //             Key: {
        //                 ID: item.ID,
        //             },
        //             UpdateExpression: 'SET #AuthorID = :AuthorID',
        //             ExpressionAttributeNames: {
        //                 '#AuthorID': 'AuthorID',
        //             },
        //             ExpressionAttributeValues: {
        //                 ':AuthorID': requestData.AuthorID,
        //             },
        //             ReturnValues: 'NONE',
        //         };
        //
        //         return dynamoDB.update(updateParams).promise();
        //     });
        //
        //     await Promise.all(updatePromisesFromJourneyParticipantRelationTable);
        //
        // }

        const ExpressionAttributeValues = "ID";
        let foundLinks = await getJourneyParticipantsLinks(event, tenantID, journeyID, null, null, ExpressionAttributeValues);

        const updatePromisesFromJourneyParticipantRelationTable = foundLinks.map(item => {
            const updateParams = {
                TableName: JourneyParticipantRelationTableName,
                Key: {
                    ID: item.ID,
                },
                UpdateExpression: 'SET #AuthorID = :AuthorID',
                ExpressionAttributeNames: {
                    '#AuthorID': 'AuthorID',
                },
                ExpressionAttributeValues: {
                    ':AuthorID': requestData.AuthorID,
                },
                ReturnValues: 'NONE',
            };

            return dynamoDB.update(updateParams).promise();
        });

        await Promise.all(updatePromisesFromJourneyParticipantRelationTable);

        return Responses._200({ updatedJourney });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const updateJourneyCategory = async (event, id) => {
    if (!event.pathParameters || !event.pathParameters.ID) {
        // failed without an ID
        return Responses._400({ message: 'Missing the ID from the path' });
    }

    console.log("check for id handover");
    console.log("id:", id);
    console.log("event.pathParameters.ID:", event.pathParameters.ID);
    console.log("event:", event);



    let requestData = JSON.parse(event.body);
    //
    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('Name'));
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        let params = {
            TableName: JourneyCategoryTableName,
            Key: {
                ID: event.pathParameters.ID,
            },
            UpdateExpression: 'SET #name = :name',
            ExpressionAttributeNames: {
                '#name': 'Name',
            },
            ExpressionAttributeValues: {
                ':name': requestData.Name,
            },
            ReturnValues: 'ALL_NEW',
        };

        const response = await dynamoDB.update(params).promise();

        let updatedJourneyCategory = response.Attributes;

        return Responses._200({ updatedJourneyCategory });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
const setParticipantsProgress = async (event) => {
    let requestData = JSON.parse(event.body);
    const authorizer_context = event.requestContext.authorizer.lambda;
    const journeyID = event.pathParameters.ID;
    const tenantID = authorizer_context.tenant;
    //
    const hasRequiredParams = (requestData) => {
        return ( requestData.hasOwnProperty('JourneyID')
            && requestData.hasOwnProperty('StructureItemID')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        const ExpressionAttributeValues = "ID, ParticipantProgress";
        let foundLinks = await getJourneyParticipantsLinks(event, tenantID, journeyID, null, null, ExpressionAttributeValues);

        const updatePromisesFromJourneyParticipantRelationTable = foundLinks.map(item => {

            let participantProgress = Dynamo.typeConvertorDynamoDBToJavascript(item.ParticipantProgress);

            if (requestData.StructureItemID === null) {
                participantProgress.forEach((progress) => {
                    progress.Completed = false;
                });
            }
            else {
                let targetStructureItemIndex = participantProgress.findIndex((progress) => progress.StructureItemID === requestData.StructureItemID);

                participantProgress.forEach((progress, index) => {
                    progress.Completed = (index < targetStructureItemIndex);
                });
            }

            participantProgress = Dynamo.typeConvertorJavascriptToDynamoDB(participantProgress);

            const updateParams = {
                TableName: JourneyParticipantRelationTableName,
                Key: {
                    ID: item.ID,
                },
                UpdateExpression: 'SET #ParticipantProgress = :ParticipantProgress',
                ExpressionAttributeNames: {
                    '#ParticipantProgress': 'ParticipantProgress',
                },
                ExpressionAttributeValues: {
                    ':ParticipantProgress': participantProgress,
                },
                ReturnValues: 'NONE',
            };

            return dynamoDB.update(updateParams).promise();
        });

        await Promise.all(updatePromisesFromJourneyParticipantRelationTable);

        return Responses._200({message: 'Participants progress set successfully'});

    } catch (error) {
        return Responses._500({ message: error.message });
    }

};
const updateParticipantProgress = async (event) => {
    const authorizer_context = event.requestContext.authorizer.lambda;
    const currentUserID = authorizer_context.username;
    const tenantID = authorizer_context.tenant;

    let requestData = JSON.parse(event.body);

    const hasRequiredParams = (requestData) => {
        return (requestData.hasOwnProperty('JourneyID')
            && requestData.hasOwnProperty('StructureItemID')
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({ message: 'Missing required parameters!' });
    }

    try {

        let responseGetJourney = await Dynamo.get(requestData.JourneyID, JourneyTableName).catch(error => {
            return Responses._500({message: error.message});
        });
        let journeyStructure = responseGetJourney.Structure;
        journeyStructure = Dynamo.typeConvertorDynamoDBToJavascript(journeyStructure);

        // no pagination problem here, because it should be only one entry
        let paramsQueryJourneyParticipantRelationTable = {
            TableName: JourneyParticipantRelationTableName,
            FilterExpression: "#JourneyID = :JourneyID and #ParticipantID = :ParticipantID and #TenantID = :TenantID",
            ExpressionAttributeNames: {
                '#JourneyID': 'JourneyID',
                '#ParticipantID': 'ParticipantID',
                '#TenantID': 'TenantID',
            },
            ExpressionAttributeValues: {
                ':JourneyID': requestData.JourneyID,
                ':ParticipantID': currentUserID,
                ':TenantID': tenantID,
            },
            ProjectionExpression:
                "ID, ParticipantProgress",
        };

        const responseQueryJourneyParticipantRelationTable = await dynamoDB.scan(paramsQueryJourneyParticipantRelationTable).promise();

        let updatedProgress = {};

        if (responseQueryJourneyParticipantRelationTable.hasOwnProperty('Count') && responseQueryJourneyParticipantRelationTable.hasOwnProperty('Items') && responseQueryJourneyParticipantRelationTable.Count > 0) {

            const foundLinks = responseQueryJourneyParticipantRelationTable.Items;

            if (responseQueryJourneyParticipantRelationTable.Count === 1) {

                let item = foundLinks[0];

                let participantProgress = Dynamo.typeConvertorDynamoDBToJavascript(item.ParticipantProgress);

                let targetStructureItemIndex = participantProgress.findIndex((progress) => progress.StructureItemID === requestData.StructureItemID);

                participantProgress[targetStructureItemIndex].Completed = true;

                participantProgress = Dynamo.typeConvertorJavascriptToDynamoDB(participantProgress);

                const updateParams = {
                    TableName: JourneyParticipantRelationTableName,
                    Key: {
                        ID: item.ID,
                    },
                    UpdateExpression: 'SET #ParticipantProgress = :ParticipantProgress',
                    ExpressionAttributeNames: {
                        '#ParticipantProgress': 'ParticipantProgress',
                    },
                    ExpressionAttributeValues: {
                        ':ParticipantProgress': participantProgress,
                    },
                    ReturnValues: 'ALL_NEW',
                };

                try {

                    let response = await dynamoDB.update(updateParams).promise();
                    let newParticipantProgress = Dynamo.typeConvertorDynamoDBToJavascript(response.Attributes.ParticipantProgress);

                    updatedProgress = {
                        JourneyID: response.Attributes.JourneyID,
                        ParticipantProgress: newParticipantProgress,
                        ParticipantProgressPercentage: calculateJourneyCompletionPercentage(newParticipantProgress, journeyStructure)
                    }

                }
                catch (error) {
                    return Responses._500({ message: error.message });
                }

            }
            else {
                return Responses._500({ message: 'More or less than one entry found for this user' });
            }

        }

        return Responses._200({ updatedProgress });

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};
/// end PUT Methods

///DELETE Methods

const deleteJourneyCategory = async (event, id) => {
    if (!event.pathParameters || !event.pathParameters.ID) {
        // failed without an ID
        return Responses._400({ message: 'Missing the ID from the path' });
    }
    console.log("check for id handover");
    console.log("id:", id);
    console.log("event.pathParameters.ID:", event.pathParameters.ID);
    console.log("event:", event);


    try {

        const params = {
            TableName: JourneyCategoryTableName,
            Key: {
                ID: event.pathParameters.ID,
            },
        };

        await dynamoDB.delete(params).promise();

        return Responses._200({message: 'Journey category deleted successfully'});

    } catch (error) {
        return Responses._500({ message: error.message });
    }
};

const deleteFile = async (event) => {
    const authorizer_context = event.requestContext.authorizer.lambda;
    const requestData = JSON.parse(event.body);

    // if (
    //     data.hasOwnProperty('folder_name') &&
    //     data.hasOwnProperty('image_name') &&
    //     typeof data.folder_name !== "string" &&
    //     typeof data.image_name !== "string"
    // ) {
    //     console.error("Validation Failed");
    //     callback(null, {
    //         statusCode: 400,
    //         headers: { "Content-Type": "text/plain" },
    //         body: "Couldn't request a URL",
    //     });
    //     return;
    // }

    const hasRequiredParams = (requestData) => {
        return (
            (requestData.hasOwnProperty('file_name') && requestData.hasOwnProperty('folder_name')) || (requestData.hasOwnProperty('full_key'))
        );
    };

    if (!hasRequiredParams(requestData)) {
        return Responses._400({message: 'Missing required parameters!'});
    }

    const tenant_id = `${authorizer_context.tenant}`;
    let key = '';

    if (!requestData.hasOwnProperty('full_key')) {
        key = `uploads/${tenant_id}/${requestData.folder_name}/${requestData.file_name}`;
    }
    else {
        key = `${requestData.full_key}`;
    }

    const s3Params = {
        Bucket: S3_BUCKET,
        Key: key,
    };

    try {
        await s3.deleteObject(s3Params).promise();
        return Responses._200({message: 'Delete successful'});
    }
    catch (err) {
        return Responses._500({ message: 'Delete failed'} )
    }

}

const deleteJourney = async (event) => {

    if (!event.pathParameters || !event.pathParameters.ID) {
        // failed without an ID
        return Responses._400({ message: 'Missing the ID from the path' });
    }

    try {

        const authorizer_context = event.requestContext.authorizer.lambda;
        const tenantID = authorizer_context.tenant;
        let journeyID = event.pathParameters.ID;

        // delete journey from JourneyTable
        const paramsDeleteJourney = {
            TableName: JourneyTableName,
            Key: {
                ID: journeyID,
            },
        };

        await dynamoDB.delete(paramsDeleteJourney).promise();


        // let paramsScanJourneyParticipantRelationTable = {
        //     TableName: JourneyParticipantRelationTableName,
        //     FilterExpression: `#JourneyID = :JourneyID  and #TenantID = :TenantID`,
        //     ExpressionAttributeNames: {
        //         '#JourneyID': 'JourneyID',
        //         '#TenantID': 'TenantID',
        //     },
        //     ExpressionAttributeValues: {
        //         ':JourneyID': journeyID,
        //         ':TenantID': tenantID,
        //     },
        //     ProjectionExpression:
        //         "ID",
        // }

        // const responseScanJourneyParticipantRelationTable = await dynamoDB.scan(paramsScanJourneyParticipantRelationTable).promise();
        //
        // if (responseScanJourneyParticipantRelationTable.hasOwnProperty('Count')
        //     && responseScanJourneyParticipantRelationTable.hasOwnProperty('Items')
        //     && responseScanJourneyParticipantRelationTable.Count > 0) {
        //
        //     let journeyLinks = responseScanJourneyParticipantRelationTable.Items;
        //
        // }


        // delete journey from JourneyParticipantRelationTable
        const ExpressionAttributeValues = "ID";
        let journeyLinks = await getJourneyParticipantsLinks(event, tenantID, journeyID, null, null, ExpressionAttributeValues);

        for (let journeyLink of journeyLinks) {

            let paramsDeleteJourneyLinks = {
                TableName: JourneyParticipantRelationTableName,
                Key: {
                    ID: journeyLink.ID,
                },
            }

            await dynamoDB.delete(paramsDeleteJourneyLinks).promise();

        }

        // delete journey assignments
        const ExpressionAttributeValuesAssignment = "ID";
        const journeyExistingAssignments = await getJourneyAssignments(journeyID, ExpressionAttributeValuesAssignment);

        for (let assignment of journeyExistingAssignments) {

            let paramsDeleteJourneyAssignment = {
                TableName: AssignmentTableName,
                Key: {
                    ID: assignment.ID,
                },
            }

            await dynamoDB.delete(paramsDeleteJourneyAssignment).promise();

        }


        // let paramsScanJourneyReusableTemplatesTable = {
        //     TableName: JourneyReusableTemplatesTableName,
        //     FilterExpression: `#JourneyID = :JourneyID  and #TenantID = :TenantID`,
        //     ExpressionAttributeNames: {
        //         '#JourneyID': 'JourneyID',
        //         '#TenantID': 'TenantID',
        //     },
        //     ExpressionAttributeValues: {
        //         ':JourneyID': journeyID,
        //         ':TenantID': tenantID,
        //     },
        //     ProjectionExpression:
        //         "ID",
        // }
        //
        // const responseScanJourneyReusableTemplatesTable = await dynamoDB.scan(paramsScanJourneyReusableTemplatesTable).promise();
        //
        // if (responseScanJourneyReusableTemplatesTable.hasOwnProperty('Count')
        //     && responseScanJourneyReusableTemplatesTable.hasOwnProperty('Items')
        //     && responseScanJourneyReusableTemplatesTable.Count > 0) {
        //
        //     let journeyTemplates = responseScanJourneyReusableTemplatesTable.Items;
        //
        //
        // }


        // delete journeyID from JourneyReusableTemplatesTable
        let journeyTemplates = await getJourneyReusableTemplates(event, tenantID, journeyID, null ,ExpressionAttributeValues);

        for (let journeyTemplate of journeyTemplates) {

            let paramsUpdateReusableTemplatesTable = {
                TableName: JourneyReusableTemplatesTableName,
                Key: {
                    ID: journeyTemplate.ID,
                },
                UpdateExpression: 'SET #JourneyID = :JourneyID',
                ExpressionAttributeNames: {
                    '#JourneyID': 'JourneyID',
                },
                ExpressionAttributeValues: {
                    ':JourneyID': '',
                },
                ReturnValues: 'NONE',
            };

            await dynamoDB.update(paramsUpdateReusableTemplatesTable).promise();

        }

        return Responses._200({
            message: 'Journey deleted successfully'
        })

    }
    catch (error) {
        return Responses._500({message: error.message});
    }

}

/// end DELETE Methods

// HELPERS
const getTenantJourneys = async (tenantID) => {
    try {
        let paramsGetTenantJourneys = {
            TableName: JourneyTableName,
            FilterExpression: `#TenantID = :TenantID`,
            ExpressionAttributeNames: {
                '#TenantID': 'TenantID', // The column name to filter by
            },
            ExpressionAttributeValues: {
                ':TenantID': tenantID, // The value to filter for
            },
        };

        let tenantJourneys = [];
        let lastEvaluatedKey = null;

        do {
            const response = await dynamoDB.scan({
                ...paramsGetTenantJourneys,
                ExclusiveStartKey: lastEvaluatedKey,
            }).promise();

            tenantJourneys = tenantJourneys.concat(response.Items);

            lastEvaluatedKey = response.LastEvaluatedKey;
        } while (lastEvaluatedKey); // Keep scanning until no more data

        return tenantJourneys;

    }
    catch (error) {
        throw new Error(error);
    }
};

const getTenantAssignments = async (event, tenantID) => {
    try {
        let paramsGetTenantAssignments = {
            TableName: AssignmentTableName,
            FilterExpression: `#TenantID = :TenantID`,
            ExpressionAttributeNames: {
                '#TenantID': 'TenantID', // The column name to filter by
            },
            ExpressionAttributeValues: {
                ':TenantID': tenantID, // The value to filter for
            },
        };

        let tenantAssignments = [];
        let lastEvaluatedKey = null;

        do {
            const response = await dynamoDB.scan({
                ...paramsGetTenantAssignments,
                ExclusiveStartKey: lastEvaluatedKey,
            }).promise();

            tenantAssignments = tenantAssignments.concat(response.Items);

            lastEvaluatedKey = response.LastEvaluatedKey;
        } while (lastEvaluatedKey); // Keep scanning until no more data
    }
    catch (error) {
        throw new Error(error);
    }
};

const getJourneyAssignments = async (journeyID, ProjectionExpression = null) => {
    try {
        let paramsGetJourneyAssignments = {
            TableName: AssignmentTableName,
            FilterExpression: `#JourneyID = :JourneyID`,
            ExpressionAttributeNames: {
                '#JourneyID': 'JourneyID', // The column name to filter by
            },
            ExpressionAttributeValues: {
                ':JourneyID': journeyID, // The value to filter for
            },
        };

        if (ProjectionExpression !== null) {
            paramsGetJourneyAssignments.ProjectionExpression = ProjectionExpression;
        }

        let journeyAssignments = [];
        let lastEvaluatedKey = null;

        do {
            const response = await dynamoDB.scan({
                ...paramsGetJourneyAssignments,
                ExclusiveStartKey: lastEvaluatedKey,
            }).promise();

            journeyAssignments = journeyAssignments.concat(response.Items);

            lastEvaluatedKey = response.LastEvaluatedKey;
        } while (lastEvaluatedKey); // Keep scanning until no more data

        return journeyAssignments;

    }
    catch (error) {
        throw new Error(error);
    }
};

const getJourneyParticipantsLinks = async (event, tenantID, journeyID = null, participantID = null, authorID = null, ProjectionExpression = null) => {

    try {
        let paramsScanJourneyParticipantRelationTable = {
            TableName: JourneyParticipantRelationTableName,
            FilterExpression: `#TenantID = :TenantID`,
            ExpressionAttributeNames: {
                '#TenantID': 'TenantID',
            },
            ExpressionAttributeValues: {
                ':TenantID': tenantID,
            },
        }

        if (journeyID !== null) {
            paramsScanJourneyParticipantRelationTable.FilterExpression = `${paramsScanJourneyParticipantRelationTable.FilterExpression} AND #JourneyID = :JourneyID`;
            paramsScanJourneyParticipantRelationTable.ExpressionAttributeNames['#JourneyID'] = 'JourneyID';
            paramsScanJourneyParticipantRelationTable.ExpressionAttributeValues[':JourneyID'] = journeyID;
        }

        if (participantID !== null) {
            paramsScanJourneyParticipantRelationTable.FilterExpression = `${paramsScanJourneyParticipantRelationTable.FilterExpression} AND #ParticipantID = :ParticipantID`;
            paramsScanJourneyParticipantRelationTable.ExpressionAttributeNames['#ParticipantID'] = 'ParticipantID';
            paramsScanJourneyParticipantRelationTable.ExpressionAttributeValues[':ParticipantID'] = participantID;
        }

        if (authorID !== null) {
            paramsScanJourneyParticipantRelationTable.FilterExpression = `${paramsScanJourneyParticipantRelationTable.FilterExpression} AND #AuthorID = :AuthorID`;
            paramsScanJourneyParticipantRelationTable.ExpressionAttributeNames['#AuthorID'] = 'AuthorID';
            paramsScanJourneyParticipantRelationTable.ExpressionAttributeValues[':AuthorID'] = authorID;
        }

        if (ProjectionExpression !== null) {
            paramsScanJourneyParticipantRelationTable.ProjectionExpression = ProjectionExpression;
        }

        let userJourneyLinks = [];
        let lastEvaluatedKey = null;

        do {
            const response = await dynamoDB.scan({
                ...paramsScanJourneyParticipantRelationTable,
                ExclusiveStartKey: lastEvaluatedKey,
            }).promise();

            userJourneyLinks = userJourneyLinks.concat(response.Items);

            lastEvaluatedKey = response.LastEvaluatedKey;
        } while (lastEvaluatedKey); // Keep scanning until no more data

        return userJourneyLinks;

    }
    catch (error) {
        throw new Error(error);
    }

};

const getJourneyReusableTemplates = async (event, tenantID, journeyID = null, reusable = null, ProjectionExpression = null) => {

    try {
        let paramsScanJourneyReusableTemplatesTable = {
            TableName: JourneyReusableTemplatesTableName,
            FilterExpression: '#TenantID = :TenantID',
            ExpressionAttributeNames: {
                '#TenantID': 'TenantID',
            },
            ExpressionAttributeValues: {
                ':TenantID': tenantID,
            },
        }

        if (journeyID !== null) {
            paramsScanJourneyReusableTemplatesTable.FilterExpression = `${paramsScanJourneyReusableTemplatesTable.FilterExpression} AND #JourneyID = :JourneyID`;
            paramsScanJourneyReusableTemplatesTable.ExpressionAttributeNames['#JourneyID'] = 'JourneyID';
            paramsScanJourneyReusableTemplatesTable.ExpressionAttributeValues[':JourneyID'] = journeyID;
        }

        if (reusable !== null) {
            paramsScanJourneyReusableTemplatesTable.FilterExpression = `${paramsScanJourneyReusableTemplatesTable.FilterExpression} AND #Reusable = :Reusable`;
            paramsScanJourneyReusableTemplatesTable.ExpressionAttributeNames['#Reusable'] = 'Reusable';
            paramsScanJourneyReusableTemplatesTable.ExpressionAttributeValues[':Reusable'] = reusable;
        }


        if (ProjectionExpression !== null) {
            paramsScanJourneyReusableTemplatesTable.ProjectionExpression = ProjectionExpression;
        }

        let journeyReusableTemplates = [];
        let lastEvaluatedKey = null;

        do {
            const response = await dynamoDB.scan({
                ...paramsScanJourneyReusableTemplatesTable,
                ExclusiveStartKey: lastEvaluatedKey,
            }).promise();

            // throw new Error('Failed');

            journeyReusableTemplates = journeyReusableTemplates.concat(response.Items);

            lastEvaluatedKey = response.LastEvaluatedKey;
        } while (lastEvaluatedKey); // Keep scanning until no more data

        return journeyReusableTemplates;

    }
    catch (error) {
        throw new Error(error);
    }

};

const getJourneysCategories = async (event, tenantID, ProjectionExpression = null) => {

    try {
        let paramsScanJJourneysCategories = {
            TableName: JourneyCategoryTableName,
            FilterExpression: `#TenantID = :TenantID`,
            ExpressionAttributeNames: {
                '#TenantID': 'TenantID', // The column name to filter by
            },
            ExpressionAttributeValues: {
                ':TenantID': tenantID, // The value to filter for
            },
        };

        if (ProjectionExpression !== null) {
            paramsScanJJourneysCategories.ProjectionExpression = ProjectionExpression;
        }

        let journeysCategories = [];
        let lastEvaluatedKey = null;

        do {
            const response = await dynamoDB.scan({
                ...paramsScanJJourneysCategories,
                ExclusiveStartKey: lastEvaluatedKey,
            }).promise();

            // throw new Error('Failed');

            journeysCategories = journeysCategories.concat(response.Items);

            lastEvaluatedKey = response.LastEvaluatedKey;
        } while (lastEvaluatedKey); // Keep scanning until no more data

        return journeysCategories;

    }
    catch (error) {
        throw new Error(error);
    }

};

const getTreasureChests = async (event, tenantID, ProjectionExpression = null) => {

    try {
        let paramsScanTreasureChest = {
            TableName: TreasureChestTableName,
            FilterExpression: `#TenantID = :TenantID`,
            ExpressionAttributeNames: {
                '#TenantID': 'TenantID', // The column name to filter by
            },
            ExpressionAttributeValues: {
                ':TenantID': tenantID, // The value to filter for
            },
        };

        if (ProjectionExpression !== null) {
            paramsScanTreasureChest.ProjectionExpression = ProjectionExpression;
        }

        let treasureChests = [];
        let lastEvaluatedKey = null;

        do {
            const response = await dynamoDB.scan({
                ...paramsScanTreasureChest,
                ExclusiveStartKey: lastEvaluatedKey,
            }).promise();

            // throw new Error('Failed');

            treasureChests = treasureChests.concat(response.Items);

            lastEvaluatedKey = response.LastEvaluatedKey;
        } while (lastEvaluatedKey); // Keep scanning until no more data

        return treasureChests;

    }
    catch (error) {
        throw new Error(error);
    }

};

const buildParticipantAssignment = (assignment) => {

    let participantAssignmentObject = {
        ID: assignment.ID,
        ParticipantScorePercentage: 0,
        Quizzes: [],
        IsSubmitted: false,
    }

    assignment.Quizzes.forEach((quiz) => {

        let participantQuizObject = {
            ID: quiz.ID,
            Type: quiz.Type,
        };

        switch (quiz.Type) {

            case 'Checklist': {
                participantQuizObject.Tasks = [];
                quiz.Content.Tasks.forEach((task) => {
                    let taskObject = {
                        ID: task.ID,
                        IsDone: false,
                    }
                    participantQuizObject.Tasks.push(taskObject);
                });
                break;
            }

            case 'Multiple Choice': {
                participantQuizObject.Items = [];
                quiz.Content.Items.forEach((item) => {
                    let itemObject = {
                        ID: item.ID,
                        Options: [],
                    }
                    item.Options.forEach((option) => {
                        itemObject.Options.push({
                            ID: option.ID,
                            ParticipantAnswer: false,
                        })
                    })
                    participantQuizObject.Items.push(itemObject);
                });
                break;
            }

            case 'True/False': {
                participantQuizObject.Items = [];
                quiz.Content.Items.forEach((item) => {
                    let itemObject = {
                        ID: item.ID,
                        ParticipantAnswer: null,
                    }
                    participantQuizObject.Items.push(itemObject);
                });
                break;
            }

            case 'Item Match': {

                participantQuizObject.LeftItems = [];
                participantQuizObject.RightItems = [];

                quiz.Content.LeftItems.forEach((item) => {
                    let itemObject = {
                        ID: item.ID,
                        ParticipantMatchesIDs: [],
                    }
                    participantQuizObject.LeftItems.push(itemObject);
                });
                quiz.Content.RightItems.forEach((item) => {
                    let itemObject = {
                        ID: item.ID,
                        ParticipantMatchesIDs: [],
                    }
                    participantQuizObject.RightItems.push(itemObject);
                });
                break;
            }

            case 'Questions With Written Answers': {
                participantQuizObject.Items = [];
                quiz.Content.Items.forEach((item) => {
                    let itemObject = {
                        ID: item.ID,
                        ParticipantAnswer: null,
                    }
                    participantQuizObject.Items.push(itemObject);
                });
                break;
            }

            case 'Evaluation': {
                participantQuizObject.Items = [];
                quiz.Content.Items.forEach((item) => {
                    let itemObject = {
                        ID: item.ID,
                        ParticipantRating: null,
                    }
                    participantQuizObject.Items.push(itemObject);
                });
                break;
            }

            default: {

                break;
            }

        }

        participantAssignmentObject.Quizzes.push(participantQuizObject);

    });

    return participantAssignmentObject;

};

const buildParticipantProgress = (journeyStructure, journeyExistingAssignments, oldParticipantProgress = null) => {

    let participantProgress = [];
    let lockRemainingStructureItems = false;

    for (let structureItem of journeyStructure) {

        // chapter
        if (structureItem.Type === 'Chapter') {

            let progressObject = {
                StructureItemID: structureItem.ID,
                Type: 'Chapter',
                IsLocked: lockRemainingStructureItems,
                Completed: false,
            };

            if (oldParticipantProgress !== null) {
                let oldStructureItemProgress = oldParticipantProgress.find((oldProgress) => oldProgress.StructureItemID === structureItem.ID);

                if (oldStructureItemProgress !== undefined) {
                    if (!lockRemainingStructureItems) {
                        progressObject.Completed = oldStructureItemProgress.Completed;

                    }
                }
            }

            participantProgress.push(progressObject);
        }

        if (structureItem.Type === 'Event') {

            // assignment
            if (structureItem.hasOwnProperty('Assignment')
                && structureItem.Assignment.hasOwnProperty('ID')
                && structureItem.Assignment.ID !== null) {

                let progressObject = {
                    StructureItemID: structureItem.ID,
                    Type: 'Assignment',
                    IsLocked: lockRemainingStructureItems,
                    Completed: false,
                    Assignment: {},
                };

                let assignment = journeyExistingAssignments.find((assignment) => assignment.ID === structureItem.Assignment.ID);

                if (assignment !== undefined) {

                    if (assignment.Quizzes.length > 0) {

                        if (assignment.IsReady) {
                            // prepare participant assignment
                            progressObject.Assignment = buildParticipantAssignment(assignment);

                            if (oldParticipantProgress !== null) {
                                let oldStructureItemProgress = oldParticipantProgress.find((oldProgress) => oldProgress.StructureItemID === structureItem.ID);

                                if (oldStructureItemProgress !== undefined) {
                                    if (!lockRemainingStructureItems) {
                                        progressObject.Completed = oldStructureItemProgress.Completed;
                                    }
                                    progressObject.Assignment = oldStructureItemProgress.Assignment;
                                }
                            }

                            if (assignment.Unlock.IsUnlock && progressObject.Assignment.ParticipantScorePercentage < assignment.Unlock.MinPercentage) {
                                lockRemainingStructureItems = true;
                            }

                            participantProgress.push(progressObject);

                        }

                    }
                }

            }
            // normal event
            else {
                let progressObject = {
                    StructureItemID: structureItem.ID,
                    Type: 'Event',
                    IsLocked: lockRemainingStructureItems,
                    Completed: false,
                };

                if (oldParticipantProgress !== null) {
                    let oldStructureItemProgress = oldParticipantProgress.find((oldProgress) => oldProgress.StructureItemID === structureItem.ID);

                    if (oldStructureItemProgress !== undefined) {
                        if (!lockRemainingStructureItems) {
                            progressObject.Completed = oldStructureItemProgress.Completed;
                        }
                    }
                }

                let currentTime = new Date();

                if (currentTime < new Date(structureItem.Periods.Unlock)) {
                    lockRemainingStructureItems = true;
                }

                participantProgress.push(progressObject);
            }

        }

    }

    return participantProgress;

}