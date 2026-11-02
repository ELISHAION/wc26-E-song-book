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
A, AL = 'Telugu Worship', 'Telugu Worship Songs'   # placeholder artist/album: replace per song
FILES = [  # file, id, title, category, cover hue, tags
 ('Athi_Thvaralo-song1.txt','athi-thvaralo','Athi Thvaralo','Inspirational',265,['telugu','second coming','worship']),
 ('Aagaka_Saagumaa-song2.txt','aagaka-saagumaa','Aagaka Saagumaa','Inspirational',20,['telugu','service','mission']),
 ('Aa_Jali-song3.txt','aa-jali','Aa Jali','Worship',330,['telugu','love','salvation']),
 ('Enduko_Nanninthagaa-song4.txt','enduko-nanninthagaa','Enduko Nanninthagaa','Worship',200,['telugu','grace','worship']),
 ('Entha_Prema_Yesayyaa-song3.txt','entha-prema-yesayyaa','Entha Prema Yesayyaa','Worship',350,['telugu','cross','love']),
]
songs = []
for f, i, t, c, h, tg in FILES:
    te, rom = parse('songs/' + f)
    songs.append(dict(id=i, title=t, artist=A, album=AL, category=c, language='Telugu', cover=h, tags=tg, lyrics=dict(te=te, rom=rom)))
DEMO = []  # demo songs removed
for i,t,a,al,c,h,tg,l in DEMO:
    songs.append(dict(id=i,title=t,artist=a,album=al,category=c,language='English',cover=h,tags=tg,lyrics=dict(en=l)))
json.dump(songs, open('songs.json','w',encoding='utf-8'), ensure_ascii=False, separators=(',',':'))
print(len(songs),'songs')
