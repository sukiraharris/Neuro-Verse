# Neuro-Verse 🧠

**An interactive 3D brain you can explore in your browser.**

### 👉 [Live site: sukiraharris.github.io/Neuro-Verse](https://sukiraharris.github.io/Neuro-Verse/)

Rotate and zoom around a 3D brain, click any of 33 structures to learn what it does, and watch neurotransmitters and hormones flow through the brain as glowing coloured particles, from where they're made to where they act.

---

## Features

### Explore the anatomy
- **33 clickable structures** across the cortex, limbic system, basal ganglia, diencephalon, brainstem and cerebellum
- Each one opens a panel with its **key functions**, the **chemicals involved**, **what happens when it goes wrong**, and a **fun fact**
- **Searchable list** of every structure, grouped by brain system
- **Floating labels** that follow the model as you rotate it

### Watch the chemistry
Turn on any of 7 chemical flows to see them travel along their real pathways:

| Chemical | Colour | Made in | Flows to |
|---|---|---|---|
| Serotonin | 🟣 violet | Raphe nuclei | Cortex, limbic system, cerebellum, spinal cord |
| Dopamine | 🟡 amber | VTA, substantia nigra | Striatum, nucleus accumbens, prefrontal cortex (all 4 pathways) |
| Noradrenaline | 🔵 blue | Locus coeruleus | Almost the entire brain |
| Acetylcholine | 🟢 green | Basal forebrain, pons | Cortex, hippocampus, thalamus |
| Oxytocin | 🩷 rose | Hypothalamus | Pituitary, amygdala, nucleus accumbens |
| Cortisol | 🔴 red | HPA axis (brain → adrenal glands) | Back to hippocampus, amygdala, prefrontal cortex |
| Melatonin | ⚪ silver | Pineal gland | Hypothalamus, bloodstream |

Each chemical has its own panel covering what it's made from, what it does, drugs that act on it, and what happens when there's too much or too little. Regions and chemicals link to each other, so you can jump between them.

### See inside
- **X-ray mode / cortex slider:** fade the outer cortex to reveal deep structures
- **Hide a hemisphere:** see the medial surface (e.g. the cingulate cortex)
- **Region colours** on/off, **labels** on/off, **auto-spin**, and **reset view**

---

## Controls

| Action | How |
|---|---|
| Rotate | Click and drag |
| Zoom | Scroll / pinch |
| Pan | Right-click drag / two-finger drag |
| Select a structure | Click it, its label, or its name in the list |
| Show a chemical flow | Click a chemical in the bottom bar or in a region's panel |

---

## Built with
- [Three.js](https://threejs.org/) (r128) for 3D rendering
- Plain HTML, CSS and JavaScript, with no frameworks and no build step
- Hosted on **GitHub Pages**

The brain is a procedural model generated in code (gyri come from 3D Perlin noise, and regions are assigned by position), so region boundaries are approximate rather than taken from an MRI atlas.

---

## Project structure

```
Neuro-Verse/
├── index.html      # Page layout: panels, buttons, dock
├── css/
│   └── style.css   # All styling
└── js/
    ├── data.js     # Text content: brain regions (REGIONS) and chemicals (CHEMS)
    └── main.js     # 3D scene, brain geometry, chemical pathways (PATHS), interaction
```

---

## Run it locally

Clone the repo and serve the folder:

```bash
git clone https://github.com/sukiraharris/Neuro-Verse.git
cd Neuro-Verse
python3 -m http.server 8000
```

Then open http://localhost:8000. In VS Code you can also right-click `index.html` → **Open with Live Server**.

> Three.js loads from a CDN, so you need an internet connection.

---

## Extending it

**Add a chemical:** add an entry to `CHEMS` in `js/data.js`, then add a matching function to `PATHS` in `js/main.js` that returns a list of 3D waypoint paths.

**Add a structure:** add an entry to `REGIONS` in `js/data.js`, then create its mesh in `js/main.js` with `ellip(id, center, radii, color)` or `tube(id, points, radius, color)`.

**Coordinates:** x = left (−) / right (+), y = up, z = front (+) / back (−).

---

## Updating the live site

```bash
git add .
git commit -m "describe your change"
git push
```

GitHub Pages redeploys automatically within a minute or two.

---

*Educational project. Not a substitute for a neuroanatomy textbook.*
