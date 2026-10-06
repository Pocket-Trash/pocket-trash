# Slider catalog manifest review

Status: pending user approval

Approval payload SHA-256:
`0056d7bc81c70ab4f90debb4a4a10b73b05b1fec515f1f18289f32f1ab44247a`

This document is the human review for ENG-348. The exact product,
relationship, development-fixture, and image inventory is stored in
[`slider-catalog-manifest-review.json`](./slider-catalog-manifest-review.json).
That JSON is a review artifact, not the disposable production command or final
machine import manifest described by ENG-363.

## Approval requested

Approval of the payload hash above confirms all five decisions below:

1. Use the deterministic current-collection boundary and exclusions in this
   review.
2. Create the three derived component records that do not have standalone
   storefront SKUs: the Magnus T48 plate set, FidgetBoy ModBoy plate set, and
   FidgetBoy ModBoy insert set.
3. Treat the selected makers as the expected rights controllers for all 480
   proposed production image references and accept the first-party storefront
   provenance described below.
4. Give the 11 component records without component-specific storefront
   photography no production gallery rather than mislabeling assembled-product
   photos.
5. In development and preview only, reuse the explicitly identified source
   photos for those image-less components so every fixture product exercises
   image behavior.

This approval is the project-required image-rights, provenance, and production
seed sign-off. It is not independent proof of copyright title or a reuse
license.

## Scope

| Area | Exact scope |
| --- | ---: |
| Existing KAP catalog | 71 products: 59 spinners and 12 spinner buttons |
| New sliders | 41 products: 10 Magnus, 30 Novel Carry, 1 FidgetBoy |
| New components | 14 products: 5 plate sets and 9 insert sets |
| Production images | 480 references: 271 KAP and 209 slider/plate |
| Unique new source images | 182 binaries, 260,096,830 bytes |
| Development/preview | 21 sliders, 5 plates, and 9 inserts |

Owners are fixed to:

- Production: `user_3JpzgbqP9fye2bo4YMrOfLhrkCa`
- Development and preview: `user_3JRUuhMIDwBBiLyc4smN8pAtGS9`

## Existing KAP snapshot

The existing snapshot at
`packages/database/seed-data/kapedc.json` is included by exact content hash:

- SHA-256:
  `6afbc3e669bb436b16c2408edcadfde902e6a07776683d59f48982f76294b1bb`
- Imported at: `2026-09-23T05:21:15.861Z`
- Products: 71
- Images: 271 unique checksummed images, 53,303,520 bytes

The file already records each product's exact name, type, source URL,
materials, ordered gallery, content type, byte count, filename, cache path,
and SHA-256 digest. Approval of this review includes every object in that
content-addressed snapshot; no reviewed KAP product is excluded.

## Deterministic slider boundary

The source snapshot was captured on `2026-10-06T05:22:40Z`.

