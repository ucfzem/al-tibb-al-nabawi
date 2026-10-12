import json, re, html, os

OUT="/al-tibb-al-nabawi"
pages=json.load(open('/tmp/tibb_pages.json'))['pages']
toc=json.load(open('/tmp/tibb_toc.json'))
by_page={p['pageId']:p for p in pages}
last_id=max(by_page)

# section start pages from TOC (dedup, in order)
seen=set(); starts=[]
for it in toc:
    pg=it['page']
    if pg in seen or pg not in by_page: continue
    seen.add(pg); starts.append((pg, it['title'], it['depth']))
starts.sort(key=lambda x:x[0])
if starts[0][0]!=1: starts.insert(0,(1,'[مقدمة المحقق]',0))

DIAC=re.compile('[\u064B-\u0652\u0670\u0640]')
def diac(t): return DIAC.sub('',t)
head_re=re.compile(r'^\s*[\[\(«]?\s*(فصل|فصول|ذكر|القسم|حرف|باب|المقدمة|مقدمة|تنبيه|فائدة|خاتمة)\b')
TERM=re.compile(r'[.؟?!:۔…»”]\s*$')

def merge_paras(paras):
    # paras: list of (is_head,txt); glue consecutive body lines whose
    # predecessor lacks terminal punctuation (Shamela splits every
    # printed line into its own <p>), breaking on real headings.
    out=[]; buf=''
    def flush():
        nonlocal buf
        if buf: out.append((False,buf)); buf=''
    for is_head,txt in paras:
        d=diac(txt).strip()
        if is_head or (head_re.match(d) and len(d)<=95):
            flush(); out.append((is_head,txt)); continue
        buf=(buf+' '+txt) if buf else txt
        if TERM.search(buf) or len(buf)>1500:
            flush()
    flush()
    return out


def clean_nass(nass):
    out=[]
    for p in re.findall(r'<p>(.*?)</p>', nass, re.S):
        is_head = 'class="c4"' in p
        p=re.sub(r'<span[^>]*class="anchor"[^>]*>\s*</span>','',p)
        p=re.sub(r'<a [^>]*class="btn_tag[^>]*>.*?</a>','',p,flags=re.S)
        txt=html.unescape(re.sub(r'<[^>]+>','',p)).strip()
        txt=re.sub(r'\s+',' ',txt)
        if not txt: continue
        out.append((is_head,txt))
    return out

def page_heading(pid):
    for is_head,txt in clean_nass(by_page[pid]['nass']):
        d=diac(txt).strip()
        if (is_head or head_re.match(d)) and len(d)<=95:
            return txt
    return None

def esc(s): return html.escape(s, quote=False)

def para_html(is_head,txt):
    if is_head:
        return f'<h3 class="text-reading text-xl font-bold text-slate-800 dark:text-amber-100 mt-7 mb-3">{esc(txt)}</h3>'
    return f'<p class="text-reading text-lg text-slate-700 dark:text-slate-200 mb-5 leading-relaxed">{esc(txt)}</p>'

chapters=[]
ch_id=0
for i,(pg,toc_title,depth) in enumerate(starts):
    end = starts[i+1][0] if i+1<len(starts) else last_id+1
    title=toc_title.strip()
    if title in ('فصل','-') or len(title)<3:
        title=page_heading(pg) or by_page[pg]['title'] or title
    body_parts=[]
    paras=[]
    for pnum in range(pg,end):
        pgd=by_page.get(pnum)
        if not pgd: continue
        paras += clean_nass(pgd['nass'])
    for is_head,txt in merge_paras(paras):
        body_parts.append(para_html(is_head,txt))
    if not body_parts: continue
    ch_id+=1
    chapters.append({"id":ch_id,"title":title,"content":"".join(body_parts)})

os.makedirs(f"{OUT}/chapters",exist_ok=True)
man=[]
for ch in chapters:
    fn=f"ch-{ch['id']:03d}.json"
    payload={"id":ch['id'],"title":ch['title'],
             "content":f'<h2 class="text-2xl sm:text-3xl font-bold font-amiri text-slate-900 dark:text-amber-100 mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">{esc(ch["title"])}</h2>'+ch["content"]}
    json.dump(payload, open(f"{OUT}/chapters/{fn}","w"), ensure_ascii=False, indent=1)
    man.append({"id":ch['id'],"title":ch['title'],"file":f"chapters/{fn}"})
json.dump(man, open(f"{OUT}/manifest.json","w"), ensure_ascii=False, indent=1)
print("CHAPTERS:",len(man))
for m in man[:40]:
    print(f'  {m["id"]:>3} {m["title"][:75]}')
