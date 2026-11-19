# 11 — Legal & Licensing (USA)

This document records what is and is not legally permitted when building a **new,
independently-coded product** that is *functionally similar* to Pathbuilder 2e and that
reads/writes the **same JSON export/import format** for compatibility. It is factual
research into U.S. law, not legal advice. Where the law is unsettled or fact-dependent,
that is flagged explicitly.

> **Scope.** This covers the relationship between *your* product and *Pathbuilder*
> (its code, its UI, its file format, its name). The separate question of reproducing
> *Paizo's* Pathfinder rules text is covered in § 9 (OGL/ORC) — it is a different
> rights-holder and a different license.
>
> **Companion document.** [10-pathfinder-2e-rules.md](./10-pathfinder-2e-rules.md)
> states what the Pathfinder 2e rules *are*, sourced from Archives of Nethys. That is
> the "what may I implement" question; this document is the "what may I copy" question.

---

## 1. Bottom line

Building a functionally-equivalent, independently-written character builder is **legal
in the United States**. The specific things you want to do fall into well-established
categories:

| What you want to do | Legal status | Basis |
| --- | --- | --- |
| Build a product that does the same thing | **Allowed** | Ideas, methods, and systems are not copyrightable (17 U.S.C. § 102(b); *Baker v. Selden*). |
| Write your own code from scratch | **Allowed** | Independent creation is a complete defense to copyright infringement (*Computer Associates v. Altai*). |
| Read/write the same JSON schema for compatibility | **Allowed (low risk)** | File formats are functional interfaces; *Google v. Oracle*, *Sega v. Accolade*, *Lexmark v. Static Control*. |
| Use a similar general UI layout (tabs, panels, stat blocks) | **Allowed** | Functional UI is not protectable (*Apple v. Microsoft*, *TrafFix*). |
| Say "imports Pathbuilder JSON" in marketing | **Allowed with care** | Nominative fair use (*New Kids on the Block*), with a no-affiliation disclaimer. |
| Copy Pathbuilder's source code, CSS, artwork, icons | **NOT allowed** | That is protected expression. |
| Use the name "Pathbuilder" or a confusingly similar name | **NOT allowed** | Trademark likelihood-of-confusion (15 U.S.C. § 1125(a)). |
| Copy Pathbuilder's own creative text (if any) | **NOT allowed** | Protected expression. |
| Access non-public source, private repos, or servers | **NOT allowed** | Trade-secret misappropriation (18 U.S.C. § 1836). |

The single highest-risk item is **not** copyright or the file format — it is **contract**:
if you (or anyone on the team) click "I agree" to a Terms of Service that prohibits
reverse engineering or competing, you may be bound regardless of copyright law
(*Blizzard v. BnetD*). See § 8.

---

## 2. Copyright: what is protected vs. not

### The statutory line

Software is protected as a "literary work" (17 U.S.C. § 102(a)(1)), but § 102(b) draws
the critical boundary:

> "In no case does copyright protection for an original work of authorship extend to
> any idea, procedure, process, system, method of operation, concept, principle, or
> discovery, regardless of the form in which it is described, explained, illustrated,
> or embodied in such work."

— 17 U.S.C. § 102(b), https://www.law.cornell.edu/uscode/text/17/102

This is the **idea/expression dichotomy**: the *specific source code* is protected; the
*functionality, algorithms, methods of operation, and interfaces* are not.

### The cases

| Case | Holding | Relevance |
| --- | --- | --- |
| *Baker v. Selden*, 101 U.S. 99 (1879) | A book describing a bookkeeping *system* gives no exclusive right to the system itself; the forms necessary to practice it may be copied. | Origin of idea/expression and the **merger doctrine**. |
| *Whelan v. Jaslow*, 797 F.2d 1222 (3d Cir. 1986) | Copyright can extend to "structure, sequence and organization" (SSO). | The *expansive* view — later largely rejected. |
| *Computer Associates v. Altai*, 982 F.2d 693 (2d Cir. 1992) | Adopted the **Abstraction-Filtration-Comparison (AFC)** test; independently rewritten code did not infringe. | The leading modern test; the basis for clean-room reimplementation. |
| *Lotus v. Borland*, 49 F.3d 807 (1st Cir. 1995), *aff'd* 516 U.S. 233 (1996) | A menu command hierarchy is a "method of operation" under § 102(b) and uncopyrightable. | Copying a functional interface for compatibility is allowed. |

### The AFC test (from *Altai*)

