# IE-Map right labyrinth asset · v1

This is a portable anatomy handoff for future inner-ear videos. It contains the **27 IE-Map v1.0.0 surface meshes** as original VTK and direct triangulated OBJ, the source segmentation as optional interior-path evidence, an editable Blender import scene, a standalone Blender importer, four orientation views, and file-level provenance. It is a **technical asset candidate**, not clinically approved anatomy for every teaching topic.

## Start here

1. Open `scene/iemap-import-check.blend` in Blender to inspect the named objects, materials, cameras and lights. It was saved and checked with Blender 5.2.1 LTS. This historical import-check scene opens in its last saved context view; use the Outliner to choose visible structures. It is an anatomy inspection scene, not the finished BPPV film.
2. To build a clean anatomy collection in your own scene, run:

   ```sh
   blender -b --factory-startup --python import_labyrinth.py -- --output your-labyrinth-scene.blend
   ```

   Replace `--factory-startup` with the path to an existing `.blend` to add the collection to that scene. Or run `import_labyrinth.py` from Blender's Scripting workspace and save the scene yourself. The importer does not clear existing objects. It rejects a second collection with the same name to avoid accidental duplicate anatomy.
3. Run `python3 verify_package.py` from this directory before reuse. It checks every included file against `bundle-manifest.json`.

## Coordinate contract

- Source: a **right-oriented IE-Map template**, in patient RAS millimetres: +X right, +Y anterior, +Z superior. It is an atlas, not one patient's registered head.
- OBJ vertices retain the source coordinates. The importer scales each Blender object by **0.001 once**, producing metres in the same axis orientation. Do not mirror or apply a second unit conversion.
- `bundle-manifest.json` maps stable structure IDs to both portable files and original source hashes. `provenance/production_master_manifest.json` is the project's detailed conversion and topology record; its `derived_file` paths describe the original repository layout.
- `source/segIEMap.seg.nrrd` retains the source segmentation, and `provenance/segmentation_and_mesh_audit.json` records its index-to-RAS transform. These are for independent geometry/path checks; the importer does not load the segmentation into Blender.
- The default visible set is a presentation choice recorded per object. Hidden objects include alternate or overlapping parts; show them selectively after checking their source role.

## Boundaries that matter in a video

- The meshes are separate source parts. Contact or intersection between their closed surfaces does **not** prove an open lumen between them. In particular, do not animate a particle through a junction just because two meshes touch.
- `Sp` is the slender posterior duct. The checked BPPV long-arm path in the original project is an **episode-specific derivative** and is intentionally outside this package. Future motion needs its own route, pose, gravity and clinical review.
- IE-Map has no complete deformable posterior cupula: its `Post_Cup_Mid` segmentation part is empty and no corresponding VTK surface exists. Flow, cupula response, neural signals, otoconia, labels and arrows are not contained in these source meshes.
- The optional `segT2_th1.07_Otsu` outer shell is a threshold context surface; do not label it as independently verified temporal bone. Cochlear variants and overlapping common-crus parts should not all be shown as additional tissue.
- The generic head in the BPPV film is an illustrative orientation prop with unverified head-to-atlas registration. It is intentionally excluded here.

## From asset to a new video

Import the labyrinth, decide which source structures support the new topic, then author that episode's camera, motion, lighting and medical overlays in Blender. Render a numbered PNG frame sequence. Composite captions and graphics over those rendered anatomy frames, then encode the sequence to MP4 with FFmpeg. In the original project, `scripts/blender/build_gate3_motion_v2.py` set the BPPV scene state, `scripts/blender/render_gate3_motion_v2.py` rendered anatomy frames, and `scripts/compose_gate3_motion_v2.py` added screen graphics and encoded the review cut. Those scripts are **examples in the original repository**, not general anatomy code and not part of this zip. A future episode must specify and review its own mechanism before adapting them.

## Source, license and review

The source is [IE-Map v1.0.0](https://zenodo.org/records/10625570), described by Ahmadi S-A et al., *IE-Map: a novel in-vivo atlas and template of the human inner ear*, *Scientific Reports* 11, 3293 (2021), DOI [10.1038/s41598-021-82716-0](https://doi.org/10.1038/s41598-021-82716-0). The atlas is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); retain credit, the license link and a notice of modifications in future derivatives. Selected registered membranous surfaces derive from David R et al., *Scientific Reports* 6, 32772 (2016); the source README describes the CT/micro-CT lineage from Wimmer W et al., *Data in Brief* 27, 104782 (2019). Original `source/LICENSE.txt` and `source/README.md` are included.

The project converted source VTK polygon cells to triangulated OBJ without smoothing or anatomical repair. Blender import, vertex/face counts, axes and bounds were technically checked. A vestibular specialist has **not** approved interpretation of these structures or a future film's medical claims. The four `views/` images are orientation references, not that approval.

## What is intentionally outside the zip

MRI/CT volumes, landmarks, the generic head, BPPV particles/path, shot timings, captions, review MP4, website and prototype procedural ear. The 27 surface meshes and provenance are sufficient to carry this **surface labyrinth asset** into another Blender video. The included segmentation supports a new interior-path check, but detailed imaging or registration analysis may need the full IE-Map record from the pinned source URL and a fresh hash check.
