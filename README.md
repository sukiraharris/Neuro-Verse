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

### 🎮 Psych Clinic: game mode
Hit **▶ Psych Clinic** in the top-left to play doctor:

1. **Diagnose:** read a patient's story and symptoms, then pick a working diagnosis
2. **Treat:** prescribe up to 2 of 12 real medications (SSRIs, SNRI, bupropion, mirtazapine, clomipramine, buspirone, lorazepam, lithium, lamotrigine, quetiapine) at standard or higher dose, plus CBT or ERP therapy
3. **Week 2 follow-up:** hear how they feel, see symptom changes and side effects, and adjust the treatment if needed
4. **Week 8 follow-up:** see the outcome
5. **Results:** get a score out of 100 with what clinicians typically do and teaching points

The brain changes as you go. Overactive regions glow red, underactive regions glow blue, and treated regions calm to teal or brighten to green. The drug's neurotransmitter flows speed up or slow down to show what it does.

Six cases: **depression, generalised anxiety, OCD, panic disorder, bipolar mania**, and a **bipolar depression** case with a trap (an antidepressant alone can trigger mania). The model includes realistic onset times (antidepressants take weeks, benzos act in minutes), OCD needing higher doses, benzodiazepine tolerance, and activating drugs worsening anxiety.

> ⚠️ Educational simulation, deliberately simplified. Not medical advice.

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
    ├── data.js       # Text content: brain regions (REGIONS) and chemicals (CHEMS)
    ├── main.js       # 3D scene, brain geometry, chemical pathways (PATHS), interaction
    ├── game-data.js  # Psych Clinic: patient cases, medications, therapies
    └── game.js       # Psych Clinic: treatment simulation, scoring, game UI
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

**Add a patient case:** add an object to `CASES` in `js/game-data.js` (symptoms, history, quotes, best treatments). **Add a medication:** add it to `MEDS` with its efficacy per condition, onset speed (`tau`) and side effects.

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
