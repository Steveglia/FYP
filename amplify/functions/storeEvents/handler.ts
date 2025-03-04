import type { S3Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../data/resource';
import { Amplify } from 'aws-amplify';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/store_events';

const s3Client = new S3Client();

// Helper to configure Amplify using the Gen 2 runtime helper
async function configureAmplifyForFunction(): Promise<void> {
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
}

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
    // Configure Amplify using the runtime helper.
    await configureAmplifyForFunction();
    // Generate a typed Data client after configuration.
    const client = generateClient<Schema>();

    const bucketName = event.Records[0].s3.bucket.name;
    const objectKeys = event.Records.map((record) => record.s3.object.key);

    for (const key of objectKeys) {
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }));

      if (!response.Body) {
        throw new Error('No data received from S3');
      }

      const bodyContents = await streamToString(response.Body);
      const { events } = JSON.parse(bodyContents) as EventData;

      // Process each event using the Amplify Data client
      for (const eventItem of events) {
        const { errors, data: newEvent } = await client.models.CalendarEvent.create({
          title: eventItem.title,
          description: eventItem.description,
          startDate: eventItem.start_date,
          endDate: eventItem.end_date,
          location: eventItem.location,
        });

        if (errors) {
          console.error('Error creating event:', errors);
          continue;
        }

        console.log('Successfully created event:', newEvent);
      }

      console.log(`Successfully processed ${events.length} events from ${key}`);
    }
  } catch (error) {
    console.error('Error processing events:', error);
    throw error;
  }
};

function streamToString(stream: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on('data', (chunk: any) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
