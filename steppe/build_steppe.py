"""Build Beat 09's on-screen record from timeline.json."""
import json, os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def main():
    tl=json.load(open(os.path.join(ROOT,"timeline.json"),encoding="utf-8")); beat=next(b for b in tl["beats"] if b["id"]==9)
    events={e["id"]:e for e in tl["events"]}; selected=[events[x] for x in beat["events"]]
    out={"_readme":"Built from timeline.json and data/. Do not edit by hand.","beat":beat,"events":selected,"routes":[r for r in tl["routes"] if r.get("beat")==9],"sources":{s:tl["sources"][s] for e in selected for s in e["sourceIds"]},"sea":[[x["yrBP"],x["m"]] for x in json.load(open(os.path.join(ROOT,"data","sealevel_merged.json"),encoding="utf-8"))["series"]],"ice":json.load(open(os.path.join(ROOT,"data","ice_index.json"),encoding="utf-8")),"bathy":json.load(open(os.path.join(ROOT,"data","bathymetry_meta.json"),encoding="utf-8"))}
    os.makedirs(os.path.join(HERE,"data"),exist_ok=True); target=os.path.join(HERE,"data","beat09.json"); json.dump(out,open(target,"w",encoding="utf-8"),indent=1,ensure_ascii=False); print("wrote %s (%d events)"%(target,len(selected)))
if __name__=="__main__":main()
