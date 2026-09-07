"""
Turn the raw environmental grids into the two textures the film reads.

  ETOPO 2022 (60 arc-sec bedrock)  ->  data/bathymetry.png    4096 x 2048, terrain-RGB
  ICE-6G_C  (1 deg, 48 slices)     ->  data/ice_atlas.png     one atlas, all time slices
                                       data/ice_index.json    slice -> kaBP mapping

Terrain-RGB encoding:  elevation_m = (R * 256 + G) * SCALE + OFFSET
That is decodable in one line of GLSL, and 0.305 m per step is far finer than
any sea-level question the film asks.

Run:  python data/build_rasters.py
"""
import json, os, gzip, glob, io as _io
import numpy as np
from PIL import Image
from scipy.io import netcdf_file

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")

W, H = 4096, 2048
E_MIN, E_MAX = -11000.0, 9000.0
SCALE = (E_MAX - E_MIN) / 65535.0
OFFSET = E_MIN


def block_mean(a, oh, ow):
    """Downsample by averaging whole blocks; crops the remainder."""
    h, w = a.shape
    fh, fw = h // oh, w // ow
    a = a[: fh * oh, : fw * ow]
    return a.reshape(oh, fh, ow, fw).mean(axis=(1, 3))


def build_bathymetry():
    src = os.path.join(RAW, "etopo_bed_60s.nc")
    if not os.path.exists(src):
        print("SKIP bathymetry — %s not present" % src)
        return
    import h5py
    with h5py.File(src, "r") as f:
        name = "z" if "z" in f else [k for k in f.keys() if f[k].ndim == 2][0]
        z = np.asarray(f[name][:], dtype=np.float32)
        lat = np.asarray(f["lat"][:]) if "lat" in f else None
    print("  source grid %s  min %.0f  max %.0f m" % (z.shape, z.min(), z.max()))

    # ETOPO ships south-up; the film's texture is north-up.
    if lat is not None and lat[0] < lat[-1]:
        z = z[::-1, :]

    small = block_mean(z, H, W)
    print("  downsampled to %s" % (small.shape,))

    q = np.clip((small - OFFSET) / SCALE, 0, 65535).astype(np.uint16)
    rgb = np.zeros((H, W, 3), dtype=np.uint8)
    rgb[:, :, 0] = (q >> 8).astype(np.uint8)
    rgb[:, :, 1] = (q & 0xFF).astype(np.uint8)
    out = os.path.join(HERE, "bathymetry.png")
    Image.fromarray(rgb, "RGB").save(out, optimize=True)

    # verify the round-trip at a few real depths
    back = (rgb[:, :, 0].astype(np.float32) * 256 + rgb[:, :, 1]) * SCALE + OFFSET
    err = float(np.abs(back - small).max())
    land_now = float((small > 0).mean() * 100)
    land_lgm = float((small > -130).mean() * 100)
    print("  wrote %s  (%.1f MB)" % (out, os.path.getsize(out) / 1048576))
    print("  max decode error %.3f m" % err)
    print("  land above  0 m: %.1f%% of grid" % land_now)
    print("  land above -130 m (LGM lowstand): %.1f%%  <- the shelf the film exposes" % land_lgm)
    return {"scale": SCALE, "offset": OFFSET, "w": W, "h": H, "maxDecodeErrorM": round(err, 4),
            "landFracNow": round(land_now, 2), "landFracLGM": round(land_lgm, 2)}


def build_ice():
    files = sorted(glob.glob(os.path.join(RAW, "ice6g", "*.nc.gz")))
    if not files:
        print("SKIP ice — no slices in %s" % os.path.join(RAW, "ice6g"))
        return
    slices = []
    for p in files:
        base = os.path.basename(p)
        ka = base.replace("I6_C.VM5a_1deg.", "").replace(".nc.gz", "")
        try:
            ka = float(ka)
        except ValueError:
            continue
        with gzip.open(p, "rb") as g:
            nc = netcdf_file(_io.BytesIO(g.read()), "r", mmap=False)
            frac = np.asarray(nc.variables["sftgif"][:], dtype=np.float32)  # % ice covered
            lat = np.asarray(nc.variables["lat"][:])
        if lat[0] < lat[-1]:
            frac = frac[::-1, :]
        frac = np.roll(frac, frac.shape[1] // 2, axis=1)   # 0..360 -> -180..180
        slices.append((ka, frac))

    slices.sort(key=lambda s: -s[0])                        # oldest first
    n = len(slices)
    cols = 8
    rows = (n + cols - 1) // cols
    sh, sw = slices[0][1].shape
    atlas = np.zeros((rows * sh, cols * sw), dtype=np.uint8)
    for i, (ka, frac) in enumerate(slices):
        r, c = divmod(i, cols)
        atlas[r * sh:(r + 1) * sh, c * sw:(c + 1) * sw] = np.clip(frac * 2.55, 0, 255).astype(np.uint8)

    out = os.path.join(HERE, "ice_atlas.png")
    Image.fromarray(atlas, "L").save(out, optimize=True)
    idx = {"cols": cols, "rows": rows, "tileW": int(sw), "tileH": int(sh),
           "slices": [{"i": i, "kaBP": s[0], "iceFrac": round(float((s[1] > 50).mean() * 100), 2)}
                      for i, s in enumerate(slices)],
           "note": "Grayscale = percent ice cover, 255 = 100%. Tiles are oldest-first, row-major. Crossfade adjacent tiles on t."}
    json.dump(idx, open(os.path.join(HERE, "ice_index.json"), "w"), indent=1)
    print("  wrote %s  (%d slices, %.0f KB)" % (out, n, os.path.getsize(out) / 1024))
    print("  span %.1f - %.1f ka BP" % (slices[0][0], slices[-1][0]))
    print("  ice cover at %.0f ka: %.1f%%   at 0 ka: %.1f%%"
          % (slices[0][0], idx["slices"][0]["iceFrac"], idx["slices"][-1]["iceFrac"]))
    return idx


if __name__ == "__main__":
    print("bathymetry:")
    b = build_bathymetry()
    print("ice:")
    i = build_ice()
    if b:
        json.dump(b, open(os.path.join(HERE, "bathymetry_meta.json"), "w"), indent=1)
    print("done.")
