import { test } from "node:test";
import assert from "node:assert/strict";
import { meteredDistance } from "./metered-distance";
test("meter miles use positive completed-job metres and disclose missing coverage", () => {
 assert.deepEqual(meteredDistance([{status:"COMPLETED",meterDistanceMetres:1609},{status:"COMPLETED",meterDistanceMetres:0},{status:"COMPLETED",meterDistanceMetres:null},{status:"CANCELLED",meterDistanceMetres:9000}]), {miles:1,measuredJobs:1,completedJobs:3,zeroOrMissingJobs:2});
 assert.deepEqual(meteredDistance([{status:"COMPLETED",meterDistanceMetres:0}]), {miles:null,measuredJobs:0,completedJobs:1,zeroOrMissingJobs:1});
});
