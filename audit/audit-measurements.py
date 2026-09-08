from PIL import Image
import numpy as np
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
m=json.loads((root/'slice/data/bathy_sunda.json').read_text())['tile']
rgb=np.asarray(Image.open(root/'slice/data/bathy_sunda.png'))
z=(rgb[:,:,0].astype(np.float32)*256+rgb[:,:,1])*m['scale']+m['offset']
lat=np.linspace(m['lat1'],m['lat0'],z.shape[0],endpoint=False)
w=np.cos(np.radians(lat))[:,None]
result={'actual_render_tile_box':[m[k] for k in ['lon0','lon1','lat0','lat1']], 'fractions_on_decoded_render_tile':[]}
for sea in [0,-68.3,-73.9]:
 mask=z>sea
 result['fractions_on_decoded_render_tile'].append({'sea':sea,'pixel_percent':float(mask.mean()*100),'area_weighted_percent':float((mask*w).sum()/(w.sum()*z.shape[1])*100)})
result['stored_comparison_box_start_to_end_percent_gain']=(30.88/30.44-1)*100
result['film_image_bytes']=sum((root/'slice/data'/x).stat().st_size for x in ['bathy_global.png','bathy_redsea.png','bathy_sunda.png','bathy_europe.png'])
result['atlas_image_bytes']=sum(x.stat().st_size for x in (root/'slice/atlas').glob('*.webp'))
def lum(color):
 c=np.array([int(color[i:i+2],16)/255 for i in [0,2,4]])
 c=np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)
 return float(c@np.array([.2126,.7152,.0722]))
result['ice_dim_on_void_contrast']=(lum('5F7794')+.05)/(lum('04060A')+.05)
d=json.loads((root/'data/sealevel_merged.json').read_text())['series']
result['sea_max']=max(d,key=lambda x:x['m'])
result['largest_adjacent_rises_acts_I_II']=sorted([{'older':b['yrBP'],'younger':a['yrBP'],'rise':a['m']-b['m'],'metres_per_ka':(a['m']-b['m'])/((b['yrBP']-a['yrBP'])/1000)} for a,b in zip(d,d[1:]) if a['yrBP']>=39000],key=lambda x:x['metres_per_ka'],reverse=True)[:5]
print(json.dumps(result,indent=2))
(root/'.playwright-mcp/audit-measurements.json').write_text(json.dumps(result,indent=2))