1. **Abstraction** — break the program into levels (code → modules → structure → function).
2. **Filtration** — remove unprotectable elements: ideas, elements dictated by
   efficiency (**merger**), elements dictated by external constraints (**scènes à faire**),
   and public-domain material.
3. **Comparison** — compare only the *remaining* protectable expression.

### Scènes à faire and merger

- **Merger**: where an idea can be expressed in only one or very few ways, the
  expression "merges" with the idea and is not protected.
- **Scènes à faire**: standard, conventional, or externally-dictated elements (industry
  practice, compatibility requirements, common data structures) are not protectable.

**Implication for this project.** The *idea* of a Pathfinder 2e character builder, the
*rules* it implements (game mechanics — see § 9), and the *functional requirements* of
reading/writing a particular JSON format are all on the unprotected side. What is
protected is Pathbuilder's *specific expression*: its actual source code, its creative
text, its artwork, and non-functional creative choices. Writing your own code to
achieve the same function is exactly what *Altai* and *Lotus* protect.

---

## 3. File format / JSON compatibility

This is the most directly relevant question, and it is the **lowest-risk** part of the
project.

### Is a JSON schema copyrightable?

No case has squarely held "JSON schemas are uncopyrightable," but the conclusion is
drawn from the API/interface cases. A file format's structure, field names, and schema
are **functional** — they are the interface through which programs exchange data.

| Case | Holding | Relevance |
| --- | --- | --- |
| *Google v. Oracle*, 141 S. Ct. 1183 (2021) | Copying the Java API's "declaring code" (method signatures, class names, structure — the *interface*) was **fair use as a matter of law**. | Strongly favors reimplementing an interface for interoperability. |
| *Sega v. Accolade*, 977 F.2d 1510 (9th Cir. 1992) | Disassembling code to discover *functional interface specifications* for compatibility was fair use. | Reading an interface to interoperate is fair use. |
| *Lexmark v. Static Control*, 572 U.S. 118 (2014) | Short, functional "lock-out" code needed for interoperability was not copyrightable. | Functional code needed for compatibility is not protected. |

**Caveat (gray area):** *Google v. Oracle* resolved the case on **fair use** while
*assuming without deciding* that the API was copyrightable. So there is no square
holding that "interfaces are uncopyrightable" — but the practical result strongly
favors reimplementation for interoperability.

### What this means for the JSON format

- **Field names and schema structure** are functional and generally not independently
  copyrightable (they are the "interface").
- **Reading and writing** the same JSON for compatibility is analogous to
  reimplementing an API — favored by *Google v. Oracle* and *Sega*.
- **The risk** arises only if you copy *creative, non-functional* content embedded in
  the format — e.g., long descriptive prose that Pathbuilder itself authored (as
  opposed to Pathfinder rules text, which is a separate Paizo/OGL question).

### Verified: the export JSON is purely functional

The sample export in this repo (`probe/assets/export-json-sample.json`) was inspected.
It contains only:

- Field names (`name`, `class`, `level`, `abilities`, `proficiencies`, `feats`, …)
- Numeric values (ability scores, proficiency ranks, money)
- Enum-like strings (`"Wizard"`, `"Human"`, `"arcane"`, `"prepared"`)
- Game-element names (`"Fleet"`, `"Hobnobber"`, `"Versatile Human"`) — these are
  **Paizo's** game content (OGL/ORC), not Pathbuilder's creative text.

There is **no creative prose, no flavor text, no artwork** in the format. The schema is
a functional data contract. This is the cleanest possible case for interoperability.

### Recommended derivation path

To keep the record clean, derive the schema from **actual exported files** (which users
legitimately possess) and from **observing the app's behavior**, rather than from
decompiling Pathbuilder's source. Document the derivation. This supports an
independent-creation defense and avoids any argument that you copied expression.

---

## 4. Look and feel / trade dress

### Copyright "look and feel"

*Apple v. Microsoft*, 35 F.3d 1435 (9th Cir. 1994): the Ninth Circuit held that
individual GUI elements (windows, icons, menus) were either licensed or unprotectable
under scènes à faire / merger. The court applied "analytical dissection," filtering out
unprotectable elements before comparing. This substantially narrowed "look and feel"
copyright protection.

**Implication:** the *general* layout and functional arrangement of a character-builder
UI (tabs, panels, stat blocks, dropdowns, accordions) is largely unprotectable. What
remains protectable is *specific creative expression*: distinctive artwork, icons, and
non-functional visual design. Copying the *function and general layout* is low-risk;
copying distinctive graphics or pixel-level design is high-risk.

