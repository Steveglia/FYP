# Store Lectures Function

This AWS Lambda function is triggered when a JSON file is uploaded to the "Lectures_Data" S3 bucket. It processes the file and stores the lecture data in the Amplify Lectures database.

## How it works

1. When a JSON file is uploaded to the "lectures/" folder in the Lectures_Data S3 bucket, this function is triggered
2. The function reads the JSON file from S3
3. It parses the lecture data from the JSON file
4. Each lecture is then stored in the Amplify Lectures database

## JSON Format

The JSON file can be structured in one of three ways:

### 1. An array of lecture objects:

```json
[
  {
    "id": "6a014b71-818c-42d2-be49-349de53f9dbf",
    "__typename": "Lecture",
    "content": "This lecture covers advanced project management techniques...",
    "courseId": "COMP-1821",
    "createdAt": "2025-03-13T10:12:24.226Z",
    "difficulty": "Medium",
    "duration": "30 minutes",
    "lectureId": "COMP-1821-Lecture-13",
    "summary": "Advanced project management methodologies for software development",
    "title": "Project Management 2",
    "updatedAt": "2025-03-13T10:12:24.226Z",
    "start_date": "2024-12-18T09:00:00Z",
    "end_date": "2024-12-18T10:59:00Z",
    "location": "Room 301",
    "type": "LECTURE"
  },
  {
    "id": "7b125c82-929d-53e3-cf50-450ef64a0ec8",
    "__typename": "Lecture",
    "content": "This lecture introduces the fundamentals of database design...",
    "courseId": "COMP-1822",
    "lectureId": "COMP-1822-Lecture-01",
    "title": "Database Design Fundamentals",
    "start_date": "2024-12-19T13:00:00Z",
    "end_date": "2024-12-19T14:45:00Z"
  }
]
```

### 2. An object with a "lectures" array:

```json
{
  "lectures": [
    {
      "courseId": "COMP-1821",
      "lectureId": "COMP-1821-Lecture-13",
      "title": "Project Management 2",
      "content": "This lecture covers advanced project management techniques...",
      "start_date": "2024-12-18T09:00:00Z",
      "end_date": "2024-12-18T10:59:00Z"
    }
  ]
}
```

### 3. A single lecture object:

```json
{
  "courseId": "COMP-1821",
  "lectureId": "COMP-1821-Lecture-13",
  "title": "Project Management 2",
  "content": "This lecture covers advanced project management techniques...",
  "start_date": "2024-12-18T09:00:00Z",
  "end_date": "2024-12-18T10:59:00Z"
}
```

## Required Fields

The following fields are required for each lecture:
- `courseId`: The ID of the course
- `lectureId`: The ID of the lecture
- `title`: The title of the lecture
- `start_date`: The start date and time of the lecture
- `end_date`: The end date and time of the lecture

## Optional Fields

The following fields are optional and will be set to default values if not provided:
- `content`: The content of the lecture (default: null)
- `summary`: A summary of the lecture (default: null)
- `difficulty`: The difficulty level of the lecture (default: "Medium")
- `duration`: The duration of the lecture (default: "60 minutes")
- `location`: The location of the lecture (default: "Online")
- `type`: The type of the lecture (default: "LECTURE")

## S3 Bucket Configuration

The function is configured to work with the "Lectures_Data" S3 bucket, which is defined in the Amplify storage resources. Files should be uploaded to the "lectures/" folder within this bucket to trigger the function.

## Setup

1. The S3 bucket "Lectures_Data" is automatically created when you deploy your Amplify backend
2. Upload your JSON files to the "lectures/" folder in the S3 bucket
3. The function will be triggered automatically and process the files

## Troubleshooting

Check the CloudWatch logs for any errors that might occur during processing. 