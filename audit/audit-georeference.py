from PIL import Image
import numpy as np
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
def decode(p):
 a=np.asarray(Image.open(p));return (a[:,:,0].astype(np.float32)*256+a[:,:,1])*(20000/65535)-11000
g=decode(root/'slice/data/bathy_global.png')
r=decode(root/'slice/data/bathy_sunda.png')
samples=[]
for i in range(410,650,10):
 for j in range(1700,1980,10):
  # Global builder averages 10x10 native cells after two stages.
  lat=90-(i*10+5)/60;lon=-180+(j*10+5)/60
  if not (-25<lat<17 and 97<lon<151):continue
  ri=int(round((22-lat)*60));rj=int(round((lon-92)*60))
  regional=float(r[ri-5:ri+5,rj-5:rj+5].mean())
  # Shader treats the resulting 2048x1024 crop as the ENTIRE globe.
  gi=int((90-lat)/180*g.shape[0]);gj=int((lon+180)/360*g.shape[1])
  samples.append([regional,float(g[i,j]),float(g[gi,gj])])
a=np.array(samples)
out={'samples':len(a),'rmse_m_regional_vs_global_corrected_crop_coordinates':float(np.sqrt(np.mean((a[:,0]-a[:,1])**2))),'rmse_m_regional_vs_global_shader_coordinates':float(np.sqrt(np.mean((a[:,0]-a[:,2])**2))),'native_shape':[10800,21600],'retained_shape':[10240,20480],'lost_longitude_degrees':1120/60,'lost_latitude_degrees':560/60}
print(json.dumps(out,indent=2));(root/'.playwright-mcp/audit-georeference.json').write_text(json.dumps(out,indent=2))
