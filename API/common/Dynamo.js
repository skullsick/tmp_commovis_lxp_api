const AWS = require('aws-sdk');

const dynamoDB = new AWS.DynamoDB.DocumentClient();

const Dynamo = {

    async get(ID, TableName) {
        const params = {
            TableName,
            Key: {
                ID,
            },
        };

        const data = await dynamoDB.get(params).promise();

        if (!data || !data.Item) {
            throw Error(`There was an error fetching the data for ID of ${ID} from ${TableName}`);
        }

        return data.Item;
    },

    async write(data, TableName) {
        if (!data.ID) {
            throw Error('No ID on the data');
        }

        const params = {
            TableName,
            Item: data,
        };

        const res = await dynamoDB.put(params).promise();

        if (!res) {
            throw Error(`There was an error inserting ID of ${data.ID} in table ${TableName}`);
        }

        return data;
    },

    typeConvertorJavascriptToDynamoDB(data) {
        return AWS.DynamoDB.Converter.input(data, true);
    },

    typeConvertorDynamoDBToJavascript(data) {
        return AWS.DynamoDB.Converter.output(data, true)
    }

};
module.exports = Dynamo;