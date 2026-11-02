"""Builds songs.json. To expand: drop new .txt files in songs/ (Telugu block, then '** ENGLISH LYRICS **' block),
add an entry to FILES, and/or add dicts to DEMO. Run: python3 build_songs.py  — UI/code never changes."""
import json, re
def parse(path):
    t = open(path, encoding='utf-8').read().replace('\r', '')
    t = re.sub(r'\*\*\s*TELUGU LYRICS\s*\*\*', '', t)
    a, b = re.split(r'\*\*\s*ENGLISH LYRICS\s*\*\*', t)
    def clean(x):
        ls = [re.sub(r'^\d+\.\s*', '', l.strip()) for l in x.strip().split('\n')]
        return re.sub(r'\n{3,}', '\n\n', '\n'.join(ls)).strip()
    return clean(a), clean(b)
TE = re.compile(r'[\u0C00-\u0C7F]')
def parse_mixed(t):
    """For files with Roman + Telugu text mixed (no ENGLISH marker): sorts lines by script, drops section labels."""
    te, rom = [], []
    for l in t.replace('\r', '').split('\n'):
        s = l.strip()
        if re.match(r'^[#*\s]*(telugu|english)\s*[:\-]*[*\s]*$', s, re.I):
            continue
        if not s:
            te.append(''); rom.append(''); continue
        if TE.search(s):
            s = s.replace('*', '').lstrip('#').strip()
            if re.match(r'^(\u0C2A\u0C32\u0C4D\u0C32\u0C35\u0C3F|\u0C1A\u0C30\u0C23\u0C02)\s*\d*\s*(\([^)]*\))?$', s): s = ''
            te.append(s); continue
        s = s.replace('*', '').strip()
        if re.match(r'^[\[\(\W]*(pre-?chorus|final chorus|chorus|verse\s*\d*|bridge|\d+)[\]\)\.\W]*$', s, re.I): s = ''
        s = re.sub(r'^(verse\s*\d+\s*[.)]\s*|\d+\s*[.)]\s*)', '', s, flags=re.I)
        rom.append(s)
    def clean(ls):
        return re.sub(r'\n{3,}', '\n\n', '\n'.join(x.strip() for x in ls)).strip()
    return clean(te), clean(rom)
_old_parse = parse
def parse(path):
    t = open(path, encoding='utf-8').read()
    return _old_parse(path) if re.search(r'\*\*\s*ENGLISH LYRICS\s*\*\*', t) else parse_mixed(t)
A, AL = 'Telugu Worship', 'Telugu Worship Songs'   # placeholder artist/album: replace per song
FILES = [  # file, id, title, category, cover hue, tags
 ('Athi_Thvaralo-song1.txt','athi-thvaralo','Athi Thvaralo','Inspirational',265,['telugu','second coming','worship']),
 ('Aagaka_Saagumaa-song2.txt','aagaka-saagumaa','Aagaka Saagumaa','Inspirational',20,['telugu','service','mission']),
 ('Aa_Jali-song3.txt','aa-jali','Aa Jali','Worship',330,['telugu','love','salvation']),
 ('Enduko_Nanninthagaa-song4.txt','enduko-nanninthagaa','Enduko Nanninthagaa','Worship',200,['telugu','grace','worship']),
 ('Entha_Prema_Yesayyaa-song3.txt','entha-prema-yesayyaa','Entha Prema Yesayyaa','Worship',350,['telugu','cross','love']),
]
FILES += [  # Day 1 songs (mixed Roman+Telugu files)
 ('Dhukkamulo_piluvaga.txt','dhukkamulo-piluvaga','Dhukkamulo Piluvaga','Worship',48,['telugu','praise','faith']),
 ('Na_Pranam_Neve.txt','na-pranam-neve','Na Pranam Neve','Worship',36,['telugu','gratitude','praise']),
 ('Naakunndantha_Neeve_Neeve_Naa.txt','naakunnadantha-neeve','Naakunnadantha Neeve','Worship',42,['telugu','love','devotion']),
 ('Nee_mahimanu_choodali.txt','nee-mahimanu-choodali','Nee Mahimanu Choodali','Worship',30,['telugu','glory','kingdom']),
 ('Nee_Naamam_lone_Maaku.txt','nee-naamamlone-maaku','Nee Naamamlone Maaku','Worship',52,['telugu','healing','prayer']),
 ('Nee_Namamulo_Naaku_Swastha.txt','nee-namamulo-naaku-swastha','Nee Namamulo Naaku Swastha','Worship',26,['telugu','name of Jesus','healing']),
 ('Neekasaadhyamainadi_Ediyu_Ledu.txt','neekasaadhyamainadi-ediyu-ledu','Neekasaadhyamainadi Ediyu Ledu','Inspirational',44,['telugu','power','faith']),
 ('Neela_Lerevvaru.txt','neela-lerevvaru','Neela Lerevvaru','Worship',38,['telugu','praise','light']),
 ('Sthuthi_Ghanatha_Neeke_Prabhuva.txt','sthuthi-ghanatha-neeke-prabhuva','Sthuthi Ghanatha Neeke Prabhuva','Worship',32,['telugu','emmanuel','praise']),
 ('Theeruna_Ninnu_Chuda_Bhagyamu.txt','theeruna-ninnu-chuda-bhagyamu','Theeruna Ninnu Chuda Bhagyamu','Worship',46,['telugu','kingdom','christmas']),
 ('Yesu_Neeve_Naa_Thodu.txt','yesu-neeve-naa-thodu','Yesu Neeve Naa Thodu','Worship',40,['telugu','companionship','thanks']),
]
DAY = {'athi-thvaralo':1,'aagaka-saagumaa':2,'aa-jali':3,'enduko-nanninthagaa':4,'entha-prema-yesayyaa':5}  # song id -> conference day (1-5): EDIT THIS
songs = []
for f, i, t, c, h, tg in FILES:
    te, rom = parse('songs/' + f)
    songs.append(dict(id=i, day=DAY.get(i,1), title=t, artist=A, album=AL, category=c, language='Telugu', cover=h, tags=tg, lyrics=dict(te=te, rom=rom)))
DEMO = []  # demo songs removed
for i,t,a,al,c,h,tg,l in DEMO:
    songs.append(dict(id=i,title=t,artist=a,album=al,category=c,language='English',cover=h,tags=tg,lyrics=dict(en=l)))
json.dump(songs, open('songs.json','w',encoding='utf-8'), ensure_ascii=False, separators=(',',':'))
print(len(songs),'songs')