### Trade dress and the functionality doctrine

Trade dress (overall visual appearance) can be protected under the Lanham Act **only if
it is non-functional and has acquired secondary meaning**.

- 15 U.S.C. § 1125(a)(3): the party asserting *unregistered* trade dress bears the
  burden of proving non-functionality.
- *TrafFix Devices v. Marketing Displays*, 532 U.S. 23 (2001): a functional feature
  cannot be trade dress, even with secondary meaning.

**Implication:** a character builder's UI is almost entirely *functional* (it exists to
display and edit character data). Trade-dress risk is low unless you deliberately copy
distinctive, non-functional branding (logos, color schemes, mascots, distinctive
iconography) in a way likely to confuse consumers.

---

## 5. Trademark and naming

### The governing statute

15 U.S.C. § 1125(a)(1)(A) creates liability for using a word, name, symbol, or device
in commerce that is "likely to cause confusion … as to the affiliation, connection, or
association" with another, or "as to the origin, sponsorship, or approval" of goods.

### Using a similar name

The test is **likelihood of consumer confusion** (multi-factor tests such as *AMF v.
Sleekcraft*, 599 F.2d 341 (9th Cir. 1979): strength of the mark, similarity of marks,
proximity of goods, actual confusion, intent, etc.).

A name incorporating "Pathbuilder" (or a confusingly similar variant) for a
Pathfinder-character-builder product creates a **meaningful** risk of confusion.
**Choose a distinct name.** Do not use "Pathbuilder," "Path Builder," or close variants.

### Nominative fair use (referring to the product)

*New Kids on the Block v. News America*, 971 F.2d 302 (9th Cir. 1992) established
**nominative fair use**: you may use another's trademark to *refer to* that party's
product when:

1. the product cannot be readily identified without using the mark;
2. only so much of the mark is used as is necessary; and
3. you do nothing to suggest sponsorship or endorsement.

**Implication:** saying "imports Pathbuilder JSON files" or "compatible with Pathbuilder
2e" is *likely* nominative fair use **if** you (a) use only the word mark (no logos or
stylized fonts), (b) use it only as necessary to identify the product, and (c) add a
clear "not affiliated with, endorsed by, or sponsored by Pathbuilder" disclaimer.

**Two caveats:**
1. Nominative fair use is a *defense*, not immunity — it does not prevent a lawsuit,
   only provides a strong defense.
2. The OGL itself *contractually* restricts compatibility claims using Product Identity
   (see § 9) — a separate constraint on top of trademark law.

---

## 6. Trade secrets and reverse engineering

### The Defend Trade Secrets Act (DTSA)

- 18 U.S.C. § 1836(b): federal civil action for trade-secret misappropriation.
- 18 U.S.C. § 1839(3): a "trade secret" requires (A) reasonable measures to keep it
  secret, and (B) independent economic value from not being generally known or readily
  ascertainable through proper means.
- **18 U.S.C. § 1839(6)(B): "improper means" does *not* include reverse engineering,
  independent derivation, or any other lawful means of acquisition.**

The Uniform Trade Secrets Act (UTSA, adopted in nearly all states) is to the same
effect: its official comments state that reverse engineering and independent derivation
are *proper* means.

### When reverse engineering crosses the line

Reverse engineering is generally **not** misappropriation because it is a "fair and
independent means of learning information." It crosses into misappropriation when you:

- are bound by an NDA or confidentiality obligation and breach it;
- obtain information through theft, bribery, misrepresentation, or breach of a duty of
  secrecy (e.g., accessing non-public source, private repos, or servers without
  authorization);
- use information you know was obtained improperly.

**Implication:** observing *publicly served* JavaScript and *publicly available* JSON
files is reverse engineering from publicly available material — generally lawful. The
line is crossed only by accessing non-public material or breaching a confidentiality
obligation. **Work only from what is publicly served and from files users legitimately
export.**

---

## 7. DMCA anti-circumvention (17 U.S.C. § 1201)

- § 1201(a)(1)(A) prohibits circumventing a "technological measure that effectively
  controls access" to a copyrighted work.
- **§ 1201(f)** permits a person who has "lawfully obtained the right to use a copy of
  a computer program" to circumvent access controls "for the sole purpose of
  identifying and analyzing those elements … necessary to achieve **interoperability**"
  of an independently created program, where those elements "have not previously been
  readily available."

