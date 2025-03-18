export const createScheduledReviews = /* GraphQL */ `
  mutation CreateScheduledReviews(
    $input: CreateScheduledReviewsInput!
  ) {
    createScheduledReviews(input: $input) {
      id
      userId
      courseId
      lectureId
      reviewDate
      halfLife
      lastScore
      lastReviewDate
      studyCount
      createdAt
      updatedAt
    }
  }
`;

export const updateScheduledReviews = /* GraphQL */ `
  mutation UpdateScheduledReviews(
    $input: UpdateScheduledReviewsInput!
  ) {
    updateScheduledReviews(input: $input) {
      id
      userId
      courseId
      lectureId
      reviewDate
      halfLife
      lastScore
      lastReviewDate
      studyCount
      createdAt
      updatedAt
    }
  }
`;

export const deleteScheduledReviews = /* GraphQL */ `
  mutation DeleteScheduledReviews(
    $input: DeleteScheduledReviewsInput!
  ) {
    deleteScheduledReviews(input: $input) {
      id
      userId
      courseId
      lectureId
      reviewDate
      halfLife
      lastScore
      lastReviewDate
      studyCount
      createdAt
      updatedAt
    }
  }
`;

export const getScheduledReviews = /* GraphQL */ `
  query GetScheduledReviews($id: ID!) {
    getScheduledReviews(id: $id) {
      id
      userId
      courseId
      lectureId
      reviewDate
      halfLife
      lastScore
      lastReviewDate
      studyCount
      createdAt
      updatedAt
    }
  }
`;

export const listScheduledReviewsByUser = /* GraphQL */ `
  query ListScheduledReviewsByUser(
    $userId: String!
    $filter: ModelScheduledReviewsFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listScheduledReviews(
      filter: {
        userId: { eq: $userId }
      }
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        userId
        courseId
        lectureId
        reviewDate
        halfLife
        lastScore
        lastReviewDate
        studyCount
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

export const listScheduledReviewsByCourse = /* GraphQL */ `
  query ListScheduledReviewsByCourse(
    $userId: String!
    $courseId: String!
    $limit: Int
    $nextToken: String
  ) {
    listScheduledReviews(
      filter: {
        userId: { eq: $userId }
        courseId: { eq: $courseId }
      }
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        userId
        courseId
        lectureId
        reviewDate
        halfLife
        lastScore
        lastReviewDate
        studyCount
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`; 