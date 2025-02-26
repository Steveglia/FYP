import type { S3Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const s3Client = new S3Client();
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME;

interface EventData {
  events: Array<{
    id: string;
    title: string;
    description: string;
    start_date: string;
    end_date: string;
    location: string;
  }>;
}

export const handler: S3Handler = async (event) => {
    try {
        const bucketName = event.Records[0].s3.bucket.name;
        const objectKeys = event.Records.map((record) => record.s3.object.key);

        for (const key of objectKeys) {
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: bucketName,
                Key: key
            }));

            if (!response.Body) {
                throw new Error('No data received from S3');
            }

            const bodyContents = await streamToString(response.Body);
            const { events } = JSON.parse(bodyContents) as EventData;

            // Process each event in the array
            for (const eventItem of events) {
                const putCommand = new PutCommand({
                    TableName: EVENTS_TABLE_NAME,
                    Item: {
                        id: eventItem.id,
                        title: eventItem.title,
                        description: eventItem.description,
                        startDate: eventItem.start_date,
                        endDate: eventItem.end_date,
                        location: eventItem.location,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                });
                await ddbClient.send(putCommand);
            }

            console.log(`Successfully processed ${events.length} events from ${key}`);
        }
    } catch (error) {
        console.error('Error processing events:', error);
        throw error;
    }
};

async function streamToString(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk: any) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
}
