# API — LP6

Base: same-origin. All POST JSON, `no-store`.

- `GET /api/health` → `{ok, env, time}`
- `POST /api/search {from,to,date,cls,quota,pax}` → `[{no,name,dep,arr,dur,days,fare,total,status:Timetable,note}]`
- `POST /api/stations {q,state,amen,radius}` → `[{code,name,state,pf,amen,km}]`
- `POST /api/specials {when,state}` → `[{id,no,name,from,to,dates,tag,...}]`
- `POST /api/pnr {pnr}` → `{handoff:true, url, msg}`
- `POST /api/live {q}` → `{handoff:true, url, msg}`
- `POST /api/alerts {type,ref,contact}` → `{id,...}` 400 `invalid-alert`
- `POST /api/vendors {kind:stall|tour,what,phone}` → `{id,...}` 400 `invalid-vendor`
- `POST /api/trips {from,to,date,cls,quota,pax,trainNo}` → `{id}`
- `GET /api/trips?id=` → trip or 404
- `POST /api/auth/request {phone}` → `{ok, expInSec, devCode?}`
- `POST /api/auth/verify {phone,code}` → `{ok, token}` + `Set-Cookie rb_session`
- `POST /api/events {name,meta?}` → `{ok}` (nameless counters)
- `POST /api/chat {q}` → `{reply, source:"builtin"|"ai"}` or `{handoff:true, url, msg}` · 400 `empty-question` · AI optional via `AI_PROVIDER/AI_API_BASE/AI_API_KEY` (key server-side only; without it, built-in rail facts + honest handoff, never invented answers)
- `DELETE /api/account {phone?}` → `{ok, deleted}` + clears cookie
- `GET /api/checkout?plan=` → `{ok, plan, url}` (hosted stub)
