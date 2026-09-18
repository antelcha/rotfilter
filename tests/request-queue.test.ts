import { expect, it } from "vitest";
import { RequestQueue } from "../src/background/request-queue";

it("completes a single task when there are fewer tasks than concurrency slots", async () => {
  const queue = new RequestQueue(3);
  expect(await queue.add(async () => 42)).toBe(42);
  expect(await queue.add(async () => 43)).toBe(43);
});

it("drains queued tasks without exceeding concurrency", async () => {
  const queue = new RequestQueue(3);
  let active = 0;
  let peak = 0;
  const results = await Promise.all(Array.from({ length: 10 }, (_, index) => queue.add(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return index;
  })));
  expect(peak).toBe(3);
  expect(results).toEqual(Array.from({ length: 10 }, (_, index) => index));
});
