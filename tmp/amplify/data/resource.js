"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
const backend_1 = require("@aws-amplify/backend");
const resource_1 = require("../functions/storeEvents/resource");
const resource_2 = require("../functions/storeLectures/resource");
const resource_3 = require("../functions/generatePreferenceVector/resource");
const resource_4 = require("../functions/generateStudySessions/resource");
const schema = backend_1.a
    .schema({
    generatePreferenceVector: backend_1.a
        .query()
        .arguments({
        availabilityVector: backend_1.a.string(),
        userId: backend_1.a.string(),
    })
        .returns(backend_1.a.string())
        .handler(backend_1.a.handler.function(resource_3.generatePreferenceVector))
        .authorization(allow => [allow.publicApiKey()]),
    generateStudySessions: backend_1.a
        .query()
        .arguments({
        preferenceVector: backend_1.a.string(),
        userId: backend_1.a.string(),
    })
        .returns(backend_1.a.string())
        .handler(backend_1.a.handler.function(resource_4.generateStudySessions))
        .authorization(allow => [allow.publicApiKey()]),
    CalendarEvent: backend_1.a
        .model({
        title: backend_1.a.string(),
        description: backend_1.a.string(),
        startDate: backend_1.a.string(),
        endDate: backend_1.a.string(),
        location: backend_1.a.string(),
        type: backend_1.a.enum(['WORK', 'STUDY', 'MEETING', 'OTHER']),
    })
        .authorization(allow => [allow.publicApiKey()]),
    Lectures: backend_1.a
        .model({
        courseId: backend_1.a.string(),
        lectureId: backend_1.a.string(),
        title: backend_1.a.string(),
        content: backend_1.a.string(),
        summary: backend_1.a.string(),
        difficulty: backend_1.a.string(),
        duration: backend_1.a.string(),
        start_date: backend_1.a.string(),
        end_date: backend_1.a.string(),
        location: backend_1.a.string(),
        type: backend_1.a.string(),
    })
        .authorization(allow => [allow.publicApiKey()]),
    StudyPreference: backend_1.a
        .model({
        studyTime: backend_1.a.string(),
        maxHoursPerDay: backend_1.a.integer(),
        lunchBreakStart: backend_1.a.string(),
        lunchBreakDuration: backend_1.a.integer(),
        studyDuringWork: backend_1.a.boolean(),
        preferredTimeOfDay: backend_1.a.enum(['MORNING', 'EVENING']),
        owner: backend_1.a.string(),
        courses: backend_1.a.string().array()
    })
        .authorization(allow => [allow.publicApiKey()]),
    AcceptedStudySession: backend_1.a
        .model({
        day: backend_1.a.string(),
        startTime: backend_1.a.string(),
        endTime: backend_1.a.string(),
        course: backend_1.a.string(),
        startDate: backend_1.a.string(),
        endDate: backend_1.a.string(),
        userId: backend_1.a.string(),
        weekStartDate: backend_1.a.string(),
        title: backend_1.a.string(),
        description: backend_1.a.string(),
        type: backend_1.a.enum(['STUDY']),
    })
        .authorization(allow => [allow.publicApiKey()]),
    UserProgress: backend_1.a
        .model({
        userId: backend_1.a.string().required(),
        courseId: backend_1.a.string().required(),
        lectureId: backend_1.a.string().required(),
        completedLectures: backend_1.a.string().array(),
        quizScores: backend_1.a.integer(),
        lastAccessed: backend_1.a.string().required(),
    })
        .authorization(allow => [allow.publicApiKey()]),
    ScheduledReviews: backend_1.a
        .model({
        userId: backend_1.a.string().required(),
        courseId: backend_1.a.string().required(),
        lectureId: backend_1.a.string().required(),
        reviewDate: backend_1.a.string().required(),
        halfLife: backend_1.a.float().required(),
        lastScore: backend_1.a.integer().required(),
        lastReviewDate: backend_1.a.string().required(),
        studyCount: backend_1.a.integer()
    })
        .authorization(allow => [allow.publicApiKey()]),
})
    .authorization(allow => [
    allow.resource(resource_1.store_events),
    allow.resource(resource_2.store_lectures),
]);
exports.data = (0, backend_1.defineData)({
    schema,
    authorizationModes: {
        defaultAuthorizationMode: 'apiKey',
    },
});
