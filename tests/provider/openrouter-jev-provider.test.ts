import { readFileSync } from "node:fs"; import { describe,expect,it } from "vitest"; import { parseJevResponse } from "../../src/providers/openrouter-jev-provider";
const fixture=JSON.parse(readFileSync(new URL("../fixtures/jev-success.json",import.meta.url),"utf8"));
describe("Jev response adapter",()=>{
  it("maps the recorded live response",()=>expect(parseJevResponse(fixture,{hasShow:true,hasDontShow:true})).toEqual({model:"typesafe/jev-1.13-20260917",decision:"keep"}));
  it("hides on a dont-show match even when show matches",()=>expect(parseJevResponse({answers:{matches_show:{type:"noul",noul:.9},matches_dont_show:{type:"noul",noul:.8}}},{hasShow:true,hasDontShow:true}).decision).toBe("filter"));
  it("hides when a show list exists but nothing matches",()=>expect(parseJevResponse({answers:{matches_show:{type:"noul",noul:.2}}},{hasShow:true,hasDontShow:false}).decision).toBe("filter"));
  it("keeps when only a dont-show list exists and it does not match",()=>expect(parseJevResponse({answers:{matches_dont_show:{type:"noul",noul:.1}}},{hasShow:false,hasDontShow:true}).decision).toBe("keep"));
  it("rejects malformed probabilities",()=>expect(()=>parseJevResponse({answers:{}},{hasShow:true,hasDontShow:true})).toThrow(/matches_dont_show/));
});
