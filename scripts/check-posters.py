import json,concurrent.futures,subprocess,datetime
from pathlib import Path
root=Path(__file__).resolve().parents[1]
urls=set()
for n in ['series','movies','complete']:
 for item in json.loads((root/'data'/f'{n}.json').read_text()): urls.add(item['poster'])
def check(u):
 p=subprocess.run(['curl','-sSL','--head','--max-time','20','--retry','1','-o','/dev/null','-w','%{http_code} %{content_type}','--',u],capture_output=True,text=True)
 status,_,mime=p.stdout.partition(' ')
 return {'url':u,'status':status,'type':mime} if status!='200' or not mime.startswith('image/') else None
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex: failures=[x for x in ex.map(check,sorted(urls)) if x]
r={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'uniquePosters':len(urls),'failures':failures}
(root/'data'/'posters-check.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
print(json.dumps(r,ensure_ascii=False,indent=2))