**Key point:** § 1201 only prohibits circumventing an *access control*. Simply viewing,
downloading, or pretty-printing JavaScript that is **served to your browser without any
access control** is **not circumvention** — there is no technological measure being
bypassed. The § 1201 concern arises only if Pathbuilder employed access controls
(obfuscation-as-access-control, authentication handshakes, encryption) that you had to
defeat.

**Verified:** Pathbuilder's bundle is served publicly and unobfuscated (the repo's
`probe/assets/pb-main.pretty.js` is a beautified copy of the publicly served bundle).
Reading it is not circumvention. The § 1201(f) interoperability exception is available
as a backstop if any access control were ever involved.

---

## 8. Terms of Service / contract law

This is the **highest-risk** area, and it is the one thing that can override everything
else in this document.

### Browsewrap vs. clickwrap

A ToS is a *contract* only if the user **assented**:

- *Specht v. Netscape*, 306 F.3d 17 (2d Cir. 2002): a license presented only via a link
  at the bottom of a page (browsewrap), with no affirmative "I agree," was
  **unenforceable**.
- *Nguyen v. Barnes & Noble*, 763 F.3d 1171 (9th Cir. 2014): a browsewrap ToS was
  **unenforceable** even where the hyperlink was near buttons the user clicked.
- **Clickwrap** (affirmative "I agree") is generally enforceable.

### The counterweight: *Blizzard v. BnetD*

*Davidson & Associates v. Jung*, 422 F.3d 630 (8th Cir. 2005): the Eighth Circuit
**enforced** a clickwrap EULA that prohibited reverse engineering, holding the
programmers had waived their fair-use rights by contract. **If you click "I agree" to a
ToS that prohibits reverse engineering or competing, you may be contractually bound
even where copyright law would otherwise permit the activity.**

### Verified: Pathbuilder's current state

The **complete** licensure text present in the product was collected and reviewed. It
consists of exactly three things, and nothing else:

1. **The ORC Notice** — "This product is licensed under the ORC License … All warranties
   are disclaimed as set forth therein."
