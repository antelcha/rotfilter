// @vitest-environment jsdom
import { describe,expect,it } from "vitest"; import { extractPost } from "../../src/platforms/x/extractor";
describe("X extraction",()=>{it("uses the status id and extracts text",async()=>{document.body.innerHTML='<article data-testid="tweet"><div data-testid="User-Name">Ada\n@ada</div><div data-testid="tweetText">A specific useful fact.</div><a href="/ada/status/123"></a></article>';const value=await extractPost(document.querySelector("article")!);expect(value).toMatchObject({id:"123",text:"A specific useful fact.",authorUsername:"ada"})})});
