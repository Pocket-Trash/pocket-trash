# Pocket Trash Catalog Language

This glossary names the catalog and collection concepts shared by Pocket Trash.

## Catalog and collection

**Catalog product**:
A canonical item that a maker sells or identifies as one product.
_Avoid_: Variant, owned item

**Owned item**:
A user's record of one physical item in a collection.
_Avoid_: Product, variant

**Installed part**:
A catalog selection or explicitly owned part fitted to an owned item.
_Avoid_: Variant

## Pens and parts

**Pen**:
A writing instrument whose configuration can include replaceable parts and a refill.

**Pen part**:
A user-swappable catalog product that serves one or more functional roles on a pen.
_Avoid_: Internal component

**Pen clip**:
A pen part whose product identity is a clip, even when it also acts as an actuator.

**Pen tip**:
A pen part that forms the writing end and can affect refill compatibility.
_Avoid_: Nose

**Pen top cap**:
A pen part that closes the end opposite the tip.
_Avoid_: End cap

**Pen mechanism**:
A selectable physical pen part that advances, retracts, or retains the refill.
_Avoid_: Mechanism type

**Pen actuator**:
A pen part that a user operates to engage the mechanism.
_Avoid_: Button, bolt pin, lock pin, thumb stud

**Part role**:
A function that a pen part performs independently of its product type.
_Avoid_: Product type

**Configuration slot**:
One ordered selection dimension for a configurable product, such as material, appearance, tip, clip, mechanism, or actuator.
_Avoid_: Field, property

**Configuration choice**:
One selectable value in a configuration slot, backed by an existing catalog fact or a virtual selection.
_Avoid_: Variant

**Choice availability rule**:
One conjunction of earlier configuration choices that permits a target choice; multiple rules for the target are alternatives.
_Avoid_: Restriction, exclusion, compatibility rule

## Refills and compatibility

**Refill**:
A maker's stable refill model, independent of tip size and ink colour offerings.
_Avoid_: Offering, installed refill

**Refill offering**:
One confirmed combination of refill model, tip style, tip size, and ink colour. Maker codes and commercial SKUs are sourced identifiers for the offering.
_Avoid_: Refill product, variant

**Offering market status**:
An approved, source-backed current, discontinued, or historical conclusion for one refill offering in one controlled market.
_Avoid_: Global availability, offering lifecycle

**Compatibility group**:
A set of refills with verified physical interchangeability.
_Avoid_: Brand family, ink family

**Compatibility subject**:
A pen product alone or that pen with one required pen-tip product.
_Avoid_: Owned pen, body-tip pairing

**Compatibility assertion**:
An approved claim about how one compatibility subject fits a refill product or compatibility group.
_Avoid_: Fit report

**Compatibility evidence**:
A sourced manufacturer statement, dimensional comparison, physical fit test, or curated observation that supports or contradicts a compatibility claim.
_Avoid_: Tested flag, reliability score

**Unknown compatibility**:
The absence of an applicable compatibility assertion.
_Avoid_: Incompatible

## Names

**Terminology concept**:
A registered canonical catalog meaning, identified by a stable namespace and key and shown with a localized canonical label.
_Avoid_: Alias, product

**Terminology alias**:
A searchable alternate term for one terminology concept, with global or maker scope.
_Avoid_: Product alias

**Preferred maker term**:
The one maker-scoped terminology alias selected for contextual display instead of the canonical label.
_Avoid_: Canonical label, product name

**Product alias**:
An alternate searchable name for one catalog product.
_Avoid_: Terminology alias, product name

## Source evidence

**Preserved source**:
An immutable or append-only capture of maker data whose identity, capture date, and integrity can be verified independently of the current maker site.
_Avoid_: Live source, staging row

**Staging row**:
A normalized scraper record used for processing and review. It is migration evidence only when its originating preserved source and transformation are known.
_Avoid_: Catalog product, preserved source

**Source listing identity**:
The maker source ID and listing URL that distinguish one listing from another, even when their titles or images match.
_Avoid_: Product identity

**Catalog source evidence**:
A dated maker page, catalog edition, or other authoritative source capture that supports catalog identity, offering, market, or lifecycle claims.
_Avoid_: Live URL, refill offering