2. **The OGL 1.0a** — the full Wizards of the Coast license text.
3. **The Section 15 copyright notices** — the list of Paizo source books and their
   authors (Player Core, GM Core, Bestiary, Lost Omens, Adventure Paths, etc.), plus
   third-party notices (Necromancer Games' *Tome of Horrors*, Green Ronin, etc.).

There is **no Terms of Service, no EULA, no anti-reverse-engineering clause, no
anti-competition clause, and no Pathbuilder-specific terms of any kind**. No one is
ever required to click "I agree" to anything. Specifically:

- The landing page (`pathbuilder2e.com`) is a minimal page with **no ToS link**.
- `pathbuilder2e.com/terms.html` returns **404** — there is no terms page.
- The app's sidebar "Licenses" entry opens the ORC/OGL/Section-15 text above — this is
  *game-content* licensing (Paizo/Wizards), **not** a Terms of Service for the app.
- No clickwrap "I agree" gate exists anywhere in the app.

**Conclusion:** the highest-risk category identified in § 11 (contract/ToS violation)
is **not present** in Pathbuilder as of this writing. There is no contract to breach by
observing the publicly served app or by building a competing product. The only
contractual obligations that exist are the **OGL/ORC terms**, and those attach *only if
you reproduce Paizo's Open Game Content* (see § 9) — they do not restrict your use of
Pathbuilder's code, format, or ideas.

**Caveat:** this is a snapshot, not a guarantee. The Google Play listing and the
in-app purchase flow (Stripe/PayPal) were not independently reviewed for separate
terms. If a future version adds a clickwrap ToS/EULA, re-evaluate before anyone clicks
"I agree."

---

## 9. Pathfinder game content: OGL and ORC

This is a **separate** rights-holder (Paizo/Wizards) and a **separate** license from
Pathbuilder's own code and format. It matters because a Pathfinder character builder
necessarily deals in Pathfinder game elements (feat names, spell names, class names).

### Game mechanics are not copyrightable

The *rules* of Pathfinder 2e (how ability scores work, how feats work, dice mechanics)
are ideas/methods and are not protected by copyright **regardless of any license**
(17 U.S.C. § 102(b); *Baker v. Selden*).

### The OGL 1.0a

The Open Game License (Wizards of the Coast, 2000) permits use of "Open Game Content"
(OGC — game mechanics, methods, procedures, processes, routines) while reserving
"Product Identity" (PI — names, logos, trade dress, storylines, artwork, character
names). Key provisions:

- § 1(d)/(e): OGC vs. PI definitions.
- § 4: perpetual, worldwide, royalty-free, non-exclusive license to Use OGC.
- **§ 7: "You agree not to Use any Product Identity, including as an indication as to
  compatibility … You agree not to indicate compatibility or co-adaptability with any
  Trademark … except as expressly licensed in another, independent Agreement."**
- § 11: may not market OGC using a Contributor's name without written permission.

Full text: https://www.d20srd.org/ogl.htm

### The ORC License

Announced by Paizo in January 2023 (in response to Wizards' attempt to de-authorize OGL
1.0a), released July 2023. A system-agnostic, perpetual, irrevocable license; the
license text is dedicated to the public domain. Text and the "AxE" (Attribution and
Explanation) at https://azoralaw.com/orclicense/.

**Verified:** Pathbuilder's own "Licenses" dialog displays the ORC Notice ("This product
is licensed under the ORC License …") alongside the OGL 1.0a text — confirming that
Pathbuilder itself licenses the *game content* under ORC/OGL, and that the game content
is the licensed layer, distinct from Pathbuilder's own code and format.

### How this affects a new builder

1. **Mechanics** (the rules) can be implemented in your own words without a license —
   but the *names* of specific game elements (feats, spells, classes) may be PI/trademark
   issues.
2. **Reproducing Paizo's rules *text*** (exact feat/spell descriptions) requires OGL 1.0a
   or ORC compliance — including the § 7 restriction on compatibility claims using
   Product Identity.
3. **Product Identity is off-limits**: "Pathfinder," the Pathfinder logo, Golarion
   setting names, iconic character names, and Paizo's trade dress require a separate
   license.
4. **Pathbuilder's JSON format is *not* Paizo's OGC** — it is Pathbuilder's own work.
   The OGL/ORC govern the *game content*, not Pathbuilder's file format. Treat the two
   questions separately.

**Practical note:** the repo's own documentation already flags this — rules text
(`text_descrip`, spell `description`) was deliberately **not** transcribed, with
Archives of Nethys named as the canonical source. That is the correct posture: extract
rules text from a licensed source (AoN/OGL/ORC), not from Pathbuilder's data files.

---

## 10. Clean-room reverse engineering

**What it is:** one team ("dirty room") examines the target and produces a *specification*
of its behavior (inputs, outputs, formats, functionality); a *separate* team ("clean
room") that has never seen the target's source implements from that specification alone.
The goal is to prove independent creation.

**When it is advisable:** when you have access to (or could be accused of copying) the
target's source code, or when the risk of "substantial similarity" in *expression* is
high.

**For this project:** if you are only deriving a JSON schema from publicly exported
files and implementing your own UI and code from scratch, a formal clean room may be
overkill — but the *principles* are still valuable:

- document your independent derivation;
- keep a record that no one copied source code;
- derive the schema from user files rather than decompiled code.

Clean room is not a statutory defense but an evidentiary technique to establish
independent creation (a complete defense to copyright infringement), endorsed in
practice and discussed in *Altai*.

---

## 11. Risk assessment

| Risk | Level | Basis |
| --- | --- | --- |
| Contract (ToS/EULA) violation | **Not present** | No ToS/EULA exists in Pathbuilder (verified — only ORC/OGL game-content text). Re-check if a future version adds one. |
| Trademark confusion (name) | **High** | Using "Pathbuilder" or a confusingly similar name risks § 1125(a) liability. |
| Copyright (copying creative content) | **Medium** | Copying code/artwork/creative text is infringement; copying *function* is not (*Altai*, *Lotus*). |
| Trade secret | **Low–Medium** | Only if you access non-public material or breach an NDA (18 U.S.C. § 1839(6)(B)). |
| DMCA § 1201 | **Low** | Only if you defeat an access control; reading publicly served JS is not circumvention. |
| Trade dress | **Low** | Functional UI is not protectable (*TrafFix*); only distinctive non-functional branding is at risk. |
| File format copyright | **Low** | Schema/field names are functional; *Google v. Oracle* and *Sega* favor interoperability. |

---

## 12. Compliance checklist

1. **Do not copy any source code, artwork, icons, or creative text.** Write all code
   independently. Do not copy Pathbuilder's CSS, images, or descriptive strings.
2. **Derive the JSON schema from user-exported files and observed behavior**, not from
   decompiled or obfuscated source. Document the derivation.
3. **Choose a non-confusing name.** Avoid "Pathbuilder" and close variants.
4. **Use nominative fair use carefully** for compatibility claims: word mark only, a
   clear "not affiliated with / not endorsed by" disclaimer, no logos.
5. **Read Pathbuilder's actual ToS/EULA before anyone clicks "I agree."** As of this
   writing there is none (verified — only ORC/OGL game-content text). Re-check if a
   future version adds one. Do not create accounts or accept terms casually.
6. **Do not access non-public source, private repos, or servers.** Work only from
   publicly available material.
7. **Respect Paizo's IP separately:** comply with OGL/ORC if reproducing rules text;
   never use "Pathfinder" or Paizo trademarks to imply endorsement; treat Pathbuilder's
   format as a separate interoperability matter.
8. **Keep an evidentiary record** of independent creation (design docs, commit history,
   schema-derivation notes).
9. **Consider a formal clean room** if any team member has seen Pathbuilder's source
   code.
10. **Consult an IP attorney** before launch, particularly on the trademark name and any
    ToS you may have accepted.

---

## 13. Sources

**Statutes**

- 17 U.S.C. § 102 — https://www.law.cornell.edu/uscode/text/17/102
- 17 U.S.C. § 1201 — https://www.law.cornell.edu/uscode/text/17/1201
- 15 U.S.C. § 1125 — https://www.law.cornell.edu/uscode/text/15/1125
- 18 U.S.C. § 1836, § 1839 — https://www.law.cornell.edu/uscode/text/18/1836

**Cases**

- *Baker v. Selden*, 101 U.S. 99 (1879)
- *Whelan Assocs. v. Jaslow Dental Lab.*, 797 F.2d 1222 (3d Cir. 1986)
- *Computer Associates Int'l v. Altai, Inc.*, 982 F.2d 693 (2d Cir. 1992)
- *Lotus Dev. Corp. v. Borland Int'l*, 49 F.3d 807 (1st Cir. 1995), *aff'd* 516 U.S. 233 (1996)
- *Google LLC v. Oracle America, Inc.*, 141 S. Ct. 1183 (2021)
- *Sega Enterprises v. Accolade*, 977 F.2d 1510 (9th Cir. 1992)
- *Lexmark Int'l v. Static Control Components*, 572 U.S. 118 (2014)
- *Apple Computer v. Microsoft Corp.*, 35 F.3d 1435 (9th Cir. 1994)
- *TrafFix Devices v. Marketing Displays*, 532 U.S. 23 (2001)
- *AMF Inc. v. Sleekcraft Boats*, 599 F.2d 341 (9th Cir. 1979)
- *New Kids on the Block v. News America*, 971 F.2d 302 (9th Cir. 1992)
- *Specht v. Netscape Communications*, 306 F.3d 17 (2d Cir. 2002)
- *Nguyen v. Barnes & Noble*, 763 F.3d 1171 (9th Cir. 2014)
- *Davidson & Associates v. Jung* (Blizzard v. BnetD), 422 F.3d 630 (8th Cir. 2005)

**Licenses and secondary sources**

- OGL 1.0a — https://www.d20srd.org/ogl.htm
- ORC License — https://azoralaw.com/orclicense/
- Paizo ORC announcement — https://paizo.com/community/blog/v5748dyo6si7v
- EFF, "Coders' Rights Project Reverse Engineering FAQ" — https://www.eff.org/issues/coders/reverse-engineering-faq
- U.S. Copyright Office, Circular 33 (Works Not Protected by Copyright) — https://www.copyright.gov/circs/circ33.pdf
- U.S. Copyright Office, § 1201 rulemaking — https://www.copyright.gov/1201/2021/

---

## 14. Open questions / follow-ups

1. **Pathbuilder's ToS/EULA** — **resolved**: the complete licensure text in the product
   is only the ORC Notice, OGL 1.0a, and Section 15 copyright notices. No ToS/EULA, no
   clickwrap, no anti-reverse-engineering or anti-competition terms. (Remaining minor
   gap: the Google Play listing and Stripe/PayPal purchase flow were not independently
   reviewed for separate terms.)
2. **Whether the export JSON ever contains creative prose** — the sample inspected here
   is purely functional, but a broader sample of real user exports (especially custom
   content, custom feats, or notes fields) should be checked for any Pathbuilder-authored
   descriptive text.
3. **Paizo's current licensing posture** — whether new Pathfinder 2e content is offered
   under OGL 1.0a, ORC, or both, and which license to adopt if you reproduce rules text.
   (The Section 15 notices collected from Pathbuilder confirm the game content is
   licensed under OGL 1.0a with the ORC Notice applied — both are present.)