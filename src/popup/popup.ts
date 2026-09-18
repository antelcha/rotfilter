import { getSettings } from "../storage/settings-store";
import { getStats } from "../storage/stats-store";
const enabled=document.querySelector<HTMLInputElement>("#enabled")!;
void init();
async function init(){const [s,stats]=await Promise.all([getSettings(),getStats()]);enabled.checked=s.enabled;renderStatus();text("seen",stats.seen);text("filtered",stats.filtered);if(s.authInvalid) text("notice","OpenRouter key isn't working.");else if(!s.configured) text("notice","Finish setup to start filtering.");}
enabled.addEventListener("change",()=>{renderStatus();void chrome.runtime.sendMessage({type:"SET_ENABLED",payload:{enabled:enabled.checked}})});
document.querySelector("#settings")!.addEventListener("click",()=>chrome.runtime.openOptionsPage());
function renderStatus(){text("status",enabled.checked?"ON":"OFF")} function text(id:string,value:string|number){document.querySelector(`#${id}`)!.textContent=String(value)}
