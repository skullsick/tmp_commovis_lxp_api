const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { NodeHttpHandler } = require('@smithy/node-http-handler');

// Configure Bedrock Runtime Client
const bedrockClient = new BedrockRuntimeClient({
    region: process.env.AWS_BEDROCK_REGION,
    requestHandler: new NodeHttpHandler({
        connectionTimeout: 30000, // Optional: Adjust timeout as needed
        socketTimeout: 30000, // Optional: Adjust timeout as needed
        maxSockets: 200, // Increase the maximum number of sockets
    }),
});

// Helper function to traverse and extract translatable nodes
const extractTranslatableNodes = (dynamoJson) => {
    const nodes = [];
    const traverse = (node, path = []) => {
        if (node && typeof node === 'object') {
            for (const key in node) {
                const value = node[key];
                const currentPath = [...path, key];
                // Handle DynamoDB's nested structure for "text.S", "caption.S", "content.S", and "name.S"
                //if ((key === 'text' || key === 'caption' || key === 'content' || key === 'Name') && value.S) {
                if ((key === 'text' || key === 'caption' || key === 'content' || key === 'Name' || key === 'name') && value.S) {
                    if (typeof value.S === 'string' && value.S.length > 0) {
                        nodes.push({ path: [...path, key, 'S'], text: value.S });
                    }
                } else if (typeof value === 'object') {
                    traverse(value, currentPath);
                }
            }
        }
    };

    traverse(dynamoJson);
    return nodes;
};


// Helper function to update translated content
const updateTranslatedContent = (dynamoJson, nodes, translations) => {
    const deepClone = (obj) => JSON.parse(JSON.stringify(obj)); // Create a deep clone of the original JSON
    const updatedJson = deepClone(dynamoJson); // Ensure the structure is not modified

    nodes.forEach((node, index) => {
        const translatedText = translations[index];
        let current = updatedJson;

        // Traverse to the second last key in the path
        for (let i = 0; i < node.path.length - 1; i++) {
            current = current[node.path[i]];
        }

        // Update the "S" value with the translated text
        const lastKey = node.path[node.path.length - 1];
        current[lastKey] = translatedText; // Always replace with the correct DynamoDB format
    });

    return updatedJson;
};

// Chunk text if it exceeds a certain length
const chunkText = (text, maxLength = 100000 ) => {
    const chunks = [];
    for (let i = 0; i < text.length; i += maxLength) {
        chunks.push(text.slice(i, i + maxLength));
    }
    return chunks;
};

// Translate a single chunk
const translateChunk = async (chunk, targetLang) => {

    const input = {
        modelId: 'amazon.nova-micro-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            system: [
                {
                    text: `Act as a Professional Translator. 
                    Exclude the following words from translations: 'explore', 'master', 'deliver'. 
                    Retain the original structure and meaning. In German, always use the informal 'du' form.`,
                },
            ],
            messages: [
                {
                    role: 'user',
                    content: [{ text: `Task: Translate the following TEXT to ${targetLang}.

                                Response format requirements: You MUST answer as a STRING format only in the target language. Maintain the same formatting (space, dash or html tags) and structure as the original text without adding additional text, context, or explanations.
                                
                                TEXT: ${chunk}` }],
                },
            ],
            inferenceConfig: {
                max_new_tokens: 2500,
                temperature: 0.3,
                top_p: 0.9,
                top_k: 20,
            },
        }),
    };

    const command = new InvokeModelCommand(input);
    const response = await bedrockClient.send(command);
    const responseBody = new TextDecoder().decode(response.body);


    // NO validation but return the translated text directly

    //return JSON.parse(responseBody).output.message?.content[0]?.text;
    // Extract translation
    let translation = JSON.parse(responseBody).output.message?.content[0]?.text;

    // Clean translation
    translation = translation.replace(/\n\n/g, '').replace(/&nbsp;/g, ' ').trim();

    return translation;
};

// Translate entire JSON
const translateJson = async (json, targetLang) => {

    const nodes = extractTranslatableNodes(json);
    
    // Chunk large text and create translation tasks
    const tasks = nodes.flatMap((node) => {
        const chunks = chunkText(node.text);
        return chunks.map((chunk) => translateChunk(chunk, targetLang));
    });

    const translations = await Promise.all(tasks);
    
    const updatedJson = updateTranslatedContent(json, nodes, translations);
    return updatedJson;
};

module.exports = { translateJson };