import { defineFunction } from "@aws-amplify/backend";

export const branchAndBound = defineFunction({
  timeoutSeconds: 60 // Extended timeout to ensure algorithm has enough time to run
}); 