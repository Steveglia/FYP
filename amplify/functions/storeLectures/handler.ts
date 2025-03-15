import type { S3Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../data/resource';
import { Amplify } from 'aws-amplify';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/store_lectures';

const s3Client = new S3Client();

// Helper to configure Amplify using the Gen 2 runtime helper
async function configureAmplifyForFunction(): Promise<void> {
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
}

interface LectureData {
  lectures: Array<{
    id?: string;
    __typename?: string;
    courseId: string;
    lectureId: string;
    title: string;
    content?: string | null;
    summary?: string | null;
    difficulty?: string;
    duration?: string;
    start_date: string;
    end_date: string;
    location?: string;
    type?: string;
    createdAt?: string;
    updatedAt?: string;
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
      let lectureData: LectureData;
      
      try {
        // Try to parse as an array of lectures directly
        const parsedData = JSON.parse(bodyContents);
        
        // Check if it's an array
        if (Array.isArray(parsedData)) {
          lectureData = { lectures: parsedData };
        } 
        // Check if it has a lectures property that is an array
        else if (parsedData.lectures && Array.isArray(parsedData.lectures)) {
          lectureData = parsedData as LectureData;
        } 
        // If it's a single lecture object, wrap it in an array
        else if (parsedData.courseId && parsedData.lectureId) {
          lectureData = { lectures: [parsedData] };
        }
        else {
          throw new Error('Invalid JSON format: Expected an array of lectures or an object with a lectures array');
        }
      } catch (error) {
        console.error('Error parsing JSON:', error);
        throw error;
      }

      // Process each lecture using the Amplify Data client
      for (const lecture of lectureData.lectures) {
        try {
          // Create the lecture object with required fields
          const lectureInput = {
            courseId: lecture.courseId,
            lectureId: lecture.lectureId,
            title: lecture.title,
            content: lecture.content || null,
            summary: lecture.summary || null,
            difficulty: lecture.difficulty || 'Medium',
            duration: lecture.duration || '60 minutes',
            start_date: lecture.start_date,
            end_date: lecture.end_date,
            location: lecture.location || 'Online',
            type: lecture.type || 'LECTURE'
          };

          const { errors, data: newLecture } = await client.models.Lectures.create(lectureInput);

          if (errors) {
            console.error('Error creating lecture:', errors);
            continue;
          }

          console.log(`Successfully created lecture: ${lecture.courseId} - ${lecture.title}`);
        } catch (lectureError) {
          console.error(`Error processing lecture ${lecture.lectureId}:`, lectureError);
        }
      }

      console.log(`Successfully processed ${lectureData.lectures.length} lectures from ${key}`);
    }
  } catch (error) {
    console.error('Error processing lectures:', error);
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