- Magnus: every exact listing in the current
  [T48 collection](https://magnusfidgets.com/collections/t48-sliders). All ten
  are historical/sold out but remain live and published.
- Novel Carry: every slider listing in the current Mini, Delta, and Echo family
  collections. Services and general spare parts are excluded; typed cassette
  variants re-enter only as insert products.
- FidgetBoy: the current storefront entry whose title and body describe a
  slider. Products incorrectly typed as `Metal Slider`, such as pouches, are
  excluded.

### Magnus T48 sliders

All ten products are body-hosted and use compatibility family `magnus-t48`.
The source pages specify a 2×4, three-click layout with 6×3 mm N45 magnets and
an included Zirconium T48 Dimple plate set.

| Source ID | Exact storefront title | Images |
| --- | --- | ---: |
| 10319195373736 | TA-219-M: Arc “Mini-Frag” | 5 |
| 10319193768104 | TA-218-M: Peak | 4 |
| 10319181676712 | TA-215-M: Rail | 4 |
| 10319177515176 | ZA-449-L: Ridge | 4 |
| 10319171223720 | ZA-448-L: Arc “Mini-Frag” | 4 |
| 10319163850920 | ZA-447-L: Hex *BLEM* | 4 |
| 10319155200168 | ZA-446-L: Rail | 4 |
| 10319146942632 | ZA-445-A: Toad “Original” | 4 |
| 10319134032040 | ZA-444-L: Grenade | 4 |
| 10319128854696 | ZA-443-L: Dimple | 4 |

### Novel Carry Mini sliders

The Mini V1 products are body-hosted. Mini V2 products are insert-driven and
include the Mini V2 cassette.

| Source ID | Exact storefront title | Images |
| --- | --- | ---: |
| 7526003081422 | Mini Tile Fidget Slider - Richlite | 7 |
| 7526322929870 | Mini Tile Fidget Slider - Plastic | 17 |
| 7706420248782 | Mini V2 Tile Fidget Slider, Ripple - Richlite | 5 |
| 7694002389198 | Mini V2 Tile Fidget Slider - Richlite | 5 |

### Novel Carry Delta sliders

All nine products are insert-driven, use the Delta compatibility family, and
include Delta plates plus the mixed 5/16-inch-corner/1/4-inch-center cassette
as the advertised default.

| Source ID | Exact storefront title | Images |
| --- | --- | ---: |
| 7539411222734 | Delta Tile Fidget Slider - Richlite | 4 |
| 7608178901198 | Delta Pro Tile Fidget Slider - Richlite | 4 |
| 7539416760526 | Delta Tile Fidget Slider - Plastic | 4 |
| 7616631242958 | Delta Ergo Tile Fidget Slider - Aluminum | 4 |
| 7674967982286 | Delta Ergo Pro Tile Fidget Slider - Richlite | 9 |
| 7688206254286 | Delta Ergo Tile Fidget Slider - Plastic | 5 |
| 7626932158670 | Delta Tile Fidget Slider - Aluminum Natural Beadblast | 2 |
| 8835849158862 | Delta Appa Tile - Limited Edition, Dead Man's Glow | 4 |
| 7638220472526 | Delta Ergo Pro Tile Fidget Slider - Richlite Columbia | 3 |

### Novel Carry Echo sliders

All 17 products are insert-driven, use the Echo compatibility family, and
include Echo plates plus the mixed 5/16-inch-corner/1/4-inch-center cassette as
the advertised default.

| Source ID | Exact storefront title | Images |
| --- | --- | ---: |
| 7703288217806 | Echo Ergo Tile Fidget Slider - Titanium | 4 |
| 7715359588558 | Echo Appa Pro Tile Fidget Slider - Richlite | 8 |
| 8803927752910 | Echo Appa Tile Fidget Slider - Aluminum Stonewashed, Natural | 3 |
| 8803931226318 | Echo Appa Tile Fidget Slider - Aluminum Midnight Violet | 4 |
| 8807780810958 | Echo Appa Tile Fidget Slider - Aluminum, Ember Orange | 3 |
| 8832362610894 | Echo Appa Tile Fidget Slider - Aluminum, Piano Black | 3 |
| 8807781040334 | Echo Appa Tile Fidget Slider - Aluminum, Tempest Blue | 2 |
| 8826545799374 | Echo Appa Pro Tile Fidget Slider - Raffir Blue Alume Moon Composite | 3 |
| 8832363495630 | Echo Appa Tile Fidget Slider - Aluminum, Beadblast Black | 3 |
| 8826546847950 | Echo Appa Pro Tile Fidget Slider - Toxic Storm Carbon Fiber | 3 |
| 8826535477454 | Echo Ergo Pro Tile Fidget Slider - Richlite, Maple | 2 |
| 8825893454030 | Echo Ergo Pro Tile Fidget Slider - Richlite, Black | 2 |
| 8823737450702 | Echo Appa Tile Fidget Slider - Richlite Columbia | 3 |
| 8821915189454 | Echo Ergo Tile Fidget Slider - Aluminum Natural Stonewash | 4 |
| 8826538918094 | Echo Ergo Pro Tile Fidget Slider - Richlite, Columbia | 3 |
| 8821915320526 | Echo Ergo Tile Fidget Slider - Aluminum Black Beadblast | 3 |
| 8821915254990 | Echo Ergo Tile Fidget Slider - Aluminum Natural Beadblast | 3 |

### FidgetBoy slider

Shopify product `8824870830195`, **ModBoy - Neon Highlighter - PETG 3DP Top
with SS Plates - Ti Collars**, is insert-driven, uses family
`fidgetboy-modboy`, and includes the ModBoy stainless-steel plate set and 3DP
insert set. Its six source images are included. The grouped magnet evidence is
retained as notes because the page does not establish an exact slot map.

## Component products

| Key or source ID | Product | Type | Source form | Production images |
| --- | --- | --- | --- | ---: |
| `magnus-t48-dimple-zirconium-plate-set` | Magnus T48 Dimple Zirconium Plate Set | Plate | Derived included component | 0 |
| 7576985567438 | Mini Tile - Slide Plates | Plate | Standalone product | 11 |
| 7547790426318 | Delta Tile - Slide Plates | Plate | Standalone product | 16 |
| 7604424245454 | Echo Tile - Slide Plates | Plate | Standalone product | 6 |
| `fidgetboy-modboy-stainless-steel-plate-set` | ModBoy Stainless Steel Plate Set | Plate | Derived included component | 0 |
| variant 43565861765326 | Mini V2 cassette | Insert | Spare-parts variant | 0 |
| variant 43127227056334 | Delta mixed cassette | Insert | Spare-parts variant/default | 0 |
| variant 43127227089102 | Delta all-1/4-inch cassette | Insert | Spare-parts variant | 0 |
| variant 48428010701006 | Delta all-1/4-inch equidistant cassette | Insert | Spare-parts variant | 0 |
| variant 43127227121870 | Echo mixed cassette | Insert | Spare-parts variant/default | 0 |
| variant 43127227154638 | Echo all-1/4-inch cassette | Insert | Spare-parts variant | 0 |
| variant 43579054719182 | Echo all-1/4-inch equidistant cassette | Insert | Spare-parts variant | 0 |
| variant 43526336413902 | Echo all-6-mm equidistant cassette | Insert | Spare-parts variant | 0 |
| `fidgetboy-modboy-3dp-insert-set` | ModBoy 3DP Insert Set | Insert | Derived included component | 0 |

The Novel Carry compatibility family and exact inclusion relationships follow
the maker's compatibility and configuration guides. Compatibility does not
create inclusion. The ModBoy's incomplete grouped magnet evidence remains a
sourced note; no slot geometry or polarity is inferred.

## Image inventory and provenance

The JSON inventory records each proposed new image's maker, source product,
source page, Shopify image ID, position, dimensions, source timestamps, CDN
URL, content type, byte count, and downloaded-byte SHA-256. All 182 unique CDN
URLs downloaded successfully. Repeated references account for the difference
between 209 references and 182 unique binaries.

The images originate in maker-controlled storefront galleries and these
Shopify CDN namespaces:

- Magnus Fidgets: `/s/files/1/2117/6827/`
- Novel Carry: `/s/files/1/0623/7772/2062/`
- FidgetBoy: `/s/files/1/0661/1740/2739/`

This demonstrates first-party storefront provenance and the expected rights
controller. Shopify supplies no reusable-license assertion. The approval at
the top of this document is therefore the required project sign-off.

## Development and preview subset

The exact 21-slider subset is stored by source handle in the JSON review
artifact. It contains five Magnus, all four Mini, five Delta, six Echo, and the
FidgetBoy ModBoy. All five plate products and all nine insert products remain
under the per-type limit.

The deterministic image policy is:

- Slider: ModBoy is newest and keeps multiple images; every other slider keeps
  source gallery position one.
- Plate: the FidgetBoy plate is newest and reuses two assembled-product photos;
  every other plate gets one source photo. The Magnus plate uses the T48 Dimple
  slider's first photo.
- Insert: the FidgetBoy insert is newest and reuses two different
  assembled-product photos; each Novel cassette uses the generic first-party
  spare-parts image.

Those reused images are development/preview fixtures only. The derived and
variant component products retain zero production gallery images.

## Exclusions

- Magnus products outside the current T48 collection.
- Novel Carry archive collections and the Standard family.
- Loose magnets, screws, tape, services, display stands, and other excluded
  accessories.
- FidgetBoy pouches mis-typed as `Metal Slider`.
- The removed aluminum ModBoy page, which returns 404 and is absent from the
  current first-party API.
- Mechanical sliders and three-section sliders.

## Primary sources

- [Magnus T48 collection JSON](https://magnusfidgets.com/collections/t48-sliders/products.json?limit=250)
- [Magnus magnet layout guide](https://magnusfidgets.com/pages/slider-magnet-layouts)
- [Novel Carry Mini collection JSON](https://store.novelcarry.com/collections/novel-carry-mini-tile/products.json?limit=250)
- [Novel Carry Delta collection JSON](https://store.novelcarry.com/collections/novel-carry-delta-tile/products.json?limit=250)
- [Novel Carry Echo collection JSON](https://store.novelcarry.com/collections/novel-carry-echo-tile/products.json?limit=250)
- [Novel Carry spare-parts JSON](https://store.novelcarry.com/products/miscellaneous-spare-parts.json)
- [Novel Carry compatibility guide](https://store.novelcarry.com/pages/fidget-slider-compatibility-guide)
- [Novel Carry magnet configuration guide](https://store.novelcarry.com/pages/fidget-slider-magnet-configurations)
- [FidgetBoy catalog JSON](https://fidgetboy.com/products.json?limit=250)
- [FidgetBoy ModBoy](https://fidgetboy.com/products/modboy-neon-highlighter-petg-3dp-top-with-ss-plates-ti-collars)

## Hash verification

Recompute the approval payload hash by removing `approvalPayloadSha256`,
serializing the remaining JSON with sorted keys and no insignificant
whitespace, and hashing the resulting bytes:

```sh
jq 'del(.approvalPayloadSha256)' docs/slider-catalog-manifest-review.json \
  | jq -S -c . \
  | shasum -a 256
```

The result must be
`0056d7bc81c70ab4f90debb4a4a10b73b05b1fec515f1f18289f32f1ab44247a`.
