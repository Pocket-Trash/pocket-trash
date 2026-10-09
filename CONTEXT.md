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

## Refills and compatibility

**Refill**:
A maker's stable refill model, independent of tip size and ink colour offerings.
_Avoid_: Offering, installed refill

**Refill offering**:
One confirmed combination of refill model, tip, ink colour, and, when meaningful, maker code.
_Avoid_: Refill product, variant

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

**Terminology alias**:
An alternate term for a canonical catalog concept, with optional maker scope.
_Avoid_: Product alias

**Product alias**:
An alternate searchable name for one catalog product.
_Avoid_: Terminology alias, product name
