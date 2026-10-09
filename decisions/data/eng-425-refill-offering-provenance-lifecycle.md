# Decide refill-offering provenance and lifecycle representation

Status: Accepted

Sources:

- [Decide refill-offering provenance and lifecycle representation](https://linear.app/pocket-trash/issue/ENG-425/decide-refill-offering-provenance-and-lifecycle-representation)
- [Pen refill catalog verification](https://linear.app/pocket-trash/document/pen-refill-catalog-verification-50bcb9818c51)
- [Ratify the existing Pens domain baseline](./eng-404-pens-domain-baseline.md)

## Decision

Keep refill-offering identity independent of market, source, and lifecycle. One confirmed refill model, tip style, tip size, and ink-colour combination is one offering. Tip style records geometry such as needle or conical; tip size records the maker's writing grade or ball diameter. Maker codes and commercial SKUs are sourced identifiers for that offering; different regional codes or pack sizes do not create duplicate refill products or offerings unless they identify a genuinely different model, tip style, tip size, or colour combination.

Represent regional availability with versioned offering-market status assertions. Each assertion belongs to one offering and one controlled market, records one lifecycle conclusion, and links to the source evidence that supports it. An offering can therefore be current in one market, historical in another, and absent with unknown status elsewhere.

### Markets

- Use controlled market identities, not free-form region text or UI locales. A market is typed as global, country, or region.
- Use `GLOBAL` for the root and ISO 3166-1 alpha-2 codes for countries. Add a controlled region only through staff review, with a stable code, display name, source-backed definition, and explicit country membership or containment links. This permits truthful source scopes such as a maker's Europe catalog without inventing country claims.
- Keep the market containment graph acyclic. A region may contain countries or narrower regions; overlapping regions are allowed only with the conflict rules below.
- A language, storefront domain, shipping destination, or currency alone does not prove market availability.
- Omit a market assertion when the source scope is unknown. Absence means unknown, not unavailable.

### Lifecycle conclusions

Use exactly these lifecycle values:

- `current`: an authoritative source lists or sells the offering in that market as of the evidence date;
- `discontinued`: an authoritative source explicitly states that the offering ended or was discontinued in that market; and
- `historical`: a dated authoritative source proves a past offering, but does not establish that it remains current or was explicitly discontinued.

Do not infer `discontinued` from a missing search result, a removed page, or omission from a later catalog. Those facts may supersede `current` with `historical` only after staff review. Do not store `unknown` as a lifecycle value.

### Source evidence

Store catalog source evidence separately so one preserved source can support many offerings and one assertion can cite multiple sources. Each evidence record identifies:

- authoritative publisher or maker;
- original URL and source kind, such as product page, regional catalog, or discontinuation notice;
- capture date;
- catalog edition or publication/effective date when the source provides one;
- preserved-source identity or checksum when a capture exists; and
- the reviewed claim and market scope.

A live URL without a capture date is not sufficient seed provenance. Catalog edition and publication date are optional only when the source genuinely has neither; capture date remains required. Preserve older and contradictory evidence when a conclusion changes.

### Versioning and conflicts

- Allow one active approved assertion per offering and market, regardless of lifecycle conclusion. Each version records its approval time, effective date when known, and optional superseded time and successor. A partial unique constraint must allow only one assertion with no superseded time for an offering-market pair.
- Record the status as an as-of conclusion, not an eternal property of the refill product.
- A later authoritative source may supersede an earlier conclusion. Conflicting sources with no clear precedence block approval instead of being resolved by URL order or scrape time.
- Resolve a country by its exact assertion first, then assertions for containing regions from narrowest to widest, then `GLOBAL`. A narrower scope may intentionally override a broader one. Two active, disagreeing assertions for overlapping scopes that are not ordered by containment block approval until a more specific assertion or scope correction resolves them.
- A `GLOBAL` assertion is a fallback, not a claim that country exceptions cannot exist.

### Maker codes and SKUs

Represent a maker code or SKU as a versioned identifier assignment, separate from offering identity and offering-market lifecycle. An assignment records the offering, maker, identifier kind, exact source value, comparison value, controlled market scope, source evidence, effective date when known, and optional superseded time and successor.

- Preserve the exact source value byte-for-byte except for transport decoding. By default, derive the comparison value by trimming surrounding whitespace only; preserve case, punctuation, and internal whitespace. A maker-specific reviewed rule may define additional comparison normalization, but search normalization never changes identifier identity.
- Allow only one active assignment for the same maker, identifier kind, comparison value, and exact market scope. Resolve scoped identifiers with the same country, containing-region, then `GLOBAL` precedence.
- Preserve superseded assignments so historical catalogs remain explainable. Do not delete or move an old code when a replacement appears.
- Retiring or superseding an identifier does not discontinue the offering. A pack-size SKU never changes refill compatibility.
- Conflicting active assignments at incomparable overlapping scopes block approval under the same rule as lifecycle assertions.

## Migration mapping

- Deduplicate rows first by stable refill model, tip style, tip size, and ink colour. Attach verified maker codes and SKUs as sourced identifiers.
- Create a market status only when the source explicitly establishes both the market and one lifecycle conclusion.
- Import a currently published regional product page as `current` with its capture date.
- Import a dated catalog entry as `current` only when that edition represents the current reviewed catalog; otherwise import it as `historical`.
- Import `discontinued` only from an explicit authoritative discontinuation statement.
- Keep unsupported seed combinations out of production. Do not manufacture provenance from planning-file comments or bare URLs.

## Consequences

- ENG-412 must separate refill offerings, offering identifiers, catalog source evidence, and versioned offering-market status assertions with the constraints above.
- ENG-413 can seed one global offering identity from multiple regional sources without duplication while retaining market-truthful lifecycle conclusions.
- Public catalog queries may prefer current assertions for the viewer's market, but historical offerings remain addressable and auditable.
- Lifecycle changes never change refill compatibility or an installed refill selection.
